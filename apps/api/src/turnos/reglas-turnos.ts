/**
 * Reglas de turnos (HU-23). Funciones puras que revisan la semana de una persona.
 *
 * Dos niveles:
 * - error: no se puede guardar (asignar a alguien de vacaciones, un feriado irrenunciable).
 * - alerta: se puede guardar, pero quien arma el turno debe saberlo (horas extra, descanso).
 *   El sistema no decide por la jefatura: informa con la norma citada.
 *
 * Normas aplicadas:
 * - Jornada ordinaria semanal pactada (máximo legal 42 h desde el 26-04-2026, Ley 21.561).
 *   Lo que exceda lo pactado serían horas extraordinarias.
 * - Máximo 10 horas ordinarias diarias y distribución en no menos de 5 ni más de 6 días (art. 28 CT).
 * - Comercio (art. 38 N°7 CT): al menos 2 de los días de descanso del mes deben ser domingo.
 *   Se revisa a nivel mensual en `domingosLibresDelMes`.
 * - Feriados irrenunciables del comercio (Ley 19.973): no se asignan turnos.
 */
import { aFecha, sumarDias } from '../ausencias/calendario-laboral.js';

export const MAX_HORAS_DIARIAS = 10;
export const MAX_DIAS_SEMANA = 6;
export const MIN_DOMINGOS_LIBRES_MES = 2;

export interface TurnoDia {
  fecha: string;
  inicio: string;
  fin: string;
  colacionMin: number;
}

export interface Problema {
  nivel: 'error' | 'alerta';
  fecha?: string;
  mensaje: string;
}

export function esHora(texto: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto);
}

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Horas efectivas de un turno, descontando colación. Si termina antes de empezar, cruza la medianoche. */
export function horasTurno(t: Pick<TurnoDia, 'inicio' | 'fin' | 'colacionMin'>): number {
  let duracion = minutos(t.fin) - minutos(t.inicio);
  if (duracion <= 0) duracion += 24 * 60;
  return Math.max(0, duracion - t.colacionMin) / 60;
}

/** Lunes de la semana de una fecha. */
export function lunesDe(fecha: string): string {
  const dia = aFecha(fecha).getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
}

export function diasDeLaSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

export interface ContextoSemana {
  horasPactadas: number;
  /** Días con ausencia aprobada (vacaciones, licencia, permiso). */
  diasAusente: ReadonlySet<string>;
  /** Feriados irrenunciables del comercio en la semana. */
  irrenunciables: ReadonlyMap<string, string>;
}

export function revisarSemana(turnos: TurnoDia[], ctx: ContextoSemana): { horas: number; problemas: Problema[] } {
  const problemas: Problema[] = [];
  let horas = 0;
  for (const t of turnos) {
    if (!esHora(t.inicio) || !esHora(t.fin)) {
      problemas.push({ nivel: 'error', fecha: t.fecha, mensaje: 'Hora con formato inválido (usa HH:MM).' });
      continue;
    }
    const horasDia = horasTurno(t);
    horas += horasDia;
    if (ctx.diasAusente.has(t.fecha)) problemas.push({ nivel: 'error', fecha: t.fecha, mensaje: 'Tiene una ausencia aprobada ese día.' });
    const feriado = ctx.irrenunciables.get(t.fecha);
    if (feriado) problemas.push({ nivel: 'error', fecha: t.fecha, mensaje: `${feriado} es feriado irrenunciable para el comercio (Ley 19.973).` });
    if (horasDia > MAX_HORAS_DIARIAS) problemas.push({ nivel: 'alerta', fecha: t.fecha, mensaje: `${h(horasDia)} h en el día: la jornada ordinaria diaria no puede superar 10 h (art. 28 CT).` });
    if (horasDia === 0) problemas.push({ nivel: 'error', fecha: t.fecha, mensaje: 'El turno no tiene horas efectivas.' });
  }
  if (turnos.length > MAX_DIAS_SEMANA) problemas.push({ nivel: 'alerta', mensaje: `Trabaja ${turnos.length} días: la jornada se distribuye en máximo 6 días y debe tener al menos un día de descanso (art. 28 CT).` });
  if (horas > ctx.horasPactadas + 0.01) {
    problemas.push({ nivel: 'alerta', mensaje: `${h(horas)} h en la semana y su jornada pactada es de ${ctx.horasPactadas} h: la diferencia (${h(horas - ctx.horasPactadas)} h) serían horas extraordinarias.` });
  }
  return { horas: redondear(horas), problemas };
}

/** Domingos sin turno en el mes (art. 38 N°7: al menos 2 en el comercio). */
export function domingosLibresDelMes(mes: string, fechasConTurno: ReadonlySet<string>): { domingos: number; libres: number } {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  let domingos = 0;
  let libres = 0;
  for (let d = 1; d <= ultimo; d++) {
    const f = `${mes}-${String(d).padStart(2, '0')}`;
    if (aFecha(f).getUTCDay() !== 0) continue;
    domingos++;
    if (!fechasConTurno.has(f)) libres++;
  }
  return { domingos, libres };
}

const redondear = (n: number) => Math.round(n * 100) / 100;
/** Número con coma decimal chilena para los mensajes: 11,5 h. */
const h = (n: number) => redondear(n).toLocaleString('es-CL');
