import { Body, Controller, Get, HttpCode, Ip, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentUser, Public, SignInService } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuditoriaService } from '../audit/auditoria.service.js';
import { AccesoService } from './acceso.service.js';
import { BLOQUEO_MS, CredencialesService, CuentaBloqueadaException, MAX_INTENTOS } from './credenciales.service.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

const ingresoSchema = z.object({
  rut: z.string().min(1).max(15),
  clave: z.string().min(1).max(200),
  /** Código de la aplicación autenticadora, solo si la cuenta tiene segundo factor. */
  codigo: z.string().max(10).optional(),
});
const activarSchema = z.object({ rut: z.string().min(1).max(15), codigo: z.string().min(8).max(20), clave: z.string().min(1).max(200) });
const claveSchema = z.object({ actual: z.string().min(1).max(200), nueva: z.string().min(1).max(200) });
const codigoSchema = z.object({ codigo: z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos.') });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly credenciales: CredencialesService,
    private readonly signIn: SignInService,
    private readonly auditoria: AuditoriaService,
    private readonly acceso: AccesoService,
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
    if (resultado.totpActivo) {
      // Clave correcta: se pide el código sin crear sesión todavía.
      if (!body.codigo) return { requiereCodigo: true };
      if (!this.acceso.verificarAlIngresar(resultado.totpSecretoCifrado!, body.codigo)) {
        await this.credenciales.usuarios.registrarIntentoFallido(usuario.id, MAX_INTENTOS, BLOQUEO_MS);
        await this.auditoria.registrar({ usuario, accion: 'INGRESO_FALLIDO', entidad: 'usuario', ip, detalle: { motivo: 'segundo_factor' } });
        throw new UnauthorizedException('El código no es correcto.');
      }
    }
    await this.credenciales.usuarios.registrarIngresoExitoso(usuario.id);
    await this.signIn.signIn(usuario.id, { method: 'password', metadata: { ip, segundoFactor: resultado.totpActivo } });
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
  async yo(@CurrentUser() usuario: UsuarioAutenticado) {
    return { usuario, segundoFactor: await this.acceso.estado(usuario) };
  }

  /** Pública: crea la primera contraseña con el código de invitación (HU-02). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('activar')
  @HttpCode(200)
  activar(@Body({ schema: activarSchema }) body: z.infer<typeof activarSchema>, @Ip() ip: string) {
    return this.acceso.activar(body.rut, body.codigo, body.clave, ip);
  }

  @Can.Anyone()
  @Post('clave')
  @HttpCode(200)
  cambiarClave(@CurrentUser() usuario: UsuarioAutenticado, @Body({ schema: claveSchema }) body: z.infer<typeof claveSchema>, @Ip() ip: string) {
    return this.acceso.cambiarClave(usuario, body.actual, body.nueva, ip);
  }

  @Can.Anyone()
  @Post('2fa/iniciar')
  @HttpCode(200)
  iniciar2fa(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.acceso.iniciar(usuario);
  }

  @Can.Anyone()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/confirmar')
  @HttpCode(200)
  confirmar2fa(@CurrentUser() usuario: UsuarioAutenticado, @Body({ schema: codigoSchema }) body: z.infer<typeof codigoSchema>, @Ip() ip: string) {
    return this.acceso.confirmar(usuario, body.codigo, ip);
  }
}
