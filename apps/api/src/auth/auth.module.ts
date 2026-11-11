import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { AuthController } from './auth.controller.js';
import { CredencialesService } from './credenciales.service.js';
import { SesionCookieProvider } from './sesion-cookie.provider.js';
import { SesionesStore } from './sesiones.store.js';
import { UsuariosRepository } from './usuarios.repository.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [AuthController],
  providers: [UsuariosRepository, CredencialesService, SesionesStore, SesionCookieProvider],
  exports: [UsuariosRepository],
})
export class AuthModule {}
