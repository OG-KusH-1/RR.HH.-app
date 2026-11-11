import { calcularDv, formatearRut, normalizarRut } from './rut.js';

describe('RUT', () => {
  it('calcula el dígito verificador', () => {
    expect(calcularDv('11111111')).toBe('1');
    expect(calcularDv('12345678')).toBe('5');
    expect(calcularDv('10000013')).toBe('K');
    expect(calcularDv('10000004')).toBe('0');
  });

  it('acepta distintos formatos de entrada', () => {
    expect(normalizarRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizarRut('123456785')).toBe('12345678-5');
    expect(normalizarRut(' 10.000.013-k ')).toBe('10000013-K');
  });

  it('rechaza formato o dígito verificador inválidos', () => {
    expect(normalizarRut('12.345.678-9')).toBeNull();
    expect(normalizarRut('abc')).toBeNull();
    expect(normalizarRut('')).toBeNull();
    expect(normalizarRut('123')).toBeNull();
  });

  it('formatea con puntos', () => {
    expect(formatearRut('12345678-5')).toBe('12.345.678-5');
    expect(formatearRut('8000002-2')).toBe('8.000.002-2');
  });
});
