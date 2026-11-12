/**
 * Lectura y validación de la planilla de carga inicial (HU-07). Función pura.
 *
 * Regla del negocio: si una sola fila tiene error, no se carga nada. Una carga a medias deja
 * a Personas sin saber qué quedó adentro y qué no; es mejor corregir y volver a subir.
 *
 * Formato: CSV con encabezado. Se acepta coma o punto y coma (Excel en Chile guarda con punto
 * y coma). Columnas (el orden da igual, los nombres sí importan):
 *   rut, nombres, apellidos, cargo, sede, fecha_ingreso, tipo_contrato, horas_semanales,
 *   rut_jefatura, telefono, email, fecha_termino_contrato, saldo_vacaciones
 * Fechas en AAAA-MM-DD o DD-MM-AAAA. tipo_contrato: indefinido, plazo fijo u obra.
 */
import { normalizarRut } from '../common/rut.js';

export const COLUMNAS_OBLIGATORIAS = ['rut', 'nombres', 'apellidos', 'cargo', 'sede', 'fecha_ingreso', 'tipo_contrato'] as const;

export interface FilaPlanilla {
  fila: number;
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  sede: string;
  fechaIngreso: string;
  tipoContrato: 'INDEFINIDO' | 'PLAZO_FIJO' | 'OBRA_FAENA';
  horasSemanales: number;
  rutJefatura: string | null;
  telefono: string | null;
  email: string | null;
  fechaTerminoContrato: string | null;
  saldoVacaciones: number | null;
}

export interface ErrorPlanilla {
  fila: number;
  mensaje: string;
}

export interface ContextoValidacion {
  sedes: string[];
  rutsExistentes: ReadonlySet<string>;
  hoy: string;
}

/** Separa una línea CSV respetando comillas ("Pérez, Juan" es un solo campo). */
export function separarLinea(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else entreComillas = !entreComillas;
    } else if (c === separador && !entreComillas) {
      campos.push(actual.trim());
      actual = '';
    } else actual += c;
  }
  campos.push(actual.trim());
  return campos;
}

export function normalizarFecha(texto: string): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) [a, m, d] = t.split('-').map(Number);
  else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(t)) [d, m, a] = t.split(/[-/]/).map(Number);
  else return null;
  const fecha = new Date(Date.UTC(a, m - 1, d));
  // Rechaza fechas imposibles como 31-02-2024, que Date convertiría en marzo sin avisar.
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;
  return fecha.toISOString().slice(0, 10);
}

function tipoContrato(texto: string): FilaPlanilla['tipoContrato'] | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_-]/g, ' ').trim();
  if (t.startsWith('indef')) return 'INDEFINIDO';
  if (t.startsWith('plazo')) return 'PLAZO_FIJO';
  if (t.startsWith('obra') || t.includes('faena')) return 'OBRA_FAENA';
  return null;
}

