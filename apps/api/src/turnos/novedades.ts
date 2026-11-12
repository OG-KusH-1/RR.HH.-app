/**
 * Archivo mensual de novedades para el contador (HU-22). Función pura.
 *
 * El contador calcula las remuneraciones con su software; Tangata le entrega lo que cambió en
 * el mes para que no tenga que pedirlo por WhatsApp: ingresos, salidas, días de vacaciones,
 * permisos, licencias y horas sobre la jornada pactada según los turnos publicados.
 *
 * Las ausencias se cuentan dentro del mes: hábiles para vacaciones y permisos (como se pagan),
 * corridos para licencias (como las cubre el subsidio). El formato se acuerda con el contador:
 * aquí va una versión razonable en CSV con punto y coma, que Excel abre directo.
 */
import { contarDiasHabiles, diasCorridos } from '../ausencias/calendario-laboral.js';

export interface PersonaNovedad {
  rut: string;
  nombre: string;
  sede: string;
  fechaIngreso: string;
  fechaDesvinculacion: string | null;
}

export interface AusenciaNovedad {
  rut: string;
  codigo: string;
  desde: string;
  hasta: string;
}

export interface FilaNovedad {
  rut: string;
  nombre: string;
  sede: string;
  ingreso: string;
  salida: string;
  vacaciones: number;
  permisoConGoce: number;
  permisoSinGoce: number;
  permisoLegal: number;
  licenciaDiasCorridos: number;
  horasSobreJornada: number;
}

export function calcularNovedades(
  mes: string,
  personas: PersonaNovedad[],
  ausencias: AusenciaNovedad[],
  feriados: ReadonlySet<string>,
  horasExtraPorRut: ReadonlyMap<string, number>,
): FilaNovedad[] {
  const desde = `${mes}-01`;
  const [a, m] = mes.split('-').map(Number);
  const hasta = `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const recortar = (x: AusenciaNovedad) => ({ d: x.desde > desde ? x.desde : desde, h: x.hasta < hasta ? x.hasta : hasta });

  return personas
    .map((p) => {
      const propias = ausencias.filter((x) => x.rut === p.rut && x.desde <= hasta && x.hasta >= desde);
      const habiles = (codigo: string) => propias.filter((x) => x.codigo === codigo).reduce((acc, x) => acc + contarDiasHabiles(recortar(x).d, recortar(x).h, feriados), 0);
      const corridos = (codigo: string) => propias.filter((x) => x.codigo === codigo).reduce((acc, x) => acc + diasCorridos(recortar(x).d, recortar(x).h), 0);
      return {
        rut: p.rut,
        nombre: p.nombre,
        sede: p.sede,
        ingreso: p.fechaIngreso >= desde && p.fechaIngreso <= hasta ? p.fechaIngreso : '',
        salida: p.fechaDesvinculacion && p.fechaDesvinculacion >= desde && p.fechaDesvinculacion <= hasta ? p.fechaDesvinculacion : '',
        vacaciones: habiles('VACACIONES'),
        permisoConGoce: habiles('PERMISO_CON_GOCE'),
        permisoSinGoce: habiles('PERMISO_SIN_GOCE'),
        permisoLegal: habiles('PERMISO_LEGAL'),
        licenciaDiasCorridos: corridos('LICENCIA_MEDICA'),
        horasSobreJornada: horasExtraPorRut.get(p.rut) ?? 0,
      };
    })
    .filter((f) => f.ingreso || f.salida || f.vacaciones || f.permisoConGoce || f.permisoSinGoce || f.permisoLegal || f.licenciaDiasCorridos || f.horasSobreJornada);
}

const ENCABEZADO = ['RUT', 'Nombre', 'Sede', 'Ingreso', 'Salida', 'Vacaciones (días hábiles)', 'Permiso con goce', 'Permiso sin goce', 'Permiso legal', 'Licencia (días corridos)', 'Horas sobre jornada'];

export function aCsv(filas: FilaNovedad[]): string {
  const celda = (v: string | number) => {
    const t = typeof v === 'number' ? v.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : v;
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lineas = filas.map((f) => [f.rut, f.nombre, f.sede, f.ingreso, f.salida, f.vacaciones, f.permisoConGoce, f.permisoSinGoce, f.permisoLegal, f.licenciaDiasCorridos, f.horasSobreJornada].map(celda).join(';'));
  // BOM al inicio para que Excel reconozca las tildes.
  return '﻿' + [ENCABEZADO.join(';'), ...lineas].join('\r\n');
}
