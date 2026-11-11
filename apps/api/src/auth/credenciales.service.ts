import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { normalizarRut } from '../common/rut.js';
import { UsuariosRepository } from './usuarios.repository.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

export type ResultadoVerificacion =
  | { ok: true; usuario: UsuarioAutenticado }
  | { ok: false; motivo: 'credenciales' | 'bloqueado' };

@Injectable()
export class CredencialesService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /**
   * Verifica RUT y contraseña (HU-01).
   * El mensaje de error es el mismo exista o no el RUT, y se verifica un hash de
   * relleno cuando no hay cuenta, para que el tiempo de respuesta no revele cuentas.
   */
  async verificar(rutIngresado: string, clave: string): Promise<ResultadoVerificacion> {
    const rut = normalizarRut(rutIngresado);
    if (!rut) return { ok: false, motivo: 'credenciales' };

    const fila = await this.usuarios.buscarCredenciales(rut);

    if (fila?.bloqueadoHasta && fila.bloqueadoHasta > new Date()) {
      return { ok: false, motivo: 'bloqueado' };
    }

    const valida = await this.hasher.verify(clave, fila?.hashClave ?? undefined);
    if (!fila || !fila.hashClave || !valida) {
      if (fila) await this.usuarios.registrarIntentoFallido(fila.id, MAX_INTENTOS, BLOQUEO_MS);
      return { ok: false, motivo: 'credenciales' };
    }

    if (this.hasher.needsRehash(fila.hashClave)) {
      await this.usuarios.actualizarHash(fila.id, await this.hasher.hash(clave));
    }
    await this.usuarios.registrarIngresoExitoso(fila.id);

    const { hashClave: _h, intentosFallidos: _i, bloqueadoHasta: _b, ...usuario } = fila;
    return { ok: true, usuario };
  }
}

export class CuentaBloqueadaException extends HttpException {
  constructor() {
    super({ statusCode: 423, mensaje: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta en 15 minutos.' }, HttpStatus.LOCKED);
  }
}
