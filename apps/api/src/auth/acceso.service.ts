/**
 * Acceso a la cuenta más allá de la contraseña:
 * - Invitaciones de un solo uso para crear la primera contraseña (HU-02).
 * - Segundo factor TOTP para roles con acceso amplio (HU-04).
 * - Cambio de contraseña.
 *
 * Decisiones:
 * - El código de invitación se entrega a Personas una vez y se guarda solo su SHA-256.
 *   Personas lo hace llegar en persona o por WhatsApp; el envío automático por correo o
 *   WhatsApp se conecta en la fase de integraciones.
 * - Activar exige RUT + código: un código filtrado no sirve sin saber de quién es.
 * - Contraseñas de al menos 10 caracteres, sin reglas de "una mayúscula y un símbolo":
 *   la longitud protege más y es más fácil de recordar (guía NIST SP 800-63B).
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordHasher } from '@nestjs/authentication';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { AuditoriaService } from '../audit/auditoria.service.js';
import { claveDesdeBase64, cifrarTexto, descifrarTexto } from '../common/cifrado.js';
import { normalizarRut } from '../common/rut.js';
import type { Env } from '../config/env.js';
import type { Database } from '../db/database.js';
import { invitaciones, sesiones, trabajadores, usuarios } from '../db/schema.js';
import { generarSecreto, ROLES_CON_2FA, uriOtpauth, verificarCodigo } from './totp.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

export const LARGO_MINIMO_CLAVE = 10;
export const HORAS_INVITACION = 48;
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
/** 10 caracteres de 30 posibles ≈ 49 bits. Con el límite de intentos y 48 h de vida, imposible de adivinar. */
export function codigoInvitacion(): string {
  const bytes = randomBytes(10);
  const texto = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('');
  return `${texto.slice(0, 5)}-${texto.slice(5)}`;
}
const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/(.{5})(.{5})/, '$1-$2');

