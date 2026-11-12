/**
 * Pruebas de las reglas de vacaciones. Cada caso se calculó a mano con el calendario de 2026;
 * el detalle de los cálculos está en docs/12-vacaciones-y-documentos.md.
 */
import { describe, expect, it } from 'vitest';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { contarDiasHabiles, seCruzan, sumarDias } from './calendario-laboral.js';
import { puedeResolver, puedeVerDetalleReservado, validarSolicitud, type EntradaValidacion } from './reglas-solicitud.js';
import { calcularSaldo, diasProgresivos, mesesCompletos } from './saldo-vacaciones.js';

const FERIADOS = new Set(['2026-09-18', '2026-09-19', '2026-12-08', '2026-12-25']);

describe('días hábiles para el feriado (art. 69: sábado inhábil)', () => {
  it('descuenta fines de semana y Navidad', () => {
    // 21 al 31 de diciembre de 2026: 9 días de lunes a viernes, menos el 25.
    expect(contarDiasHabiles('2026-12-21', '2026-12-31', FERIADOS)).toBe(8);
  });

  it('descuenta Fiestas Patrias', () => {
    // 14 al 20 de septiembre: lunes a jueves cuentan; el viernes 18 es feriado.
    expect(contarDiasHabiles('2026-09-14', '2026-09-20', FERIADOS)).toBe(4);
  });

  it('un fin de semana no consume días', () => {
    expect(contarDiasHabiles('2026-11-14', '2026-11-15', FERIADOS)).toBe(0);
  });

  it('suma días cruzando el cambio de mes y de año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('detecta rangos que se cruzan por un solo día', () => {
    expect(seCruzan('2026-12-01', '2026-12-10', '2026-12-10', '2026-12-15')).toBe(true);
    expect(seCruzan('2026-12-01', '2026-12-09', '2026-12-10', '2026-12-15')).toBe(false);
  });
});

describe('saldo de vacaciones', () => {
  it('cuenta meses completos', () => {
    expect(mesesCompletos('2025-01-15', '2026-01-15')).toBe(12);
    expect(mesesCompletos('2025-01-31', '2025-02-28')).toBe(0);
  });

  it('devenga 1,25 días por mes y resta lo tomado', () => {
    // Ingreso 1-mar-2024, corte 12-nov-2026: 32 meses × 15/12 = 40 días; tomó 25.
    const s = calcularSaldo({ fechaIngreso: '2024-03-01', aniosPrevios: 0, fechaCorte: '2026-11-12', movimientos: -25 });
    expect(s.devengado).toBe(40);
    expect(s.saldo).toBe(15);
    expect(s.disponible).toBe(15);
    expect(s.derechoAnual).toBe(15);
  });

  it('suma el feriado progresivo desde que se cumple cada tramo de 3 años', () => {
    // 10 años previos + 6 en la empresa: meses 1-35 a 15 días/año, 36-71 a 16 y el 72 a 17.
    // 35 × 15/12 + 36 × 16/12 + 17/12 = 43,75 + 48 + 1,4167 = 93,17.
    const s = calcularSaldo({ fechaIngreso: '2020-01-01', aniosPrevios: 10, fechaCorte: '2026-01-01', movimientos: 0 });
    expect(s.devengado).toBe(93.17);
    expect(s.derechoAnual).toBe(17);
  });

  it('solo reconoce hasta 10 años con empleadores anteriores', () => {
    expect(diasProgresivos(0, 15)).toBe(0);
    expect(diasProgresivos(3, 15)).toBe(1);
    expect(diasProgresivos(3, 4)).toBe(0);
  });

  it('antes del primer año no hay días disponibles, salvo ajuste de Personas', () => {
    const sin = calcularSaldo({ fechaIngreso: '2026-05-10', aniosPrevios: 0, fechaCorte: '2026-11-12', movimientos: 0 });
    expect(sin.devengado).toBe(7.5);
    expect(sin.disponible).toBe(0);
    expect(sin.cumpleAnioEl).toBe('2027-05-10');
    const conAdelanto = calcularSaldo({ fechaIngreso: '2026-05-10', aniosPrevios: 0, fechaCorte: '2026-11-12', movimientos: 5 });
    expect(conAdelanto.disponible).toBe(5);
  });

  it('avisa cuando se acumulan más de dos períodos (art. 70)', () => {
    const s = calcularSaldo({ fechaIngreso: '2023-01-01', aniosPrevios: 0, fechaCorte: '2026-01-01', movimientos: -4 });
    // 36 meses = 45 días devengados, menos 4 = 41 > 30.
    expect(s.saldo).toBe(41);
    expect(s.excedeAcumulacion).toBe(true);
  });
});

