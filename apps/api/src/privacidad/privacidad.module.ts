/**
 * Privacidad y trazabilidad.
 *
 * Auditoría (HU-19): Personas y Gerencia consultan quién vio o cambió qué. Solo lectura:
 * la aplicación no tiene ninguna ruta para editar o borrar registros.
 *
 * Derechos del titular (HU-06 y HU-20, Ley 21.719 de protección de datos personales):
 * - Acceso inmediato: cada persona descarga una copia de sus datos en JSON, sin esperar a nadie.
 * - Solicitudes de rectificación o acceso detallado: quedan con fecha y estado, Personas recibe
 *   aviso y responde por escrito. Los plazos legales de respuesta se revisan con asesoría
 *   jurídica antes de producción; el panel muestra las solicitudes abiertas.
 */
import { Body, Controller, ForbiddenException, Get, HttpCode, Injectable, Ip, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can, Policy } from '@nestjs/authorization';
import { InjectDrizzle } from '@nestjs/drizzle';
import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { AuditoriaService } from '../audit/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosModule } from '../avisos/avisos.module.js';
import { AvisosService } from '../avisos/avisos.service.js';
import type { Database } from '../db/database.js';
import {
  afps,
  certificados,
  documentos,
  institucionesSalud,
  movimientosVacaciones,
  notificaciones,
  registrosAuditoria,
  sedes,
  solicitudesAusencia,
  solicitudesTitular,
  tiposAusencia,
  tiposDocumento,
  trabajadores,
  usuarios,
} from '../db/schema.js';

const actor = alias(trabajadores, 'actor');
const POR_PAGINA = 50;

