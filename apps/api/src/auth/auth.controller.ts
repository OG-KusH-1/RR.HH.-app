import { Body, Controller, Get, HttpCode, Ip, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentUser, Public, SignInService } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuditoriaService } from '../audit/auditoria.service.js';
import { CredencialesService, CuentaBloqueadaException } from './credenciales.service.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

const ingresoSchema = z.object({
  rut: z.string().min(1).max(15),
  clave: z.string().min(1).max(200),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly credenciales: CredencialesService,
    private readonly signIn: SignInService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('ingresar')
  @HttpCode(200)
  async ingresar(@Body({ schema: ingresoSchema }) body: z.infer<typeof ingresoSchema>, @Ip() ip: string) {
    const resultado = await this.credenciales.verificar(body.rut, body.clave);
    if (!resultado.ok) {
      await this.auditoria.registrar({ accion: 'INGRESO_FALLIDO', entidad: 'usuario', ip, detalle: { motivo: resultado.motivo } });
      if (resultado.motivo === 'bloqueado') throw new CuentaBloqueadaException();
      throw new UnauthorizedException('RUT o contraseña incorrectos');
    }
    const { usuario } = resultado;
    await this.signIn.signIn(usuario.id, { method: 'password', metadata: { ip } });
    await this.auditoria.registrar({ usuario, accion: 'INGRESO', entidad: 'usuario', entidadId: usuario.id, ip });
    return { usuario };
  }

  @Can.Anyone()
  @Post('salir')
  @HttpCode(204)
  async salir(@CurrentUser() usuario: UsuarioAutenticado, @Ip() ip: string) {
    await this.signIn.signOut();
    await this.auditoria.registrar({ usuario, accion: 'SALIDA', entidad: 'usuario', entidadId: usuario.id, ip });
  }

  @Can.Anyone()
  @Get('yo')
  yo(@CurrentUser() usuario: UsuarioAutenticado) {
    return { usuario };
  }
}
