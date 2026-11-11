import type { Rol } from '../common/roles.js';

/** Lo que la API sabe del usuario en cada petición. */
export interface UsuarioAutenticado {
  id: string;
  trabajadorId: string;
  empresaId: string;
  sedeId: string;
  rol: Rol;
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: UsuarioAutenticado;
    sessionExtra: { user: UsuarioAutenticado };
  }
}