@Injectable()
export class PrivacidadService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  // ------------------------------------------------------------ auditoría

  async registros(usuario: UsuarioAutenticado, f: { trabajadorId?: string; desde?: string; hasta?: string; accion?: string; pagina: number }) {
    const condiciones: SQL[] = [eq(registrosAuditoria.empresaId, usuario.empresaId)];
    if (f.desde) condiciones.push(gte(registrosAuditoria.fecha, new Date(`${f.desde}T00:00:00-03:00`)));
    if (f.hasta) condiciones.push(lte(registrosAuditoria.fecha, new Date(`${f.hasta}T23:59:59-03:00`)));
    if (f.accion) condiciones.push(eq(registrosAuditoria.accion, f.accion));
    if (f.trabajadorId) {
      // "Por trabajador": lo que esa persona hizo y lo que otros hicieron sobre sus datos.
      condiciones.push(
        or(
          eq(actor.id, f.trabajadorId),
          and(eq(registrosAuditoria.entidad, 'trabajador'), eq(registrosAuditoria.entidadId, f.trabajadorId)),
          sql`${registrosAuditoria.detalle}->>'trabajadorId' = ${f.trabajadorId}`,
        )!,
      );
    }
    const filas = await this.db
      .select({
        id: registrosAuditoria.id,
        fecha: registrosAuditoria.fecha,
        accion: registrosAuditoria.accion,
        entidad: registrosAuditoria.entidad,
        entidadId: registrosAuditoria.entidadId,
        detalle: registrosAuditoria.detalle,
        ip: registrosAuditoria.ip,
        actorNombres: actor.nombres,
        actorApellidos: actor.apellidos,
        actorRol: usuarios.rol,
      })
      .from(registrosAuditoria)
      .leftJoin(usuarios, eq(usuarios.id, registrosAuditoria.usuarioId))
      .leftJoin(actor, eq(actor.id, usuarios.trabajadorId))
      .where(and(...condiciones))
      .orderBy(desc(registrosAuditoria.fecha))
      .limit(POR_PAGINA + 1)
      .offset((f.pagina - 1) * POR_PAGINA);
    const acciones = await this.db.selectDistinct({ accion: registrosAuditoria.accion }).from(registrosAuditoria).where(eq(registrosAuditoria.empresaId, usuario.empresaId));
    // Consultar la auditoría también queda registrado: quien vigila también es visible.
    await this.auditoria.registrar({ usuario, accion: 'CONSULTAR_AUDITORIA', entidad: 'auditoria', detalle: { ...f } });
    return { registros: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA, pagina: f.pagina, acciones: acciones.map((a) => a.accion).sort() };
  }

  // ------------------------------------------------------------ derechos del titular

  /** Copia de todos los datos personales de quien la pide (derecho de acceso, al instante). */
  async misDatos(usuario: UsuarioAutenticado, ip?: string) {
    const id = usuario.trabajadorId;
    const [ficha] = await this.db
      .select({
        rut: trabajadores.rut,
        nombres: trabajadores.nombres,
        apellidos: trabajadores.apellidos,
        cargo: trabajadores.cargo,
        sede: sedes.nombre,
        fechaIngreso: trabajadores.fechaIngreso,
        tipoContrato: trabajadores.tipoContrato,
        fechaTerminoContrato: trabajadores.fechaTerminoContrato,
        horasSemanales: trabajadores.horasSemanales,
        telefono: trabajadores.telefono,
        email: trabajadores.email,
        sueldoBase: trabajadores.sueldoBase,
        afp: afps.nombre,
        salud: institucionesSalud.nombre,
        planIsapreUf: trabajadores.planIsapreUf,
        aniosPreviosReconocidos: trabajadores.aniosPreviosReconocidos,
      })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .leftJoin(afps, eq(afps.id, trabajadores.afpId))
      .leftJoin(institucionesSalud, eq(institucionesSalud.id, trabajadores.saludId))
      .where(eq(trabajadores.id, id));
    const [cuenta] = await this.db.select({ rol: usuarios.rol, ultimoIngreso: usuarios.ultimoIngreso, segundoFactorDesde: usuarios.totpActivadoEn, creada: usuarios.creadoEn }).from(usuarios).where(eq(usuarios.id, usuario.id));
    const ausencias = await this.db
      .select({ tipo: tiposAusencia.nombre, desde: solicitudesAusencia.desde, hasta: solicitudesAusencia.hasta, diasHabiles: solicitudesAusencia.diasHabiles, estado: solicitudesAusencia.estado, comentario: solicitudesAusencia.comentario, detalleReservado: solicitudesAusencia.detalleReservado, motivoRechazo: solicitudesAusencia.motivoRechazo })
      .from(solicitudesAusencia)
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(eq(solicitudesAusencia.trabajadorId, id));
    const vacaciones = await this.db.select({ fecha: movimientosVacaciones.fecha, tipo: movimientosVacaciones.tipo, dias: movimientosVacaciones.dias, motivo: movimientosVacaciones.motivo }).from(movimientosVacaciones).where(eq(movimientosVacaciones.trabajadorId, id));
    // Lista de documentos con visibilidad (no los archivos): cada uno se descarga aparte según sus permisos.
    const docs = await this.db
      .select({ tipo: tiposDocumento.nombre, archivo: documentos.nombreArchivo, venceEl: documentos.venceEl, visibilidad: documentos.visibilidad, subido: documentos.creadoEn })
      .from(documentos)
      .innerJoin(tiposDocumento, eq(tiposDocumento.id, documentos.tipoId))
      .where(and(eq(documentos.trabajadorId, id), sql`${documentos.eliminadoEn} is null`));
    const certs = await this.db.select({ codigo: certificados.codigo, tipo: certificados.tipo, emitido: certificados.emitidoEn, revocado: certificados.revocadoEn }).from(certificados).where(eq(certificados.trabajadorId, id));
    const avisos = await this.db.select({ titulo: notificaciones.titulo, mensaje: notificaciones.mensaje, creado: notificaciones.creadaEn, leido: notificaciones.leidaEn }).from(notificaciones).where(eq(notificaciones.trabajadorId, id));
    const accesos = await this.db
      .select({ fecha: registrosAuditoria.fecha, accion: registrosAuditoria.accion })
      .from(registrosAuditoria)
      .where(and(eq(registrosAuditoria.entidad, 'trabajador'), eq(registrosAuditoria.entidadId, id)))
      .orderBy(desc(registrosAuditoria.fecha))
      .limit(500);
    const solicitudes = await this.db.select().from(solicitudesTitular).where(eq(solicitudesTitular.trabajadorId, id));
    await this.auditoria.registrar({ usuario, accion: 'DESCARGAR_MIS_DATOS', entidad: 'trabajador', entidadId: id, ip });
    return {
      generadoEn: new Date().toISOString(),
      explicacion: 'Copia de los datos personales que Comercial Te Moana guarda sobre ti en Tangata. Si algo está mal, pide una rectificación desde el portal.',
      ficha,
      cuenta,
      ausencias,
      movimientosVacaciones: vacaciones,
      documentos: docs,
      certificados: certs,
      avisos,
      quienVioTuFicha: accesos,
      solicitudesDeDatos: solicitudes,
    };
  }

  async crearSolicitud(usuario: UsuarioAutenticado, tipo: 'ACCESO' | 'RECTIFICACION', detalle: string, ip?: string) {
    const [s] = await this.db.insert(solicitudesTitular).values({ empresaId: usuario.empresaId, trabajadorId: usuario.trabajadorId, tipo, detalle: detalle.trim() }).returning();
    await this.auditoria.registrar({ usuario, accion: 'SOLICITUD_TITULAR', entidad: 'solicitud_titular', entidadId: s.id, ip, detalle: { tipo } });
    const personas = await this.avisos.trabajadoresConRol(usuario.empresaId, ['PERSONAS']);
    await this.avisos.crear({
      empresaId: usuario.empresaId,
      destinatarios: personas.filter((p) => p !== usuario.trabajadorId),
      tipo: 'SOLICITUD_TITULAR',
      titulo: `${usuario.nombres} ${usuario.apellidos.split(' ')[0]} pide ${tipo === 'RECTIFICACION' ? 'corregir sus datos' : 'acceso a sus datos'}`,
      mensaje: detalle.trim().slice(0, 140),
      enlace: '/privacidad',
    });
    return s;
  }

  listar(usuario: UsuarioAutenticado, todas: boolean) {
    const condiciones: SQL[] = [eq(solicitudesTitular.empresaId, usuario.empresaId)];
    if (!todas) condiciones.push(eq(solicitudesTitular.trabajadorId, usuario.trabajadorId));
    return this.db
      .select({ s: solicitudesTitular, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos })
      .from(solicitudesTitular)
      .innerJoin(trabajadores, eq(trabajadores.id, solicitudesTitular.trabajadorId))
      .where(and(...condiciones))
      .orderBy(sql`case when ${solicitudesTitular.estado} = 'ABIERTA' then 0 else 1 end`, desc(solicitudesTitular.creadaEn));
  }

  async responder(usuario: UsuarioAutenticado, id: string, estado: 'RESUELTA' | 'RECHAZADA', respuesta: string, ip?: string) {
    const [s] = await this.db.select().from(solicitudesTitular).where(eq(solicitudesTitular.id, id));
    if (!s || s.empresaId !== usuario.empresaId) throw new NotFoundException('Solicitud no encontrada');
    if (s.trabajadorId === usuario.trabajadorId) throw new ForbiddenException('Otra persona de Personas debe responder tu propia solicitud.');
    await this.db.update(solicitudesTitular).set({ estado, respuesta: respuesta.trim(), resueltaPor: usuario.id, resueltaEn: new Date() }).where(eq(solicitudesTitular.id, id));
    await this.auditoria.registrar({ usuario, accion: 'RESPONDER_SOLICITUD_TITULAR', entidad: 'solicitud_titular', entidadId: id, ip, detalle: { estado } });
    await this.avisos.crear({ empresaId: s.empresaId, destinatarios: [s.trabajadorId], tipo: 'SOLICITUD_TITULAR_RESPONDIDA', titulo: `Personas respondió tu solicitud de ${s.tipo === 'RECTIFICACION' ? 'corrección' : 'acceso'}`, mensaje: respuesta.trim().slice(0, 140), enlace: '/privacidad' });
  }
}

