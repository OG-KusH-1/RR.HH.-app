import { describe, expect, it } from 'vitest';
import { aCsv, calcularNovedades } from './novedades.js';
import { domingosLibresDelMes, horasTurno, lunesDe, revisarSemana, type TurnoDia } from './reglas-turnos.js';

const turno = (fecha: string, inicio = '09:00', fin = '17:30', colacionMin = 30): TurnoDia => ({ fecha, inicio, fin, colacionMin });
const ctx = { horasPactadas: 42, diasAusente: new Set<string>(), irrenunciables: new Map<string, string>() };

describe('turnos (HU-23)', () => {
  it('calcula horas efectivas descontando colación, también de noche', () => {
    expect(horasTurno(turno('2026-11-16'))).toBe(8);
    expect(horasTurno(turno('2026-11-16', '22:00', '06:00', 60))).toBe(7);
  });

  it('encuentra el lunes de la semana', () => {
    expect(lunesDe('2026-11-12')).toBe('2026-11-09');
    expect(lunesDe('2026-11-15')).toBe('2026-11-09');
    expect(lunesDe('2026-11-16')).toBe('2026-11-16');
  });

  it('una semana de 5 días de 8 horas está en regla con 42 pactadas', () => {
    const semana = ['16', '17', '18', '19', '20'].map((d) => turno(`2026-11-${d}`));
    expect(revisarSemana(semana, ctx)).toEqual({ horas: 40, problemas: [] });
  });

  it('avisa horas sobre la jornada pactada y más de 6 días', () => {
    const semana = ['16', '17', '18', '19', '20', '21', '22'].map((d) => turno(`2026-11-${d}`));
    const r = revisarSemana(semana, { ...ctx, horasPactadas: 30 });
    expect(r.horas).toBe(56);
    expect(r.problemas.map((p) => p.nivel)).toEqual(['alerta', 'alerta']);
    expect(r.problemas[1].mensaje).toContain('26 h');
  });

  it('avisa una jornada diaria sobre 10 horas', () => {
    const r = revisarSemana([turno('2026-11-16', '07:00', '19:00')], ctx);
    expect(r.problemas[0]).toMatchObject({ nivel: 'alerta', fecha: '2026-11-16' });
  });

  it('bloquea turnos en vacaciones y en feriados irrenunciables', () => {
    const r = revisarSemana([turno('2026-12-24'), turno('2026-12-25')], { ...ctx, diasAusente: new Set(['2026-12-24']), irrenunciables: new Map([['2026-12-25', 'Navidad']]) });
    expect(r.problemas.filter((p) => p.nivel === 'error').map((p) => p.fecha)).toEqual(['2026-12-24', '2026-12-25']);
  });

  it('cuenta domingos libres del mes (comercio: al menos 2)', () => {
    // Noviembre de 2026 tiene 5 domingos: 1, 8, 15, 22 y 29.
    expect(domingosLibresDelMes('2026-11', new Set(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22']))).toEqual({ domingos: 5, libres: 1 });
  });
});

describe('archivo de novedades (HU-22)', () => {
  const feriados = new Set(['2026-12-08', '2026-12-25']);
  const personas = [
    { rut: '1-9', nombre: 'Ana', sede: 'Tahai', fechaIngreso: '2020-01-01', fechaDesvinculacion: null },
    { rut: '2-7', nombre: 'Luis', sede: 'Tahai', fechaIngreso: '2026-12-10', fechaDesvinculacion: null },
    { rut: '3-5', nombre: 'Sin novedades', sede: 'Tahai', fechaIngreso: '2019-01-01', fechaDesvinculacion: null },
  ];

  it('recorta las ausencias al mes y separa hábiles de corridos', () => {
    const filas = calcularNovedades(
      '2026-12',
      personas,
      [
        // 28-dic-2026 al 8-ene-2027: en diciembre caen 28, 29, 30 y 31 = 4 hábiles.
        { rut: '1-9', codigo: 'VACACIONES', desde: '2026-12-28', hasta: '2027-01-08' },
        // Licencia del 25-nov al 3-dic: en diciembre, 3 días corridos.
        { rut: '1-9', codigo: 'LICENCIA_MEDICA', desde: '2026-11-25', hasta: '2026-12-03' },
      ],
      feriados,
      new Map([['2-7', 3.5]]),
    );
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ rut: '1-9', vacaciones: 4, licenciaDiasCorridos: 3 });
    expect(filas[1]).toMatchObject({ rut: '2-7', ingreso: '2026-12-10', horasSobreJornada: 3.5 });
  });

  it('genera un CSV que Excel abre con tildes y decimales chilenos', () => {
    const csv = aCsv([{ rut: '2-7', nombre: 'Luis; hijo', sede: 'Tahai', ingreso: '', salida: '', vacaciones: 0, permisoConGoce: 0, permisoSinGoce: 0, permisoLegal: 0, licenciaDiasCorridos: 0, horasSobreJornada: 3.5 }]);
    expect(csv.startsWith('﻿RUT;')).toBe(true);
    expect(csv).toContain('"Luis; hijo"');
    expect(csv).toContain(';3,5');
  });
});
