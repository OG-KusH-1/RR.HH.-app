import { describe, expect, it } from 'vitest';
import { base32Codificar, base32Decodificar, codigoEn, verificarCodigo } from '../auth/totp.js';
import { leerPlanilla, normalizarFecha, separarLinea } from './planilla.js';

describe('TOTP (RFC 6238, apéndice B)', () => {
  // Semilla oficial del RFC para SHA-1: "12345678901234567890" en ASCII.
  const semilla = Buffer.from('12345678901234567890');

  it('reproduce los vectores de prueba del RFC con 8 dígitos', () => {
    const vectores: [number, string][] = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ];
    for (const [t, esperado] of vectores) expect(codigoEn(semilla, Math.floor(t / 30), 'sha1', 8)).toBe(esperado);
  });

  it('acepta el código de la ventana anterior y siguiente, no de dos ventanas atrás', () => {
    const secreto = base32Codificar(semilla);
    const ahora = 1_111_111_111_000;
    const actual = codigoEn(semilla, Math.floor(ahora / 30_000));
    const anterior = codigoEn(semilla, Math.floor(ahora / 30_000) - 1);
    const viejo = codigoEn(semilla, Math.floor(ahora / 30_000) - 2);
    expect(verificarCodigo(secreto, actual, ahora)).toBe(true);
    expect(verificarCodigo(secreto, anterior, ahora)).toBe(true);
    expect(verificarCodigo(secreto, viejo, ahora)).toBe(false);
    expect(verificarCodigo(secreto, 'abc123', ahora)).toBe(false);
  });

  it('base32 ida y vuelta', () => {
    expect(base32Decodificar(base32Codificar(semilla)).equals(semilla)).toBe(true);
    expect(base32Codificar(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
});

describe('planilla de carga inicial (HU-07)', () => {
  const ctx = { sedes: ['Distribuidora', 'Bodega Santiago'], rutsExistentes: new Set(['12400137-4']), hoy: '2026-11-12' };
  const encabezado = 'rut;nombres;apellidos;cargo;sede;fecha_ingreso;tipo_contrato;horas_semanales;rut_jefatura;fecha_termino_contrato;saldo_vacaciones';

  it('separa campos respetando comillas', () => {
    expect(separarLinea('a;"Pérez; Juan";"dijo ""hola"""', ';')).toEqual(['a', 'Pérez; Juan', 'dijo "hola"']);
  });

  it('acepta fechas chilenas y rechaza imposibles', () => {
    expect(normalizarFecha('05-03-2021')).toBe('2021-03-05');
    expect(normalizarFecha('2021-03-05')).toBe('2021-03-05');
    expect(normalizarFecha('31-02-2024')).toBeNull();
  });

  it('lee una planilla válida con punto y coma y jefatura en la misma planilla', () => {
    const csv = [
      encabezado,
      '11.111.111-1;Ana;Pérez;Jefa de bodega;distribuidora;01-02-2020;Indefinido;42;12400137-4;;12,5',
      '22222222-2;Luis;Soto;Bodeguero;Distribuidora;2025-06-01;plazo fijo;42;11111111-1;2026-12-31;',
    ].join('\n');
    const r = leerPlanilla(csv, ctx);
    expect(r.errores).toEqual([]);
    expect(r.filas[0]).toMatchObject({ rut: '11111111-1', sede: 'Distribuidora', fechaIngreso: '2020-02-01', tipoContrato: 'INDEFINIDO', saldoVacaciones: 12.5 });
    expect(r.filas[1]).toMatchObject({ tipoContrato: 'PLAZO_FIJO', rutJefatura: '11111111-1', fechaTerminoContrato: '2026-12-31' });
  });

  it('informa cada error con su fila y no devuelve filas parciales como válidas', () => {
    const csv = [
      encabezado,
      '12400137-4;Rodrigo;Pakarati;Gerente;Distribuidora;2015-01-01;indefinido;42;;;',
      '11111111-2;X;Y;Z;Valparaíso;2027-01-01;temporal;45;;;',
      '33333333-3;Ana;Ríos;Cajera;Distribuidora;2024-01-01;plazo fijo;30;99999999-9;;',
    ].join('\n');
    const r = leerPlanilla(csv, ctx);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4]);
    expect(r.errores[0].mensaje).toContain('ya tiene ficha');
    expect(r.errores[1].mensaje).toContain('RUT inválido');
    expect(r.errores[1].mensaje).toContain('Sede desconocida');
    expect(r.errores[1].mensaje).toContain('máximo 42');
    expect(r.errores[2].mensaje).toContain('plazo fijo necesita fecha de término');
  });

  it('exige las columnas obligatorias', () => {
    expect(leerPlanilla('rut,nombres\n1-9,Ana', ctx).errores[0].mensaje).toContain('Faltan columnas');
  });
});