@Policy()
export class PrivacidadPolicy {
  usar(u: UsuarioAutenticado | null) {
    return u !== null;
  }

  verAuditoria(u: UsuarioAutenticado | null) {
    return u !== null && (u.rol === 'PERSONAS' || u.rol === 'GERENCIA');
  }

  gestionar(u: UsuarioAutenticado | null) {
    return u !== null && u.rol === 'PERSONAS';
  }
}

const auditoriaSchema = z.object({
  trabajadorId: z.uuid().optional(),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  accion: z.string().max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});
const solicitudSchema = z.object({ tipo: z.enum(['ACCESO', 'RECTIFICACION']), detalle: z.string().trim().min(10, 'Cuéntanos qué necesitas en al menos 10 caracteres.').max(1000) });
const respuestaSchema = z.object({ estado: z.enum(['RESUELTA', 'RECHAZADA']), respuesta: z.string().trim().min(10).max(1000) });

@Controller()
export class PrivacidadController {
  constructor(private readonly privacidad: PrivacidadService) {}

  @Get('auditoria')
  @Can(PrivacidadPolicy, 'verAuditoria')
  auditoria(@CurrentUser() u: UsuarioAutenticado, @Query({ schema: auditoriaSchema }) q: z.infer<typeof auditoriaSchema>) {
    return this.privacidad.registros(u, q);
  }

  @Get('privacidad/mis-datos')
  @Can(PrivacidadPolicy, 'usar')
  misDatos(@CurrentUser() u: UsuarioAutenticado, @Ip() ip: string) {
    return this.privacidad.misDatos(u, ip);
  }

  @Get('privacidad/solicitudes')
  @Can(PrivacidadPolicy, 'usar')
  mias(@CurrentUser() u: UsuarioAutenticado) {
    return this.privacidad.listar(u, false);
  }

  @Get('privacidad/solicitudes/todas')
  @Can(PrivacidadPolicy, 'gestionar')
  todas(@CurrentUser() u: UsuarioAutenticado) {
    return this.privacidad.listar(u, true);
  }

  @Post('privacidad/solicitudes')
  @Can(PrivacidadPolicy, 'usar')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: solicitudSchema }) body: z.infer<typeof solicitudSchema>, @Ip() ip: string) {
    return this.privacidad.crearSolicitud(u, body.tipo, body.detalle, ip);
  }

  @Post('privacidad/solicitudes/:id/responder')
  @Can(PrivacidadPolicy, 'gestionar')
  @HttpCode(204)
  responder(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: respuestaSchema }) body: z.infer<typeof respuestaSchema>, @Ip() ip: string) {
    return this.privacidad.responder(u, id, body.estado, body.respuesta, ip);
  }
}

@Module({
  imports: [AuditoriaModule, AvisosModule],
  controllers: [PrivacidadController],
  providers: [PrivacidadPolicy, PrivacidadService],
})
export class PrivacidadModule {}
