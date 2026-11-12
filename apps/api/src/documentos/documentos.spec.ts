import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { cifrar, descifrar } from '../common/cifrado.js';
import { detectarTipo, faltantes, firmarEnlace, limpiarNombre, puedeVerDocumento, umbralAviso, verificarEnlace, visibilidadesPermitidas } from './reglas-documentos.js';

const u = (rol: UsuarioAutenticado['rol'], trabajadorId = 't-yo'): UsuarioAutenticado => ({ id: 'u1', trabajadorId, empresaId: 'e1', sedeId: 's', rol, rut: '1-9', nombres: 'A', apellidos: 'B', cargo: 'C' });

describe('cifrado de archivos', () => {
  const clave = randomBytes(32);

  it('recupera exactamente los bytes originales', () => {
    const original = Buffer.from('%PDF-1.7 contrato de trabajo');
    expect(descifrar(cifrar(original, clave), clave).equals(original)).toBe(true);
  });

  it('detecta un archivo alterado', () => {
    const paquete = cifrar(Buffer.from('contenido'), clave);
    paquete[paquete.length - 1] ^= 1;
    expect(() => descifrar(paquete, clave)).toThrow();
  });

  it('dos cifrados del mismo archivo son distintos (IV aleatorio)', () => {
    const datos = Buffer.from('igual');
    expect(cifrar(datos, clave).equals(cifrar(datos, clave))).toBe(false);
  });
});

describe('tipo de archivo por sus bytes', () => {
  it('reconoce PDF, PNG y JPEG', () => {
    expect(detectarTipo(Buffer.from('%PDF-1.4\n'))).toBe('application/pdf');
    expect(detectarTipo(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('rechaza un ejecutable aunque diga .pdf', () => {
    expect(detectarTipo(Buffer.from('MZ\x90\x00'))).toBeNull();
  });

  it('limpia rutas y caracteres peligrosos del nombre', () => {
    expect(limpiarNombre('../../etc/passwd')).toBe('passwd');
    expect(limpiarNombre('C:\\docs\\contrato "final".pdf')).toBe('contrato final.pdf');
  });
});

describe('quién ve un documento', () => {
  const contrato = { empresaId: 'e1', trabajadorId: 't-yo', visibilidad: 'TRABAJADOR' as const };
  const licencia = { ...contrato, visibilidad: 'RESERVADO' as const };
  const evaluacion = { ...contrato, visibilidad: 'INTERNO' as const };

  it('el trabajador ve su contrato, no sus documentos internos ni los de otros', () => {
    expect(puedeVerDocumento(u('TRABAJADOR'), contrato)).toBe(true);
    expect(puedeVerDocumento(u('TRABAJADOR'), evaluacion)).toBe(false);
    expect(puedeVerDocumento(u('TRABAJADOR', 't-otro'), contrato)).toBe(false);
  });

  it('la jefatura nunca ve documentos de su equipo', () => {
    expect(puedeVerDocumento(u('JEFATURA', 't-jefa'), contrato)).toBe(false);
  });

  it('Gerencia no ve documentos reservados; Personas sí', () => {
    expect(puedeVerDocumento(u('GERENCIA', 't-g'), licencia)).toBe(false);
    expect(puedeVerDocumento(u('GERENCIA', 't-g'), evaluacion)).toBe(true);
    expect(puedeVerDocumento(u('PERSONAS', 't-p'), licencia)).toBe(true);
  });

  it('nadie ve documentos de otra empresa', () => {
    expect(puedeVerDocumento(u('PERSONAS', 't-p'), { ...contrato, empresaId: 'e2' })).toBe(false);
  });

  it('el filtro SQL coincide con la regla', () => {
    expect(visibilidadesPermitidas(u('JEFATURA', 't-jefa'), 't-yo')).toEqual([]);
    expect(visibilidadesPermitidas(u('TRABAJADOR'), 't-yo')).toEqual(['TRABAJADOR']);
  });
});

describe('enlaces de descarga (HU-15)', () => {
  const secreto = 'secreto-de-prueba';
  const ahora = Date.UTC(2026, 10, 12, 12, 0, 0);

  it('un enlace vale 5 minutos para el mismo usuario', () => {
    const token = firmarEnlace('doc1', 'u1', secreto, ahora);
    expect(verificarEnlace(token, secreto, ahora + 4 * 60_000)).toEqual({ ok: true, documentoId: 'doc1', usuarioId: 'u1' });
    expect(verificarEnlace(token, secreto, ahora + 6 * 60_000)).toEqual({ ok: false, motivo: 'vencido' });
  });

  it('rechaza un enlace manipulado o firmado con otra clave', () => {
    const token = firmarEnlace('doc1', 'u1', secreto, ahora);
    const [carga, firma] = token.split('.');
    const otraCarga = Buffer.from(`doc2.u1.${ahora + 60_000}`).toString('base64url');
    expect(verificarEnlace(`${otraCarga}.${firma}`, secreto, ahora).ok).toBe(false);
    expect(verificarEnlace(token, 'otra-clave', ahora).ok).toBe(false);
    expect(verificarEnlace(carga, secreto, ahora).ok).toBe(false);
  });
});

describe('avisos de vencimiento (HU-16)', () => {
  it('elige el umbral más chico alcanzado', () => {
    expect(umbralAviso(45)).toBeNull();
    expect(umbralAviso(30)).toBe(30);
    expect(umbralAviso(20)).toBe(30);
    expect(umbralAviso(15)).toBe(15);
    expect(umbralAviso(3)).toBe(5);
    expect(umbralAviso(0)).toBe(5);
    expect(umbralAviso(-1)).toBe(0);
  });
});

describe('documentos faltantes (HU-17)', () => {
  const req = [
    { cargo: '*', tipoId: 'contrato' },
    { cargo: '*', tipoId: 'cedula' },
    { cargo: 'Chofer repartidor', tipoId: 'licencia' },
  ];

  it('suma los obligatorios de toda la empresa y los del cargo', () => {
    expect(faltantes('Chofer repartidor', req, new Set(['contrato']))).toEqual(['cedula', 'licencia']);
    expect(faltantes('Cajera', req, new Set(['contrato', 'cedula']))).toEqual([]);
  });
});
