import { Policy } from '@nestjs/authorization';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';

/**
 * Permisos del módulo previsional. Los sueldos son información sensible:
 * las jefaturas NO ven sueldos ni liquidaciones de su equipo.
 */
@Policy()
export class PrevisionalPolicy {
  /** Ver la lista de AFP e instituciones de salud con sus tasas. */
  verOpciones(usuario: UsuarioAutenticado | null) {
    return usuario !== null;
  }

  verIndicadores(usuario: UsuarioAutenticado | null) {
    return usuario !== null && ['PERSONAS', 'GERENCIA', 'ADMIN'].includes(usuario.rol);
  }

  /** Sincronizar, corregir y confirmar indicadores; registrar comisiones AFP. */
  gestionarIndicadores(usuario: UsuarioAutenticado | null) {
    return usuario !== null && (usuario.rol === 'PERSONAS' || usuario.rol === 'ADMIN');
  }

  /** Cambiar AFP, salud o sueldo de un trabajador. */
  editarPrevision(usuario: UsuarioAutenticado | null) {
    return usuario !== null && usuario.rol === 'PERSONAS';
  }

  /** La propia liquidación, o cualquiera para Personas y Gerencia de la misma empresa. */
  verRemuneracion(usuario: UsuarioAutenticado, trabajador: { id: string; empresaId: string }) {
    if (trabajador.empresaId !== usuario.empresaId) return false;
    return trabajador.id === usuario.trabajadorId || usuario.rol === 'PERSONAS' || usuario.rol === 'GERENCIA';
  }
}
