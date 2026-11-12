/**
 * Casos calculados a mano (ver docs/10-liquidaciones.md). Usan parámetros fijos
 * con números redondos para que cada valor esperado se pueda verificar con una calculadora.
 * Si cambias una regla, recalcula el caso a mano antes de tocar el valor esperado.
 */
import { calcularImpuestoUnico, calcularLiquidacion, valorHoraExtra, type DatosTrabajador, type ParametrosMes } from './calculo.js';
import { TRAMOS_IMPUESTO_2026 } from './tramos-impuesto.js';

const params: ParametrosMes = {
  periodo: '2026-11',
  uf: 40_000,
  utm: 70_000,
  ingresoMinimo: 553_553,
  topeImponibleAfpUf: 90,
  topeImponibleCesantiaUf: 135.2,
  tasaSis: 1.78,
  tasaEmpleadorReforma: 3.5,
  tasaAccidentes: 0.93,
  tramosImpuesto: TRAMOS_IMPUESTO_2026,
};

const base: DatosTrabajador = {
  sueldoBase: 800_000,
  diasTrabajados: 30,
  horasSemanales: 42,
  horasExtra: 0,
  bonosImponibles: 0,
  noImponibles: 0,
  tipoContrato: 'INDEFINIDO',
  afp: { nombre: 'Modelo', comision: 0.58 },
  salud: { tipo: 'FONASA', nombre: 'Fonasa', planUf: null },
};

const monto = (ls: { codigo: string; monto: number }[], codigo: string) => ls.find((l) => l.codigo === codigo)?.monto;

describe('Liquidación de referencia', () => {
  it('caso típico: sueldo bajo el tope, Fonasa, exento de impuesto', () => {
    const l = calcularLiquidacion(base, params);
    expect(monto(l.haberes, 'GRATIFICACION')).toBe(200_000); // 25 % de 800.000, bajo el tope
    expect(l.totales.imponible).toBe(1_000_000);
    expect(monto(l.descuentos, 'AFP')).toBe(105_800); // 10,58 %
    expect(monto(l.descuentos, 'SALUD')).toBe(70_000);
    expect(monto(l.descuentos, 'CESANTIA')).toBe(6_000);
    expect(l.totales.tributable).toBe(818_200); // 11,69 UTM: exento
    expect(monto(l.descuentos, 'IMPUESTO')).toBe(0);
    expect(l.totales.liquido).toBe(818_200);
    expect(l.totales.costoEmpresa).toBe(1_000_000 + 17_800 + 35_000 + 24_000 + 9_300);
  });

  it('sueldo alto: aplica el tope imponible de AFP y el tope de gratificación, y paga impuesto', () => {
    const l = calcularLiquidacion(
      { ...base, sueldoBase: 4_000_000, afp: { nombre: 'Habitat', comision: 1.27 }, salud: { tipo: 'ISAPRE', nombre: 'Isapre', planUf: 4 } },
      params,
    );
    expect(monto(l.haberes, 'GRATIFICACION')).toBe(219_115); // 4,75 × 553.553 / 12
    expect(l.totales.imponible).toBe(4_219_115);
    expect(l.bases.afpSalud).toBe(3_600_000); // 90 UF × 40.000
    expect(monto(l.descuentos, 'AFP')).toBe(405_720);
    expect(monto(l.descuentos, 'SALUD')).toBe(252_000); // el 7 % supera el plan de 160.000
    expect(monto(l.descuentos, 'CESANTIA')).toBe(25_315);
    expect(l.totales.tributable).toBe(3_536_080); // 50,52 UTM: tramo 13,5 %
    expect(monto(l.descuentos, 'IMPUESTO')).toBe(163_071);
    expect(l.totales.liquido).toBe(3_373_009);
  });

  it('Isapre con plan mayor al 7 %: descuenta el plan, pero solo rebaja el 7 % del impuesto', () => {
    const l = calcularLiquidacion({ ...base, sueldoBase: 600_000, salud: { tipo: 'ISAPRE', nombre: 'Isapre', planUf: 3 } }, params);
    expect(l.totales.imponible).toBe(750_000);
    expect(monto(l.descuentos, 'SALUD')).toBe(120_000);
    // tributable = 750.000 − AFP 79.350 − 7 % legal 52.500 − cesantía 4.500
    expect(l.totales.tributable).toBe(613_650);
  });

  it('plazo fijo: el trabajador no paga cesantía y el empleador paga 3 %', () => {
    const l = calcularLiquidacion({ ...base, tipoContrato: 'PLAZO_FIJO' }, params);
    expect(monto(l.descuentos, 'CESANTIA')).toBeUndefined();
    expect(monto(l.aportesEmpleador, 'CESANTIA_EMP')).toBe(30_000);
  });

  it('horas extra con 50 % de recargo', () => {
    expect(valorHoraExtra(840_000, 42)).toBeCloseTo(7_000, 6);
    const l = calcularLiquidacion({ ...base, sueldoBase: 840_000, horasExtra: 10 }, params);
    expect(monto(l.haberes, 'HORAS_EXTRA')).toBe(70_000);
  });

  it('mes incompleto: sueldo y tope de gratificación proporcionales', () => {
    const l = calcularLiquidacion({ ...base, diasTrabajados: 15 }, params);
    expect(monto(l.haberes, 'SUELDO')).toBe(400_000);
    expect(monto(l.haberes, 'GRATIFICACION')).toBe(100_000);
  });

  it('rechaza días fuera de rango', () => {
    expect(() => calcularLiquidacion({ ...base, diasTrabajados: 31 }, params)).toThrow(RangeError);
  });
});

describe('Impuesto único', () => {
  it('es cero hasta 13,5 UTM y nunca negativo', () => {
    expect(calcularImpuestoUnico(13.5 * 70_000, 70_000, TRAMOS_IMPUESTO_2026).monto).toBe(0);
    expect(calcularImpuestoUnico(13.6 * 70_000, 70_000, TRAMOS_IMPUESTO_2026).monto).toBe(280);
  });

  it('usa el último tramo sobre 310 UTM', () => {
    const r = calcularImpuestoUnico(400 * 70_000, 70_000, TRAMOS_IMPUESTO_2026);
    expect(r.tramo.factor).toBe(40);
    expect(r.monto).toBe(Math.round(28_000_000 * 0.4 - 38.82 * 70_000));
  });
});
