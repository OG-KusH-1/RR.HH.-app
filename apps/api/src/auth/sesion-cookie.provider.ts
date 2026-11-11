import { Injectable } from '@nestjs/common';
import { AuthenticationRegistry, SessionCookieProvider, type SessionRecord } from '@nestjs/authentication';
import { UsuariosRepository } from './usuarios.repository.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

@Injectable()
export class SesionCookieProvider extends SessionCookieProvider<UsuarioAutenticado> {
  constructor(
    private readonly usuarios: UsuariosRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  /** Si el trabajador fue desvinculado, la sesión termina. */
  protected validate(session: SessionRecord) {
    return session.extra?.user ?? this.usuarios.buscarPorId(session.userId);
  }
}
