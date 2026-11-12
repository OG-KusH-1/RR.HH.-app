/**
 * Rutas de documentos. Subir, eliminar y configurar requisitos es de Personas; ver depende
 * de la visibilidad de cada documento y se revisa en el servicio (reglas-documentos.ts).
 */
import { Body, Controller, Delete, Get, HttpCode, Ip, Module, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '@nestjs/authentication';
import { Can, Policy } from '@nestjs/authorization';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosModule } from '../avisos/avisos.module.js';
import type { Env } from '../config/env.js';
import { ALMACEN, AlmacenLocal } from './almacen.js';
import { DocumentosService } from './documentos.service.js';

@Policy()
export class DocumentosPolicy {
  usar(u: UsuarioAutenticado | null) {
    return u !== null;
  }

  gestionar(u: UsuarioAutenticado | null) {
    return u !== null && u.rol === 'PERSONAS';
  }

  /** Vencimientos: Personas y Gerencia ven todo; la jefatura, los de su equipo (sin acceso a archivos). */
  verVencimientos(u: UsuarioAutenticado | null) {
    return u !== null && ['PERSONAS', 'GERENCIA', 'JEFATURA'].includes(u.rol);
  }

  verFaltantes(u: UsuarioAutenticado | null) {
    return u !== null && (u.rol === 'PERSONAS' || u.rol === 'GERENCIA');
  }
}

const subidaSchema = z.object({
  trabajadorId: z.uuid(),
  tipoId: z.uuid(),
  nombreArchivo: z.string().min(1).max(200),
  // 10 MB en base64 ocupan ~13,4 millones de caracteres.
  contenidoBase64: z.string().min(4).max(14_000_000),
  venceEl: z.iso.date().nullable().optional(),
  visibilidad: z.enum(['TRABAJADOR', 'INTERNO', 'RESERVADO']).optional(),
  notas: z.string().max(300).optional(),
});
const eliminarSchema = z.object({ motivo: z.string().trim().min(5).max(300) });
const requisitoSchema = z.object({ cargo: z.string().trim().min(1).max(80), tipoId: z.uuid() });

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get('tipos')
  @Can(DocumentosPolicy, 'usar')
  tipos() {
    return this.documentos.tipos();
  }

  @Get('mios')
  @Can(DocumentosPolicy, 'usar')
  mios(@CurrentUser() u: UsuarioAutenticado) {
    return this.documentos.listar(u, u.trabajadorId);
  }

  @Get('trabajador/:id')
  @Can(DocumentosPolicy, 'usar')
  deTrabajador(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.documentos.listar(u, id);
  }

  @Post()
  @Can(DocumentosPolicy, 'gestionar')
  subir(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: subidaSchema }) body: z.infer<typeof subidaSchema>, @Ip() ip: string) {
    return this.documentos.subir(u, body, ip);
  }

  @Post(':id/enlace')
  @Can(DocumentosPolicy, 'usar')
  @HttpCode(200)
  enlace(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.documentos.enlace(u, id);
  }

  /** El enlace exige además la sesión: un enlace filtrado sin la cookie no sirve. */
  @Get('descarga/:token')
  @Can(DocumentosPolicy, 'usar')
  async descargar(@CurrentUser() u: UsuarioAutenticado, @Param('token') token: string, @Ip() ip: string, @Res() res: Response) {
    const { bytes, mime, nombre } = await this.documentos.descargar(u, token, ip);
    res
      .set({
        'Content-Type': mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  }

  @Delete(':id')
  @Can(DocumentosPolicy, 'gestionar')
  @HttpCode(204)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: eliminarSchema }) body: z.infer<typeof eliminarSchema>, @Ip() ip: string) {
    return this.documentos.eliminar(u, id, body.motivo, ip);
  }

  @Get('vencimientos')
  @Can(DocumentosPolicy, 'verVencimientos')
  vencimientos(@CurrentUser() u: UsuarioAutenticado, @Query('dias') dias?: string) {
    return this.documentos.vencimientos(u, Math.min(365, Math.max(1, Number(dias) || 60)));
  }

  /** Corre la revisión diaria a pedido (útil al cargar documentos nuevos o en la demostración). */
  @Post('vencimientos/revisar')
  @Can(DocumentosPolicy, 'gestionar')
  @HttpCode(200)
  async revisar(@CurrentUser() u: UsuarioAutenticado) {
    return { avisosCreados: await this.documentos.revisarVencimientos(u.empresaId) };
  }

  @Get('faltantes')
  @Can(DocumentosPolicy, 'verFaltantes')
  faltantes(@CurrentUser() u: UsuarioAutenticado) {
    return this.documentos.faltantes(u);
  }

  @Get('requeridos')
  @Can(DocumentosPolicy, 'verFaltantes')
  requeridos(@CurrentUser() u: UsuarioAutenticado) {
    return this.documentos.requeridos(u);
  }

  @Post('requeridos')
  @Can(DocumentosPolicy, 'gestionar')
  @HttpCode(204)
  agregarRequerido(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: requisitoSchema }) body: z.infer<typeof requisitoSchema>) {
    return this.documentos.agregarRequerido(u, body.cargo, body.tipoId);
  }

  @Delete('requeridos/:id')
  @Can(DocumentosPolicy, 'gestionar')
  @HttpCode(204)
  quitarRequerido(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.documentos.quitarRequerido(u, id);
  }
}

@Module({
  imports: [AuditoriaModule, AvisosModule],
  controllers: [DocumentosController],
  providers: [
    DocumentosPolicy,
    DocumentosService,
    { provide: ALMACEN, inject: [ConfigService], useFactory: (c: ConfigService<Env, true>) => new AlmacenLocal(c.get('ALMACEN_DIR', { infer: true })) },
  ],
  exports: [DocumentosService],
})
export class DocumentosModule {}
