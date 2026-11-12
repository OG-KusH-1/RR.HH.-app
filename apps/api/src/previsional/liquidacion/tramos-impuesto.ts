import type { TramoImpuesto } from '../../db/schema.js';

/**
 * Tramos del impuesto único de segunda categoría (Ley sobre Impuesto a la Renta, art. 43 N°1),
 * vigentes desde la Ley 21.210 de 2020. El SII los publica cada mes en pesos;
 * en UTM no cambian salvo reforma legal. Se copian a `indicadores_mensuales.tramos_impuesto`
 * para que cada mes guarde los tramos con que se calculó.
 */
export const TRAMOS_IMPUESTO_2026: TramoImpuesto[] = [
  { desdeUtm: 0, hastaUtm: 13.5, factor: 0, rebajaUtm: 0 },
  { desdeUtm: 13.5, hastaUtm: 30, factor: 4, rebajaUtm: 0.54 },
  { desdeUtm: 30, hastaUtm: 50, factor: 8, rebajaUtm: 1.74 },
  { desdeUtm: 50, hastaUtm: 70, factor: 13.5, rebajaUtm: 4.49 },
  { desdeUtm: 70, hastaUtm: 90, factor: 23, rebajaUtm: 11.14 },
  { desdeUtm: 90, hastaUtm: 120, factor: 30.4, rebajaUtm: 17.8 },
  { desdeUtm: 120, hastaUtm: 310, factor: 35, rebajaUtm: 23.32 },
  { desdeUtm: 310, hastaUtm: null, factor: 40, rebajaUtm: 38.82 },
];
