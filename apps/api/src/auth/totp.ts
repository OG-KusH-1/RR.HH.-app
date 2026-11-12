/**
 * Códigos de un solo uso basados en tiempo (TOTP, RFC 6238), compatibles con Google
 * Authenticator, Microsoft Authenticator, Authy y 1Password. Se usa para el segundo factor
 * de los roles con acceso amplio (HU-04).
 *
 * Implementado con node:crypto en ~40 líneas para no sumar una dependencia en una pieza de
 * seguridad. Las pruebas usan los vectores oficiales del RFC 6238.
 *
 * Parámetros estándar: SHA-1, 6 dígitos, ventanas de 30 segundos. Se acepta una ventana antes
 * y una después para tolerar relojes de celular desfasados (hasta ±30 s).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PERIODO_SEGUNDOS = 30;
export const DIGITOS = 6;

export function base32Codificar(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      salida += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decodificar(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of limpio) {
    valor = (valor << 5) | BASE32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto nuevo de 160 bits (lo que recomienda el RFC 4226 para SHA-1). */
export function generarSecreto(): string {
  return base32Codificar(randomBytes(20));
}

export function codigoEn(secreto: Buffer, contador: number, algoritmo: 'sha1' | 'sha256' | 'sha512' = 'sha1', digitos = DIGITOS): string {
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac(algoritmo, secreto).update(mensaje).digest();
  // Truncamiento dinámico del RFC 4226.
  const desplazamiento = hmac[hmac.length - 1] & 0xf;
  const binario = (hmac.readUInt32BE(desplazamiento) & 0x7fffffff) % 10 ** digitos;
  return String(binario).padStart(digitos, '0');
}

export function verificarCodigo(secretoBase32: string, codigo: string, ahoraMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(codigo)) return false;
  const secreto = base32Decodificar(secretoBase32);
  const contador = Math.floor(ahoraMs / 1000 / PERIODO_SEGUNDOS);
  const recibido = Buffer.from(codigo);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(codigoEn(secreto, contador + d)), recibido));
}

/** URI que leen las aplicaciones autenticadoras desde un código QR. */
export function uriOtpauth(secretoBase32: string, cuenta: string, emisor = 'Tangata'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  return `otpauth://totp/${etiqueta}?secret=${secretoBase32}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PERIODO_SEGUNDOS}`;
}

/** Roles que deben usar segundo factor: ven datos de toda la empresa. */
export const ROLES_CON_2FA = ['PERSONAS', 'GERENCIA', 'ADMIN'] as const;
