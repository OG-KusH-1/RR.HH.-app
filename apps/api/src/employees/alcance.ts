import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';

export interface TrabajadorVisible {
  id: string;
  empresaId: string;
  jefaturaId: string | null;
}

/**
 * Reglas de visibilidad de fichas (HU-03). Funciones puras: fáciles de probar.
 * - Trabajador: solo su propia ficha.
 * - Jefatura: su ficha y la de su equipo directo.
 * - Personas, Gerencia y Administrador: toda la empresa.
 * Nadie ve fichas de otra empresa.
 */
export function puedeVerFicha(usuario: UsuarioAutenticado, t: TrabajadorVisible): boolean {
  if (t.empresaId !== usuario.empresaId) return false;
  if (t.id === usuario.trabajadorId) return true;
  switch (usuario.rol) {
    case 'PERSONAS':
    case 'GERENCIA':
    case 'ADMIN':
      return true;
    case 'JEFATURA':
      return t.jefaturaId === usuario.trabajadorId;
    default:
      return false;
  }
}

export type AlcanceListado = { tipo: 'empresa' } | { tipo: 'equipo'; jefaturaId: string } | { tipo: 'propio' };

/** Qué filtro aplicar en la base de datos al listar trabajadores. */
export function alcanceListado(usuario: UsuarioAutenticado): AlcanceListado {
  switch (usuario.rol) {
    case 'PERSONAS':
    case 'GERENCIA':
    case 'ADMIN':
      return { tipo: 'empresa' };
    case 'JEFATURA':
      return { tipo: 'equipo', jefaturaId: usuario.trabajadorId };
    default:
      return { tipo: 'propio' };
  }
}

/** Solo Personas, Gerencia y Administrador ven el resumen por sede. */
export function puedeVerResumenEmpresa(usuario: UsuarioAutenticado): boolean {
  return usuario.rol === 'PERSONAS' || usuario.rol === 'GERENCIA' || usuario.rol === 'ADMIN';
}
