import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AccesoService } from './acceso.service.js';
import { SegundoFactorInterceptor } from './segundo-factor.interceptor.js';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { AuthController } from './auth.controller.js';
import { CredencialesService } from './credenciales.service.js';
import { SesionCookieProvider } from './sesion-cookie.provider.js';
import { SesionesStore } from './sesiones.store.js';
import { UsuariosRepository } from './usuarios.repository.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [AuthController],
  providers: [UsuariosRepository, CredencialesService, SesionesStore, SesionCookieProvider, AccesoService, { provide: APP_INTERCEPTOR, useClass: SegundoFactorInterceptor }],
  exports: [UsuariosRepository, AccesoService],
})
export class AuthModule {}
