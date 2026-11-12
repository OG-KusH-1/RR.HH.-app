/**
 * Cálculo de una liquidación de sueldo de REFERENCIA (épica E10, HU-29).
 *
 * Es una función pura: recibe los datos del trabajador y los parámetros del mes,
 * y devuelve cada línea con la fórmula que la produjo. No lee la base de datos
 * ni la hora actual, así se puede probar con casos fijos y recalcular cualquier
 * mes pasado con sus propios parámetros.
 *
 * Alcance actual, a propósito acotado:
 * - Trabajadores dependientes afiliados a AFP (no IPS ni pensionados).
 * - Gratificación del art. 50 pagada mensualmente con tope.
 * - Sin licencias médicas parciales, anticipos, préstamos, APV ni cargas familiares.
 * Cada exclusión está listada en `LIMITACIONES` para mostrarla en la interfaz.
 *
 * Redondeo: cada línea se redondea al peso, como en la planilla de Previred.
 * Los totales se suman con las líneas ya redondeadas, para que cuadren a la vista.
 */
import type { TramoImpuesto } from '../../db/schema.js';
import {
  COTIZACION_OBLIGATORIA_AFP,
  COTIZACION_SALUD_LEGAL,
  DIAS_MES,
  GRATIFICACION,
  RECARGO_HORAS_EXTRA,
  SEGURO_CESANTIA,
  SEMANAS_MES_VALOR_HORA,
} from './parametros-legales.js';

export type TipoContrato = keyof typeof SEGURO_CESANTIA;

export interface DatosTrabajador {
  /** Sueldo base mensual pactado para el mes completo, en pesos. */
  sueldoBase: number;
  /** Días trabajados en el mes (0 a 30). */
  diasTrabajados: number;
  /** Jornada semanal pactada, en horas. */
  horasSemanales: number;
  /** Horas extraordinarias del mes. */
  horasExtra: number;
  /** Bonos y comisiones imponibles del mes, en pesos. */
  bonosImponibles: number;
  /** Asignaciones no imponibles (colación, movilización), en pesos. */
  noImponibles: number;
  tipoContrato: TipoContrato;
  afp: { nombre: string; comision: number };
  salud: { tipo: 'FONASA' | 'ISAPRE'; nombre: string; planUf: number | null };
}

export interface ParametrosMes {
  periodo: string;
  uf: number;
  utm: number;
  ingresoMinimo: number;
  topeImponibleAfpUf: number;
  topeImponibleCesantiaUf: number;
  tasaSis: number;
  tasaEmpleadorReforma: number;
  tasaAccidentes: number;
  tramosImpuesto: TramoImpuesto[];
}

export interface Linea {
  codigo: string;
  concepto: string;
  monto: number;
  /** Fórmula legible con los valores usados, para auditar el cálculo. */
  detalle: string;
}

export interface Liquidacion {
  periodo: string;
  haberes: Linea[];
  descuentos: Linea[];
  aportesEmpleador: Linea[];
  totales: {
    imponible: number;
    noImponible: number;
    tributable: number;
    descuentos: number;
    liquido: number;
    aportesEmpleador: number;
    costoEmpresa: number;
  };
  bases: { afpSalud: number; cesantia: number; topeAfpPesos: number; topeCesantiaPesos: number };
}

export const LIMITACIONES = [
  'No considera licencias médicas, anticipos, préstamos ni descuentos voluntarios.',
  'No considera APV, cuenta 2 ni asignación familiar.',
  'Supone afiliación a AFP; no aplica a afiliados al IPS ni a pensionados.',
  'La gratificación se calcula mensualmente con el tope del art. 50, proporcional a los días trabajados.',
] as const;

