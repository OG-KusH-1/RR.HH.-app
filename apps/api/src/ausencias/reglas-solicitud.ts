/**
 * Validación de una solicitud de ausencia (HU-09) y permisos para resolverla (HU-10).
 * Funciones puras: reciben todo lo que necesitan y devuelven problemas en lenguaje
 * de la persona usuaria, listos para mostrar.
 */
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { contarDiasHabiles, diasCorridos, seCruzan } from './calendario-laboral.js';

/** Límite de días corridos de una solicitud: evita errores de tipeo como un año entero. */
export const MAX_DIAS_CORRIDOS = 120;
/** Hasta cuántos días hacia atrás se puede informar una ausencia retroactiva. */
export const MAX_DIAS_RETROACTIVO = 60;

export interface TipoParaValidar {
  codigo: string;
  afectaSaldo: boolean;
  permiteRetroactivo: boolean;
}

export interface RangoExistente {
  desde: string;
  hasta: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
}

export interface EntradaValidacion {
  tipo: TipoParaValidar;
  desde: string;
  hasta: string;
  hoy: string;
  feriados: ReadonlySet<string>;
  /** Saldo disponible hoy. Solo importa si el tipo afecta el saldo. */
  disponible: number;
  /** Otras solicitudes del mismo trabajador. */
  existentes: RangoExistente[];
}

export interface ResultadoValidacion {
  diasHabiles: number;
  diasCorridos: number;
  problemas: string[];
}

export function validarSolicitud(e: EntradaValidacion): ResultadoValidacion {
  const problemas: string[] = [];
  const corridos = e.desde <= e.hasta ? diasCorridos(e.desde, e.hasta) : 0;
  const habiles = contarDiasHabiles(e.desde, e.hasta, e.feriados);

  if (e.desde > e.hasta) {
    problemas.push('La fecha de término es anterior a la de inicio.');
    return { diasHabiles: 0, diasCorridos: 0, problemas };
  }
  if (corridos > MAX_DIAS_CORRIDOS) problemas.push(`Una solicitud puede abarcar hasta ${MAX_DIAS_CORRIDOS} días corridos.`);

  if (e.desde < e.hoy) {
    if (!e.tipo.permiteRetroactivo) problemas.push('Las fechas ya pasaron. Elige una fecha desde hoy.');
    else if (diasCorridos(e.desde, e.hoy) - 1 > MAX_DIAS_RETROACTIVO) problemas.push(`Solo se pueden informar ausencias de los últimos ${MAX_DIAS_RETROACTIVO} días.`);
  }

  // Una licencia médica cubre días corridos aunque no haya hábiles; vacaciones no.
  if (habiles === 0 && e.tipo.afectaSaldo) problemas.push('El rango no incluye días hábiles: sábados, domingos y feriados no se descuentan.');

  if (e.tipo.afectaSaldo && habiles > e.disponible) {
    const falta = Math.ceil((habiles - e.disponible) * 100) / 100;
    problemas.push(`Te faltan ${formatearDias(falta)} de saldo: pides ${formatearDias(habiles)} y tienes ${formatearDias(e.disponible)} disponibles.`);
  }

  // Se bloquea el cruce también con pendientes: dos solicitudes vivas por los mismos días confunden a la jefatura.
  const cruce = e.existentes.find((s) => (s.estado === 'APROBADA' || s.estado === 'PENDIENTE') && seCruzan(e.desde, e.hasta, s.desde, s.hasta));
  if (cruce) {
    problemas.push(`Ya tienes una solicitud ${cruce.estado === 'APROBADA' ? 'aprobada' : 'pendiente'} del ${cruce.desde} al ${cruce.hasta} que se cruza con estas fechas.`);
  }

  return { diasHabiles: habiles, diasCorridos: corridos, problemas };
}

export function formatearDias(n: number): string {
  const texto = Number.isInteger(n) ? String(n) : n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
  return `${texto} ${n === 1 ? 'día' : 'días'}`;
}

export interface SolicitanteParaResolver {
  id: string;
  empresaId: string;
  jefaturaId: string | null;
}

/**
 * Quién puede aprobar o rechazar (HU-10):
 * - Nadie resuelve su propia solicitud.
 * - La jefatura directa del solicitante.
 * - Personas y Gerencia, como respaldo cuando la jefatura no está o el solicitante no tiene jefatura.
 */
export function puedeResolver(usuario: UsuarioAutenticado, solicitante: SolicitanteParaResolver): boolean {
  if (solicitante.empresaId !== usuario.empresaId) return false;
  if (solicitante.id === usuario.trabajadorId) return false;
  if (usuario.rol === 'PERSONAS' || usuario.rol === 'GERENCIA') return true;
  return usuario.rol === 'JEFATURA' && solicitante.jefaturaId === usuario.trabajadorId;
}

/** Ver una solicitud: el propio trabajador, quien puede resolverla, o Personas/Gerencia. */
export function puedeVerSolicitud(usuario: UsuarioAutenticado, solicitante: SolicitanteParaResolver): boolean {
  if (solicitante.empresaId !== usuario.empresaId) return false;
  return solicitante.id === usuario.trabajadorId || puedeResolver(usuario, solicitante);
}

/** El detalle reservado (diagnóstico, folio de licencia) solo lo ven el titular y Personas. */
export function puedeVerDetalleReservado(usuario: UsuarioAutenticado, solicitante: SolicitanteParaResolver): boolean {
  return solicitante.empresaId === usuario.empresaId && (solicitante.id === usuario.trabajadorId || usuario.rol === 'PERSONAS');
}
