import { Policy } from '@nestjs/authorization';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { puedeVerFicha, puedeVerResumenEmpresa, type TrabajadorVisible } from './alcance.js';

@Policy()
export class TrabajadoresPolicy {
  listar(usuario: UsuarioAutenticado | null) {
    return usuario !== null;
  }

  ver(usuario: UsuarioAutenticado, trabajador: TrabajadorVisible) {
    return puedeVerFicha(usuario, trabajador);
  }

  verResumen(usuario: UsuarioAutenticado | null) {
    return usuario !== null && puedeVerResumenEmpresa(usuario);
  }
}
