/**
 * Reglas puras del módulo de documentos (HU-14 a HU-17).
 *
 * - Tipo de archivo por sus bytes ("números mágicos"), no por la extensión ni por lo que
 *   declara el navegador: un .exe renombrado a .pdf se rechaza.
 * - Visibilidad por rol. La jefatura nunca ve documentos: solo recibe el aviso de que algo vence.
 * - Enlaces de descarga firmados que caducan a los 5 minutos y quedan atados al usuario,
 *   así un enlace copiado a un chat no sirve a otra persona ni más tarde.
 * - Umbrales de aviso de vencimiento: 30, 15 y 5 días, y uno al vencer.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';

export const TAMANO_MAXIMO = 10 * 1024 * 1024;
export const MINUTOS_ENLACE = 5;
export const UMBRALES_AVISO = [5, 15, 30] as const;

export type MimePermitido = 'application/pdf' | 'image/png' | 'image/jpeg';

export function detectarTipo(bytes: Buffer): MimePermitido | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Nombre seguro para guardar y para la cabecera de descarga: sin rutas ni caracteres de control. */
export function limpiarNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? 'documento';
  const limpio = base.normalize('NFC').replace(/[\u0000-\u001f"<>|:*?]/g, '').trim().slice(0, 120);
  return limpio || 'documento';
}

export type Visibilidad = 'TRABAJADOR' | 'INTERNO' | 'RESERVADO';

export interface DocumentoParaAcceso {
  empresaId: string;
  trabajadorId: string;
  visibilidad: Visibilidad;
}

export function puedeVerDocumento(u: UsuarioAutenticado, d: DocumentoParaAcceso): boolean {
  if (d.empresaId !== u.empresaId) return false;
  if (u.rol === 'PERSONAS') return true;
  if (d.visibilidad === 'RESERVADO') return false;
  if (u.rol === 'GERENCIA') return true;
  return d.visibilidad === 'TRABAJADOR' && d.trabajadorId === u.trabajadorId;
}

/** Visibilidades que un rol puede ver de un trabajador dado; sirve para filtrar en SQL. */
export function visibilidadesPermitidas(u: UsuarioAutenticado, trabajadorId: string): Visibilidad[] {
  if (u.rol === 'PERSONAS') return ['TRABAJADOR', 'INTERNO', 'RESERVADO'];
  if (u.rol === 'GERENCIA') return ['TRABAJADOR', 'INTERNO'];
  return trabajadorId === u.trabajadorId ? ['TRABAJADOR'] : [];
}

// ------------------------------------------------------------- enlaces firmados

export function firmarEnlace(documentoId: string, usuarioId: string, secreto: string, ahora = Date.now()): string {
  const expira = ahora + MINUTOS_ENLACE * 60_000;
  const carga = `${documentoId}.${usuarioId}.${expira}`;
  const firma = createHmac('sha256', secreto).update(carga).digest('base64url');
  return `${Buffer.from(carga).toString('base64url')}.${firma}`;
}

export type ResultadoEnlace = { ok: true; documentoId: string; usuarioId: string } | { ok: false; motivo: 'formato' | 'firma' | 'vencido' };

export function verificarEnlace(token: string, secreto: string, ahora = Date.now()): ResultadoEnlace {
  const [cargaB64, firma] = token.split('.');
  if (!cargaB64 || !firma) return { ok: false, motivo: 'formato' };
  const carga = Buffer.from(cargaB64, 'base64url').toString();
  const esperada = createHmac('sha256', secreto).update(carga).digest();
  const recibida = Buffer.from(firma, 'base64url');
  // Comparación de tiempo constante: no revela cuántos caracteres de la firma acertó un atacante.
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return { ok: false, motivo: 'firma' };
  const [documentoId, usuarioId, expira] = carga.split('.');
  if (!documentoId || !usuarioId || Number(expira) < ahora) return { ok: false, motivo: 'vencido' };
  return { ok: true, documentoId, usuarioId };
}

// ------------------------------------------------------------- vencimientos

/**
 * Qué aviso corresponde hoy. Se elige el umbral más chico alcanzado, así si el proceso
 * no corrió algún día (servidor caído) igual se avisa, sin mandar tres avisos juntos.
 * 0 significa "ya venció". null: aún no corresponde avisar.
 */
export function umbralAviso(diasRestantes: number): number | null {
  if (diasRestantes < 0) return 0;
  for (const u of UMBRALES_AVISO) if (diasRestantes <= u) return u;
  return null;
}

export interface Requisito {
  cargo: string;
  tipoId: string;
}

/** Tipos de documento obligatorios que le faltan a una persona según su cargo (HU-17). */
export function faltantes(cargo: string, requisitos: Requisito[], tiposQueTiene: ReadonlySet<string>): string[] {
  const exigidos = new Set(requisitos.filter((r) => r.cargo === '*' || r.cargo === cargo).map((r) => r.tipoId));
  return [...exigidos].filter((t) => !tiposQueTiene.has(t));
}