describe('validación de solicitudes (HU-09)', () => {
  const vacaciones = { codigo: 'VACACIONES', afectaSaldo: true, permiteRetroactivo: false };
  const licencia = { codigo: 'LICENCIA_MEDICA', afectaSaldo: false, permiteRetroactivo: true };
  const base: EntradaValidacion = {
    tipo: vacaciones,
    desde: '2026-12-21',
    hasta: '2026-12-31',
    hoy: '2026-11-12',
    feriados: FERIADOS,
    disponible: 10,
    existentes: [],
  };

  it('acepta una solicitud válida y cuenta 8 días hábiles', () => {
    const r = validarSolicitud(base);
    expect(r.problemas).toEqual([]);
    expect(r.diasHabiles).toBe(8);
    expect(r.diasCorridos).toBe(11);
  });

  it('informa cuántos días faltan', () => {
    const r = validarSolicitud({ ...base, disponible: 5 });
    expect(r.problemas[0]).toContain('Te faltan 3 días');
  });

  it('rechaza el cruce con otra solicitud aprobada o pendiente, pero no con una rechazada', () => {
    expect(validarSolicitud({ ...base, existentes: [{ desde: '2026-12-30', hasta: '2027-01-05', estado: 'APROBADA' }] }).problemas).toHaveLength(1);
    expect(validarSolicitud({ ...base, existentes: [{ desde: '2026-12-30', hasta: '2027-01-05', estado: 'RECHAZADA' }] }).problemas).toHaveLength(0);
  });

  it('no permite vacaciones en fechas pasadas, pero sí informar una licencia retroactiva', () => {
    expect(validarSolicitud({ ...base, desde: '2026-11-02', hasta: '2026-11-06' }).problemas[0]).toContain('ya pasaron');
    expect(validarSolicitud({ ...base, tipo: licencia, desde: '2026-11-02', hasta: '2026-11-08' }).problemas).toEqual([]);
  });

  it('rechaza vacaciones que solo caen en fin de semana', () => {
    expect(validarSolicitud({ ...base, desde: '2026-11-14', hasta: '2026-11-15' }).problemas[0]).toContain('no incluye días hábiles');
  });
});

describe('quién resuelve una solicitud (HU-10)', () => {
  const usuario = (rol: UsuarioAutenticado['rol'], trabajadorId: string): UsuarioAutenticado => ({
    id: `u-${trabajadorId}`,
    trabajadorId,
    empresaId: 'e1',
    sedeId: 's1',
    rol,
    rut: '1-9',
    nombres: 'X',
    apellidos: 'Y',
    cargo: 'Z',
  });
  const cajera = { id: 't-cajera', empresaId: 'e1', jefaturaId: 't-jefa' };

  it('la jefatura directa puede, otra jefatura no', () => {
    expect(puedeResolver(usuario('JEFATURA', 't-jefa'), cajera)).toBe(true);
    expect(puedeResolver(usuario('JEFATURA', 't-otro-jefe'), cajera)).toBe(false);
  });

  it('nadie resuelve su propia solicitud, ni siquiera Personas', () => {
    expect(puedeResolver(usuario('PERSONAS', 't-cajera'), cajera)).toBe(false);
    expect(puedeResolver(usuario('JEFATURA', 't-jefa'), { id: 't-jefa', empresaId: 'e1', jefaturaId: 't-gerente' })).toBe(false);
  });

  it('Personas y Gerencia sirven de respaldo; otra empresa nunca', () => {
    expect(puedeResolver(usuario('GERENCIA', 't-gerente'), cajera)).toBe(true);
    expect(puedeResolver(usuario('PERSONAS', 't-personas'), { ...cajera, empresaId: 'e2' })).toBe(false);
  });

  it('el diagnóstico de una licencia solo lo ven el titular y Personas', () => {
    expect(puedeVerDetalleReservado(usuario('JEFATURA', 't-jefa'), cajera)).toBe(false);
    expect(puedeVerDetalleReservado(usuario('GERENCIA', 't-gerente'), cajera)).toBe(false);
    expect(puedeVerDetalleReservado(usuario('PERSONAS', 't-personas'), cajera)).toBe(true);
    expect(puedeVerDetalleReservado(usuario('TRABAJADOR', 't-cajera'), cajera)).toBe(true);
  });
});
