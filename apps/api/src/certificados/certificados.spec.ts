import { describe, expect, it } from 'vitest';
import { enmascararRut, generarCodigo } from './certificados.module.js';

describe('certificados verificables', () => {
  it('genera códigos de 12 caracteres sin letras confundibles', () => {
    const codigo = generarCodigo(Buffer.from('0123456789abcdef', 'hex'));
    expect(codigo).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(generarCodigo()).not.toBe(generarCodigo());
  });

  it('el mismo azar produce el mismo código (es determinista)', () => {
    const b = Buffer.from('ffffffffffffffff', 'hex');
    expect(generarCodigo(b)).toBe(generarCodigo(b));
  });

  it('oculta la mayor parte del RUT en la verificación pública', () => {
    expect(enmascararRut('12403288-1')).toBe('12.4**.***-1');
    expect(enmascararRut('9876543-K')).toBe('9.87*.***-K');
  });
});
