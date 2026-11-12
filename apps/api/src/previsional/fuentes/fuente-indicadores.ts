/**
 * Fuentes externas de indicadores económicos (patrón adaptador).
 *
 * Cada fuente implementa la misma interfaz; `IndicadoresService` las prueba en
 * orden y usa la primera que responde. Agregar una fuente nueva = una clase más
 * en este directorio y registrarla en `previsional.module.ts`. El resto del
 * sistema no cambia.
 *
 * Qué NO viene de aquí: comisiones AFP, SIS, topes y tasas de la reforma. Ningún
 * organismo los publica en una API; se cargan como tasas con vigencia
 * (`tasas_afp`, `indicadores_mensuales`) y Personas los confirma cada mes contra
 * la tabla de Previred. Ver docs/10-liquidaciones.md.
 */
export interface ValorIndicador {
  valor: number;
  /** Fecha a la que corresponde el valor, AAAA-MM-DD. */
  fecha: string;
  /** Nombre legible de la fuente, se guarda junto al valor. */
  fuente: string;
}

export interface FuenteIndicadores {
  readonly nombre: string;
  /** UF de un día específico. */
  uf(fecha: string): Promise<ValorIndicador>;
  /** UTM de un mes ("AAAA-MM"). */
  utm(periodo: string): Promise<ValorIndicador>;
}

export const FUENTES_INDICADORES = Symbol('FUENTES_INDICADORES');

/** Convierte "41.274,20" (formato chileno) a 41274.2. */
export function parsearNumeroChileno(texto: string): number {
  const n = Number(texto.trim().replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new Error(`Número con formato inesperado: "${texto}"`);
  return n;
}

/** fetch con tiempo límite: una fuente lenta no debe bloquear la sincronización. */
export async function obtenerJson(url: string, msLimite = 8_000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(msLimite), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
  return res.json();
}