@Injectable()
export class AccesoService {
  private readonly clave: Buffer;

  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly hasher: PasswordHasher,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.clave = claveDesdeBase64(config.get('CLAVE_CIFRADO', { infer: true }));
  }

  segundoFactorObligatorio(rol: string): boolean {
    return this.config.get('SEGUNDO_FACTOR_OBLIGATORIO', { infer: true }) === 'true' && (ROLES_CON_2FA as readonly string[]).includes(rol);
  }

  // ------------------------------------------------------------ invitaciones

  async invitar(personas: UsuarioAutenticado, trabajadorId: string, ip?: string) {
    const [fila] = await this.db
      .select({ usuarioId: usuarios.id, empresaId: trabajadores.empresaId, estado: trabajadores.estado, nombres: trabajadores.nombres })
      .from(usuarios)
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(eq(trabajadores.id, trabajadorId));
    if (!fila || fila.empresaId !== personas.empresaId) throw new NotFoundException('Ficha no encontrada');
    if (fila.estado !== 'ACTIVO') throw new BadRequestException('La persona no tiene contrato vigente.');
    // Una invitación nueva anula las anteriores: solo un código vivo por persona.
    await this.db.update(invitaciones).set({ usadaEn: new Date() }).where(and(eq(invitaciones.usuarioId, fila.usuarioId), isNull(invitaciones.usadaEn)));
    const codigo = codigoInvitacion();
    const expiraEn = new Date(Date.now() + HORAS_INVITACION * 3_600_000);
    await this.db.insert(invitaciones).values({ usuarioId: fila.usuarioId, hashCodigo: sha256(codigo), expiraEn, creadaPor: personas.id });
    await this.auditoria.registrar({ usuario: personas, accion: 'CREAR_INVITACION', entidad: 'usuario', entidadId: fila.usuarioId, ip });
    const portal = this.config.get('PORTAL_URL', { infer: true });
    return { codigo, expiraEn, enlace: `${portal}/activar?codigo=${codigo}`, mensaje: `Hola ${fila.nombres}, entra a ${portal}/activar con tu RUT y el código ${codigo} para crear tu contraseña del portal de personas. Vence en ${HORAS_INVITACION} horas.` };
  }

  async activar(rutIngresado: string, codigoIngresado: string, clave: string, ip?: string) {
    if (clave.length < LARGO_MINIMO_CLAVE) throw new BadRequestException(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
    const rut = normalizarRut(rutIngresado);
    const error = new UnauthorizedException('El RUT o el código no coinciden, o la invitación venció. Pide un código nuevo a Personas.');
    if (!rut) throw error;
    const [inv] = await this.db
      .select({ id: invitaciones.id, usuarioId: invitaciones.usuarioId, rut: trabajadores.rut, empresaId: trabajadores.empresaId })
      .from(invitaciones)
      .innerJoin(usuarios, eq(usuarios.id, invitaciones.usuarioId))
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(and(eq(invitaciones.hashCodigo, sha256(normalizarCodigo(codigoIngresado))), isNull(invitaciones.usadaEn), gt(invitaciones.expiraEn, new Date()), eq(trabajadores.estado, 'ACTIVO')));
    if (!inv || inv.rut !== rut) {
      await this.auditoria.registrar({ accion: 'ACTIVACION_FALLIDA', entidad: 'usuario', ip });
      throw error;
    }
    await this.db.transaction(async (tx) => {
      await tx.update(invitaciones).set({ usadaEn: new Date() }).where(eq(invitaciones.id, inv.id));
      await tx.update(usuarios).set({ hashClave: await this.hasher.hash(clave), intentosFallidos: 0, bloqueadoHasta: null, actualizadoEn: new Date() }).where(eq(usuarios.id, inv.usuarioId));
      // Si alguien tenía una sesión abierta con la cuenta (clave anterior), se cierra.
      await tx.delete(sesiones).where(eq(sesiones.usuarioId, inv.usuarioId));
    });
    await this.auditoria.registrar({ usuario: { id: inv.usuarioId, empresaId: inv.empresaId }, accion: 'ACTIVAR_CUENTA', entidad: 'usuario', entidadId: inv.usuarioId, ip });
    return { ok: true };
  }

  async cambiarClave(usuario: UsuarioAutenticado, actual: string, nueva: string, ip?: string) {
    if (nueva.length < LARGO_MINIMO_CLAVE) throw new BadRequestException(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
    const [fila] = await this.db.select({ hash: usuarios.hashClave }).from(usuarios).where(eq(usuarios.id, usuario.id));
    if (!fila?.hash || !(await this.hasher.verify(actual, fila.hash))) throw new UnauthorizedException('La contraseña actual no es correcta.');
    await this.db.update(usuarios).set({ hashClave: await this.hasher.hash(nueva), actualizadoEn: new Date() }).where(eq(usuarios.id, usuario.id));
    await this.auditoria.registrar({ usuario, accion: 'CAMBIAR_CLAVE', entidad: 'usuario', entidadId: usuario.id, ip });
    return { ok: true };
  }

  // ------------------------------------------------------------ segundo factor

  async estado(usuario: UsuarioAutenticado) {
    const [f] = await this.db.select({ activo: usuarios.totpActivadoEn }).from(usuarios).where(eq(usuarios.id, usuario.id));
    return { activo: Boolean(f?.activo), obligatorio: this.segundoFactorObligatorio(usuario.rol) };
  }

  /** Genera un secreto nuevo (aún inactivo) y el QR para escanearlo. */
  async iniciar(usuario: UsuarioAutenticado) {
    const secreto = generarSecreto();
    await this.db.update(usuarios).set({ totpSecretoCifrado: cifrarTexto(secreto, this.clave), totpActivadoEn: null }).where(eq(usuarios.id, usuario.id));
    const uri = uriOtpauth(secreto, usuario.rut);
    return { secreto, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }

  async confirmar(usuario: UsuarioAutenticado, codigo: string, ip?: string) {
    const [f] = await this.db.select({ cifrado: usuarios.totpSecretoCifrado }).from(usuarios).where(eq(usuarios.id, usuario.id));
    if (!f?.cifrado) throw new BadRequestException('Primero genera el código QR.');
    if (!verificarCodigo(descifrarTexto(f.cifrado, this.clave), codigo)) throw new BadRequestException('El código no coincide. Revisa que la hora del celular esté al día.');
    await this.db.update(usuarios).set({ totpActivadoEn: new Date() }).where(eq(usuarios.id, usuario.id));
    await this.auditoria.registrar({ usuario, accion: 'ACTIVAR_2FA', entidad: 'usuario', entidadId: usuario.id, ip });
    return { ok: true };
  }

  verificarAlIngresar(secretoCifrado: string, codigo: string): boolean {
    return verificarCodigo(descifrarTexto(secretoCifrado, this.clave), codigo);
  }

  /** Para quien perdió el celular. Lo hace Administración del sistema, nunca la propia persona sin verificar. */
  async restablecer2fa(admin: UsuarioAutenticado, trabajadorId: string, ip?: string) {
    const [f] = await this.db
      .select({ usuarioId: usuarios.id, empresaId: trabajadores.empresaId })
      .from(usuarios)
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(eq(trabajadores.id, trabajadorId));
    if (!f || f.empresaId !== admin.empresaId) throw new NotFoundException('Ficha no encontrada');
    if (f.usuarioId === admin.id) throw new ForbiddenException('Otra persona de Administración debe restablecer tu segundo factor.');
    await this.db.update(usuarios).set({ totpSecretoCifrado: null, totpActivadoEn: null }).where(eq(usuarios.id, f.usuarioId));
    await this.db.delete(sesiones).where(eq(sesiones.usuarioId, f.usuarioId));
    await this.auditoria.registrar({ usuario: admin, accion: 'RESTABLECER_2FA', entidad: 'usuario', entidadId: f.usuarioId, ip });
  }
}
