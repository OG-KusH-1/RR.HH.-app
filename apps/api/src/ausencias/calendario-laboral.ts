/**
 * Calendario laboral para el cómputo del feriado (vacaciones).
 *
 * Regla legal: el feriado se cuenta en días hábiles y, "para los efectos del feriado,
 * el día sábado se considerará siempre inhábil" (art. 69 del Código del Trabajo).
 * Por eso un día hábil aquí es de lunes a viernes y no es feriado legal, aunque la
 * persona trabaje los sábados (cajeros, reponedores).
 *
 * Las fechas se manejan como texto "AAAA-MM-DD" y se operan en UTC a propósito:
 * un día de vacaciones es un día del calendario, no un instante, y así no hay
 * corrimientos por zona horaria (Rapa Nui está dos horas detrás de Santiago).
 */

const DIA_MS = 86_400_000;

export function aFecha(texto: string): Date {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(texto: string, dias: number): string {
  return aTexto(new Date(aFecha(texto).getTime() + dias * DIA_MS));
}

/** Días corridos entre dos fechas, ambas incluidas. */
export function diasCorridos(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / DIA_MS) + 1;
}

export function esFinDeSemana(texto: string): boolean {
  const dia = aFecha(texto).getUTCDay();
  return dia === 0 || dia === 6;
}

export function esHabilParaFeriado(texto: string, feriados: ReadonlySet<string>): boolean {
  return !esFinDeSemana(texto) && !feriados.has(texto);
}

/** Días hábiles para el feriado entre dos fechas, ambas incluidas. 0 si el rango está invertido. */
export function contarDiasHabiles(desde: string, hasta: string, feriados: ReadonlySet<string>): number {
  if (desde > hasta) return 0;
  let total = 0;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (esHabilParaFeriado(f, feriados)) total++;
  }
  return total;
}

/** Verdadero si los rangos [a1, a2] y [b1, b2] comparten al menos un día. */
export function seCruzan(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && b1 <= a2;
}

/** Fecha de hoy en una zona horaria IANA. Cada sede tiene la suya (ADR-0004). */
export function hoyEn(zonaHoraria: string, ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(ahora);
}

/** Primer y último día de un mes "AAAA-MM". */
export function limitesDelMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}