const redondear = (n: number) => Math.round(n);
const pesos = (n: number) => `$${redondear(n).toLocaleString('es-CL')}`;
const pct = (n: number) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 3 })} %`;

/**
 * Impuesto único de segunda categoría.
 * Fórmula del SII: base × factor − rebaja, con factor y rebaja del tramo en que cae la base medida en UTM.
 */
export function calcularImpuestoUnico(baseTributable: number, utm: number, tramos: TramoImpuesto[]): { monto: number; tramo: TramoImpuesto } {
  const enUtm = baseTributable / utm;
  const tramo = tramos.find((t) => enUtm > t.desdeUtm && (t.hastaUtm === null || enUtm <= t.hastaUtm)) ?? tramos[0];
  const monto = Math.max(0, redondear((baseTributable * tramo.factor) / 100 - tramo.rebajaUtm * utm));
  return { monto, tramo };
}

/** Valor de una hora extra: (sueldo / 30 × 28) / (4 × jornada semanal) × 1,5. */
export function valorHoraExtra(sueldoBase: number, horasSemanales: number): number {
  const valorHoraOrdinaria = ((sueldoBase / DIAS_MES) * 28) / (SEMANAS_MES_VALOR_HORA * horasSemanales);
  return valorHoraOrdinaria * (1 + RECARGO_HORAS_EXTRA / 100);
}

export function calcularLiquidacion(d: DatosTrabajador, p: ParametrosMes): Liquidacion {
  if (d.diasTrabajados < 0 || d.diasTrabajados > DIAS_MES) throw new RangeError('Los días trabajados deben estar entre 0 y 30.');
  if (d.horasSemanales <= 0) throw new RangeError('La jornada semanal debe ser mayor que cero.');

  // ---- Haberes -------------------------------------------------------------
  const sueldo = redondear((d.sueldoBase * d.diasTrabajados) / DIAS_MES);
  const vhe = valorHoraExtra(d.sueldoBase, d.horasSemanales);
  const horasExtra = redondear(vhe * d.horasExtra);
  const devengado = sueldo + horasExtra + d.bonosImponibles;

  const topeGratificacion =
    (GRATIFICACION.topeAnualIngresosMinimos * p.ingresoMinimo) / 12 * (d.diasTrabajados / DIAS_MES);
  const gratificacion = redondear(Math.min((devengado * GRATIFICACION.porcentaje) / 100, topeGratificacion));

  const haberes: Linea[] = [
    { codigo: 'SUELDO', concepto: 'Sueldo base', monto: sueldo, detalle: `${pesos(d.sueldoBase)} × ${d.diasTrabajados}/30 días` },
  ];
  if (horasExtra > 0) {
    haberes.push({ codigo: 'HORAS_EXTRA', concepto: 'Horas extraordinarias', monto: horasExtra, detalle: `${d.horasExtra} h × ${pesos(vhe)} (valor hora con 50 % de recargo)` });
  }
  if (d.bonosImponibles > 0) {
    haberes.push({ codigo: 'BONOS', concepto: 'Bonos imponibles', monto: d.bonosImponibles, detalle: 'Informado para el mes' });
  }
  haberes.push({
    codigo: 'GRATIFICACION',
    concepto: 'Gratificación legal (art. 50)',
    monto: gratificacion,
    detalle: `25 % de ${pesos(devengado)}, con tope de ${pesos(topeGratificacion)} (4,75 ingresos mínimos al año)`,
  });
  if (d.noImponibles > 0) {
    haberes.push({ codigo: 'NO_IMPONIBLE', concepto: 'Colación y movilización', monto: d.noImponibles, detalle: 'No imponible ni tributable' });
  }

  const imponible = devengado + gratificacion;

  // ---- Bases con tope --------------------------------------------------------
  // El tope en pesos se calcula con la UF del último día del mes (criterio Previred).
  const topeAfpPesos = redondear(p.topeImponibleAfpUf * p.uf);
  const topeCesantiaPesos = redondear(p.topeImponibleCesantiaUf * p.uf);
  const baseAfp = Math.min(imponible, topeAfpPesos);
  const baseCesantia = Math.min(imponible, topeCesantiaPesos);

  // ---- Descuentos del trabajador --------------------------------------------
  const tasaAfp = COTIZACION_OBLIGATORIA_AFP + d.afp.comision;
  const afp = redondear((baseAfp * tasaAfp) / 100);

  // Salud: el 7 % legal se rebaja de la base tributable; lo que el plan de Isapre
  // exceda del 7 % es un descuento adicional que NO se rebaja del impuesto.
  const saludLegal = redondear((baseAfp * COTIZACION_SALUD_LEGAL) / 100);
  const planPesos = d.salud.tipo === 'ISAPRE' && d.salud.planUf ? redondear(d.salud.planUf * p.uf) : 0;
  const saludTotal = Math.max(saludLegal, planPesos);
  const saludAdicional = saludTotal - saludLegal;

  const tasasCesantia = SEGURO_CESANTIA[d.tipoContrato];
  const cesantia = redondear((baseCesantia * tasasCesantia.trabajador) / 100);

  const tributable = imponible - afp - saludLegal - cesantia;
  const impuesto = calcularImpuestoUnico(tributable, p.utm, p.tramosImpuesto);

  const descuentos: Linea[] = [
    { codigo: 'AFP', concepto: `AFP ${d.afp.nombre}`, monto: afp, detalle: `${pct(tasaAfp)} (10 % + ${pct(d.afp.comision)} de comisión) sobre ${pesos(baseAfp)}` },
    {
      codigo: 'SALUD',
      concepto: d.salud.nombre,
      monto: saludTotal,
      detalle:
        saludAdicional > 0
          ? `Plan de ${d.salud.planUf!.toLocaleString('es-CL')} UF = ${pesos(planPesos)}; supera el 7 % legal (${pesos(saludLegal)}) en ${pesos(saludAdicional)}`
          : `7 % sobre ${pesos(baseAfp)}`,
    },
  ];
  if (cesantia > 0) {
    descuentos.push({ codigo: 'CESANTIA', concepto: 'Seguro de cesantía', monto: cesantia, detalle: `${pct(tasasCesantia.trabajador)} sobre ${pesos(baseCesantia)}` });
  }
  descuentos.push({
    codigo: 'IMPUESTO',
    concepto: 'Impuesto único',
    monto: impuesto.monto,
    detalle:
      impuesto.monto === 0
        ? `Base tributable de ${pesos(tributable)} (${(tributable / p.utm).toLocaleString('es-CL', { maximumFractionDigits: 2 })} UTM): exenta`
        : `${pesos(tributable)} × ${pct(impuesto.tramo.factor)} − ${impuesto.tramo.rebajaUtm} UTM de rebaja`,
  });

  // ---- Aportes del empleador (no se descuentan al trabajador) ---------------
  const sis = redondear((baseAfp * p.tasaSis) / 100);
  const reforma = redondear((baseAfp * p.tasaEmpleadorReforma) / 100);
  const cesantiaEmpleador = redondear((baseCesantia * tasasCesantia.empleador) / 100);
  const accidentes = redondear((baseAfp * p.tasaAccidentes) / 100);
  const aportesEmpleador: Linea[] = [
    { codigo: 'SIS', concepto: 'Seguro de invalidez y sobrevivencia', monto: sis, detalle: `${pct(p.tasaSis)} sobre ${pesos(baseAfp)}` },
    { codigo: 'REFORMA', concepto: 'Cotización empleador Ley 21.735', monto: reforma, detalle: `${pct(p.tasaEmpleadorReforma)} sobre ${pesos(baseAfp)}` },
    { codigo: 'CESANTIA_EMP', concepto: 'Seguro de cesantía, aporte empleador', monto: cesantiaEmpleador, detalle: `${pct(tasasCesantia.empleador)} sobre ${pesos(baseCesantia)}` },
    { codigo: 'ACCIDENTES', concepto: 'Seguro de accidentes del trabajo', monto: accidentes, detalle: `${pct(p.tasaAccidentes)} sobre ${pesos(baseAfp)}` },
  ];

  const suma = (ls: Linea[]) => ls.reduce((s, l) => s + l.monto, 0);
  const totalDescuentos = suma(descuentos);
  const totalAportes = suma(aportesEmpleador);

  return {
    periodo: p.periodo,
    haberes,
    descuentos,
    aportesEmpleador,
    totales: {
      imponible,
      noImponible: d.noImponibles,
      tributable,
      descuentos: totalDescuentos,
      liquido: imponible + d.noImponibles - totalDescuentos,
      aportesEmpleador: totalAportes,
      costoEmpresa: imponible + d.noImponibles + totalAportes,
    },
    bases: { afpSalud: baseAfp, cesantia: baseCesantia, topeAfpPesos, topeCesantiaPesos },
  };
}
