/**
 * Cifrado simétrico para datos en reposo: archivos de documentos y secretos de segundo factor.
 *
 * AES-256-GCM: además de ocultar el contenido, detecta cualquier alteración (la etiqueta de
 * autenticación no calza y `descifrar` lanza error). Formato del resultado:
 *   versión (1 byte) | IV (12 bytes) | etiqueta (16 bytes) | texto cifrado
 * El byte de versión permite rotar el algoritmo o la clave más adelante sin perder archivos viejos.
 *
 * La clave viene de CLAVE_CIFRADO (32 bytes en base64, se genera con `openssl rand -base64 32`).
 * Si se pierde la clave, los archivos no se pueden recuperar: debe guardarse en el gestor de
 * secretos del hosting y en un respaldo fuera de línea (ver docs/12-vacaciones-y-documentos.md).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 1;
const ALGORITMO = 'aes-256-gcm';

export function claveDesdeBase64(base64: string): Buffer {
  const clave = Buffer.from(base64, 'base64');
  if (clave.length !== 32) throw new Error('CLAVE_CIFRADO debe tener 32 bytes en base64 (openssl rand -base64 32).');
  return clave;
}

export function cifrar(datos: Buffer, clave: Buffer): Buffer {
  const iv = randomBytes(12);
  const cifrador = createCipheriv(ALGORITMO, clave, iv);
  const cuerpo = Buffer.concat([cifrador.update(datos), cifrador.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cifrador.getAuthTag(), cuerpo]);
}

export function descifrar(paquete: Buffer, clave: Buffer): Buffer {
  if (paquete[0] !== VERSION) throw new Error(`Versión de cifrado desconocida: ${paquete[0]}`);
  const iv = paquete.subarray(1, 13);
  const etiqueta = paquete.subarray(13, 29);
  const descifrador = createDecipheriv(ALGORITMO, clave, iv);
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(paquete.subarray(29)), descifrador.final()]);
}

export const cifrarTexto = (texto: string, clave: Buffer) => cifrar(Buffer.from(texto, 'utf8'), clave).toString('base64');
export const descifrarTexto = (base64: string, clave: Buffer) => descifrar(Buffer.from(base64, 'base64'), clave).toString('utf8');
