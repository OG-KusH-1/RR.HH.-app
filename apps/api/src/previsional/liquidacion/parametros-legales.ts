/**
 * Parámetros legales estables que no se publican mes a mes.
 *
 * Todo lo que cambia con frecuencia (UF, UTM, topes, SIS, comisiones AFP,
 * tramos de impuesto) vive en la base de datos con fecha de vigencia
 * (tablas `indicadores_mensuales` y `tasas_afp`). Aquí solo quedan reglas que
 * fija directamente una ley y que, si cambian, exigen revisar el cálculo.
 *
 * ANTES DE MODIFICAR: cita la norma en el comentario y agrega un caso de prueba
 * en calculo.spec.ts con el valor nuevo.
 */

/** Cotización obligatoria a la cuenta individual (DL 3.500, art. 17). Se suma a la comisión de cada AFP. */
export const COTIZACION_OBLIGATORIA_AFP = 10;

/** Cotización legal de salud (Ley 18.469 y DFL 1 de 2005, art. 84). */
export const COTIZACION_SALUD_LEGAL = 7;

/**
 * Seguro de cesantía (Ley 19.728, art. 5), en porcentaje de la remuneración imponible
 * con tope propio. Los contratos a plazo fijo y por obra solo pagan el aporte del empleador.
 */
export const SEGURO_CESANTIA = {
  INDEFINIDO: { trabajador: 0.6, empleador: 2.4 },
  PLAZO_FIJO: { trabajador: 0, empleador: 3.0 },
  OBRA_FAENA: { trabajador: 0, empleador: 3.0 },
} as const;

/** Gratificación legal del art. 50 del Código del Trabajo: 25 % de lo devengado, con tope anual de 4,75 ingresos mínimos. */
export const GRATIFICACION = { porcentaje: 25, topeAnualIngresosMinimos: 4.75 } as const;

/** Recargo de las horas extraordinarias (Código del Trabajo, art. 32). */
export const RECARGO_HORAS_EXTRA = 50;

/** Días que la ley usa para el mes en remuneraciones y semanas por mes para el valor hora. */
export const DIAS_MES = 30;
export const SEMANAS_MES_VALOR_HORA = 4;
