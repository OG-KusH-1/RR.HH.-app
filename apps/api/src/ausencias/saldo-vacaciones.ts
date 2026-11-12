/**
 * Cálculo del saldo de vacaciones (HU-08 y HU-11). Funciones puras, sin base de datos.
 *
 * Reglas del Código del Trabajo que se aplican:
 * - Art. 67: 15 días hábiles de feriado por año, con derecho a usarlos tras un año de servicio.
 * - Art. 68 (feriado progresivo): con 10 años trabajados, para uno o más empleadores, se suma
 *   un día por cada 3 nuevos años trabajados. Solo se pueden hacer valer hasta 10 años
 *   prestados a empleadores anteriores.
 * - Art. 70: el feriado se puede acumular hasta por dos períodos consecutivos. Pasado eso
 *   se avisa a Personas; el sistema no borra días (eso sería una decisión sobre la persona).
 *
 * Decisiones de diseño:
 * - El devengo es mensual: 1/12 del derecho anual por cada mes completo de servicio.
 *   Es la forma habitual de calcular el feriado proporcional y es fácil de explicar en pantalla.
 *   Limitación: no prorratea días sueltos dentro del mes en curso.
 * - El derecho anual de cada mes usa los años acumulados a ese mes, así el día progresivo
 *   empieza a devengarse desde que se cumple el tramo, no de golpe.
 * - Zonas extremas (regiones de Aysén, Magallanes y provincia de Palena tienen 20 días):
 *   se configura con `diasBaseAnuales`. Rapa Nui usa la regla general.
 */
import { aFecha } from './calendario-laboral.js';

export const DIAS_BASE_ANUALES = 15;
export const MAX_ANIOS_PREVIOS = 10;
export const ANIOS_PARA_PROGRESIVO = 10;
export const ANIOS_POR_DIA_PROGRESIVO = 3;

export interface DatosSaldo {
  fechaIngreso: string;
  /** Años con empleadores anteriores acreditados (se topa a 10 aquí). */
  aniosPrevios: number;
  /** Fecha de corte, normalmente hoy en la sede del trabajador. */
  fechaCorte: string;
  /** Suma de movimientos del libro: negativos consumen, positivos devuelven o ajustan. */
  movimientos: number;
  diasBaseAnuales?: number;
}

export interface Saldo {
  mesesServicio: number;
  aniosServicio: number;
  /** Días progresivos por año que corresponden hoy. */
  diasProgresivosAnuales: number;
  derechoAnual: number;
  devengado: number;
  movimientos: number;
  /** Devengado + movimientos. Puede ser negativo si se adelantaron días. */
  saldo: number;
  /** Lo que se puede pedir hoy: 0 antes de cumplir un año, salvo ajuste de Personas. */
  disponible: number;
  /** Fecha en que cumple su primer año, si aún no lo cumple. */
  cumpleAnioEl: string | null;
  /** Art. 70: el saldo supera dos períodos acumulados. */
  excedeAcumulacion: boolean;
}

/** Meses completos entre dos fechas. Un mes se completa el mismo día del mes siguiente. */
export function mesesCompletos(desde: string, hasta: string): number {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  if (b < a) return 0;
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses--;
  return Math.max(0, meses);
}

/** Días progresivos por año según años totales trabajados (art. 68). */
export function diasProgresivos(aniosEnEmpresa: number, aniosPrevios: number): number {
  const total = Math.min(aniosPrevios, MAX_ANIOS_PREVIOS) + aniosEnEmpresa;
  if (total < ANIOS_PARA_PROGRESIVO) return 0;
  return Math.floor((total - ANIOS_PARA_PROGRESIVO) / ANIOS_POR_DIA_PROGRESIVO);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularSaldo(d: DatosSaldo): Saldo {
  const base = d.diasBaseAnuales ?? DIAS_BASE_ANUALES;
  const meses = mesesCompletos(d.fechaIngreso, d.fechaCorte);

  let devengado = 0;
  for (let k = 1; k <= meses; k++) {
    // Años cumplidos al cierre del mes k: el progresivo se gana por años completos.
    devengado += (base + diasProgresivos(Math.floor(k / 12), d.aniosPrevios)) / 12;
  }

  const anios = Math.floor(meses / 12);
  const progresivo = diasProgresivos(anios, d.aniosPrevios);
  const derechoAnual = base + progresivo;
  const saldo = redondear(devengado + d.movimientos);

  let cumpleAnioEl: string | null = null;
  if (meses < 12) {
    const ingreso = aFecha(d.fechaIngreso);
    cumpleAnioEl = new Date(Date.UTC(ingreso.getUTCFullYear() + 1, ingreso.getUTCMonth(), ingreso.getUTCDate())).toISOString().slice(0, 10);
  }

  // Antes del año, lo disponible es solo lo que Personas haya ajustado (un adelanto pactado).
  const disponible = meses >= 12 ? Math.max(0, saldo) : Math.max(0, redondear(d.movimientos));

  return {
    mesesServicio: meses,
    aniosServicio: anios,
    diasProgresivosAnuales: progresivo,
    derechoAnual,
    devengado: redondear(devengado),
    movimientos: redondear(d.movimientos),
    saldo,
    disponible: Math.floor(disponible * 100) / 100,
    cumpleAnioEl,
    excedeAcumulacion: saldo > derechoAnual * 2,
  };
}