export function leerPlanilla(contenido: string, ctx: ContextoValidacion): { filas: FilaPlanilla[]; errores: ErrorPlanilla[] } {
  const lineas = contenido.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length < 2) return { filas: [], errores: [{ fila: 1, mensaje: 'La planilla no tiene filas de datos.' }] };

  const separador = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const encabezado = separarLinea(lineas[0], separador).map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_'));
  const faltan = COLUMNAS_OBLIGATORIAS.filter((c) => !encabezado.includes(c));
  if (faltan.length) return { filas: [], errores: [{ fila: 1, mensaje: `Faltan columnas: ${faltan.join(', ')}.` }] };

  const sedesNormalizadas = new Map(ctx.sedes.map((s) => [s.toLowerCase(), s]));
  const filas: FilaPlanilla[] = [];
  const errores: ErrorPlanilla[] = [];
  const vistos = new Map<string, number>();

  lineas.slice(1).forEach((linea, i) => {
    const n = i + 2; // número de fila tal como la ve Personas en Excel
    const valores = separarLinea(linea, separador);
    const v = (col: string) => valores[encabezado.indexOf(col)]?.trim() ?? '';
    const problemas: string[] = [];

    const rut = normalizarRut(v('rut'));
    if (!rut) problemas.push(`RUT inválido "${v('rut')}"`);
    else if (vistos.has(rut)) problemas.push(`RUT repetido (también en la fila ${vistos.get(rut)})`);
    else if (ctx.rutsExistentes.has(rut)) problemas.push('Ese RUT ya tiene ficha en la empresa');
    if (rut) vistos.set(rut, n);

    for (const col of ['nombres', 'apellidos', 'cargo'] as const) if (!v(col)) problemas.push(`Falta ${col}`);
    const sede = sedesNormalizadas.get(v('sede').toLowerCase());
    if (!sede) problemas.push(`Sede desconocida "${v('sede')}"`);

    const ingreso = normalizarFecha(v('fecha_ingreso'));
    if (!ingreso) problemas.push(`Fecha de ingreso inválida "${v('fecha_ingreso')}"`);
    else if (ingreso > ctx.hoy) problemas.push('La fecha de ingreso es futura');

    const contrato = tipoContrato(v('tipo_contrato'));
    if (!contrato) problemas.push(`Tipo de contrato desconocido "${v('tipo_contrato')}"`);

    const horas = v('horas_semanales') ? Number(v('horas_semanales').replace(',', '.')) : 42;
    // Jornada ordinaria máxima vigente: 42 horas desde el 26-04-2026 (Ley 21.561).
    if (!Number.isFinite(horas) || horas <= 0 || horas > 42) problemas.push(`Horas semanales fuera de rango "${v('horas_semanales')}" (máximo 42)`);

    const rutJefatura = v('rut_jefatura') ? normalizarRut(v('rut_jefatura')) : null;
    if (v('rut_jefatura') && !rutJefatura) problemas.push(`RUT de jefatura inválido "${v('rut_jefatura')}"`);

    const termino = v('fecha_termino_contrato') ? normalizarFecha(v('fecha_termino_contrato')) : null;
    if (v('fecha_termino_contrato') && !termino) problemas.push('Fecha de término inválida');
    if (contrato === 'PLAZO_FIJO' && !termino) problemas.push('Un contrato a plazo fijo necesita fecha de término');

    const email = v('email') || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problemas.push(`Correo inválido "${email}"`);

    const saldo = v('saldo_vacaciones') ? Number(v('saldo_vacaciones').replace(',', '.')) : null;
    if (saldo !== null && (!Number.isFinite(saldo) || saldo < -30 || saldo > 120)) problemas.push(`Saldo de vacaciones fuera de rango "${v('saldo_vacaciones')}"`);

    if (problemas.length) {
      errores.push({ fila: n, mensaje: problemas.join('. ') + '.' });
      return;
    }
    filas.push({
      fila: n,
      rut: rut!,
      nombres: v('nombres'),
      apellidos: v('apellidos'),
      cargo: v('cargo'),
      sede: sede!,
      fechaIngreso: ingreso!,
      tipoContrato: contrato!,
      horasSemanales: horas,
      rutJefatura,
      telefono: v('telefono') || null,
      email,
      fechaTerminoContrato: termino,
      saldoVacaciones: saldo,
    });
  });

  // La jefatura debe existir en la base o venir en la misma planilla.
  const rutsPlanilla = new Set(filas.map((f) => f.rut));
  for (const f of filas) {
    if (f.rutJefatura && !rutsPlanilla.has(f.rutJefatura) && !ctx.rutsExistentes.has(f.rutJefatura)) {
      errores.push({ fila: f.fila, mensaje: `La jefatura ${f.rutJefatura} no existe en la empresa ni en la planilla.` });
    }
  }
  return { filas, errores: errores.sort((a, b) => a.fila - b.fila) };
}
