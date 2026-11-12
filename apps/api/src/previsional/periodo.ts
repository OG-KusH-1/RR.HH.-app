/** Utilidades de períodos "AAAA-MM" en hora de Chile continental (la de la Dirección del Trabajo y Previred). */

const ZONA = 'America/Santiago';

export function periodoActual(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit' }).formatToParts(ahora);
  const a = partes.find((p) => p.type === 'year')!.value;
  const m = partes.find((p) => p.type === 'month')!.value;
  return `${a}-${m}`;
}

export function hoyEnChile(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);
}

export function periodoAnterior(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export function ultimoDiaDelMes(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${periodo}-${String(dia).padStart(2, '0')}`;
}

export function esPeriodoValido(periodo: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
}
