/**
 * Rutas de vacaciones y ausencias. Las reglas por rol simples van en `AusenciasPolicy`;
 * las que dependen de la solicitud concreta (¿es tu jefatura?) se revisan en el servicio
 * con las funciones puras de reglas-solicitud.ts.
 */
import { Body, Controller, Delete, Get, HttpCode, Ip, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can, Policy } from '@nestjs/authorization';
import { z } from 'zod';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosModule } from '../avisos/avisos.module.js';
import { AusenciasService } from './ausencias.service.js';

@Policy()
export class AusenciasPolicy {
  usar(usuario: UsuarioAutenticado | null) {
    return usuario !== null;
  }

  /** Bandeja de aprobación: quien tiene equipo o respalda a las jefaturas. */
  verBandeja(usuario: UsuarioAutenticado | null) {
    return usuario !== null && ['JEFATURA', 'PERSONAS', 'GERENCIA'].includes(usuario.rol);
  }

  /** Ajustes de saldo, años previos y feriados: decisiones administrativas de Personas. */
  gestionar(usuario: UsuarioAutenticado | null) {
    return usuario !== null && usuario.rol === 'PERSONAS';
  }

  gestionarFeriados(usuario: UsuarioAutenticado | null) {
    return usuario !== null && (usuario.rol === 'PERSONAS' || usuario.rol === 'ADMIN');
  }
}

const fecha = z.iso.date();
const solicitudSchema = z.object({
  tipoCodigo: z.string().min(2).max(40),
  desde: fecha,
  hasta: fecha,
  comentario: z.string().max(500).optional(),
  detalleReservado: z.string().max(500).optional(),
  trabajadorId: z.uuid().optional(),
});
const rechazoSchema = z.object({ motivo: z.string().trim().min(5, 'Escribe un motivo de al menos 5 caracteres.').max(500) });
const ajusteSchema = z.object({
  dias: z.number().min(-60).max(60).refine((n) => n !== 0, 'El ajuste no puede ser cero.'),
  motivo: z.string().trim().min(10, 'Explica el ajuste en al menos 10 caracteres.').max(300),
});
const aniosSchema = z.object({ anios: z.number().min(0).max(50), respaldo: z.string().trim().min(5).max(300) });
const feriadoSchema = z.object({ fecha, nombre: z.string().min(3).max(120), irrenunciable: z.boolean().default(false), fuente: z.string().min(5).max(300) });
const listadoSchema = z.object({
  ambito: z.enum(['mias', 'equipo', 'todas']).default('mias'),
  estado: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA']).optional(),
});
const mesSchema = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), sedeId: z.uuid().optional() });

@Controller()
export class AusenciasController {
  constructor(private readonly ausencias: AusenciasService) {}

  @Get('ausencias/tipos')
  @Can(AusenciasPolicy, 'usar')
  tipos() {
    return this.ausencias.tipos();
  }

  @Get('ausencias/feriados')
  @Can(AusenciasPolicy, 'usar')
  feriados(@Query('anio') anio?: string) {
    return this.ausencias.listarFeriados(Number(anio) || new Date().getFullYear());
  }

  @Post('ausencias/feriados')
  @Can(AusenciasPolicy, 'gestionarFeriados')
  @HttpCode(204)
  registrarFeriado(@CurrentUser() usuario: UsuarioAutenticado, @Body({ schema: feriadoSchema }) body: z.infer<typeof feriadoSchema>) {
    return this.ausencias.registrarFeriado(usuario, body);
  }

  @Delete('ausencias/feriados/:fecha')
  @Can(AusenciasPolicy, 'gestionarFeriados')
  @HttpCode(204)
  eliminarFeriado(@CurrentUser() usuario: UsuarioAutenticado, @Param('fecha', { schema: fecha }) f: string) {
    return this.ausencias.eliminarFeriado(usuario, f);
  }

  @Get('ausencias/saldo')
  @Can(AusenciasPolicy, 'usar')
  miSaldo(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.ausencias.saldo(usuario, usuario.trabajadorId);
  }

  @Get('ausencias/saldos')
  @Can(AusenciasPolicy, 'verBandeja')
  saldosEquipo(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.ausencias.saldosDelEquipo(usuario);
  }

  @Get('ausencias/saldo/:trabajadorId')
  @Can(AusenciasPolicy, 'usar')
  saldo(@CurrentUser() usuario: UsuarioAutenticado, @Param('trabajadorId', ParseUUIDPipe) id: string) {
    return this.ausencias.saldo(usuario, id);
  }

  @Post('ausencias/saldo/:trabajadorId/ajustes')
  @Can(AusenciasPolicy, 'gestionar')
  ajustar(@CurrentUser() usuario: UsuarioAutenticado, @Param('trabajadorId', ParseUUIDPipe) id: string, @Body({ schema: ajusteSchema }) body: z.infer<typeof ajusteSchema>, @Ip() ip: string) {
    return this.ausencias.ajustar(usuario, id, body.dias, body.motivo, ip);
  }

  @Patch('trabajadores/:trabajadorId/anios-previos')
  @Can(AusenciasPolicy, 'gestionar')
  aniosPrevios(@CurrentUser() usuario: UsuarioAutenticado, @Param('trabajadorId', ParseUUIDPipe) id: string, @Body({ schema: aniosSchema }) body: z.infer<typeof aniosSchema>, @Ip() ip: string) {
    return this.ausencias.registrarAniosPrevios(usuario, id, body.anios, body.respaldo, ip);
  }

  @Post('ausencias/previsualizar')
  @Can(AusenciasPolicy, 'usar')
  @HttpCode(200)
  previsualizar(@CurrentUser() usuario: UsuarioAutenticado, @Body({ schema: solicitudSchema }) body: z.infer<typeof solicitudSchema>) {
    return this.ausencias.previsualizar(usuario, body);
  }

  @Get('ausencias/solicitudes')
  @Can(AusenciasPolicy, 'usar')
  listar(@CurrentUser() usuario: UsuarioAutenticado, @Query({ schema: listadoSchema }) q: z.infer<typeof listadoSchema>) {
    return this.ausencias.listar(usuario, q.ambito, q.estado);
  }

  @Post('ausencias/solicitudes')
  @Can(AusenciasPolicy, 'usar')
  crear(@CurrentUser() usuario: UsuarioAutenticado, @Body({ schema: solicitudSchema }) body: z.infer<typeof solicitudSchema>, @Ip() ip: string) {
    return this.ausencias.crear(usuario, body, ip);
  }

  @Get('ausencias/solicitudes/:id')
  @Can(AusenciasPolicy, 'usar')
  ver(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.ausencias.ver(usuario, id, ip);
  }

  @Post('ausencias/solicitudes/:id/aprobar')
  @Can(AusenciasPolicy, 'verBandeja')
  @HttpCode(200)
  aprobar(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.ausencias.aprobar(usuario, id, ip);
  }

  @Post('ausencias/solicitudes/:id/rechazar')
  @Can(AusenciasPolicy, 'verBandeja')
  @HttpCode(200)
  rechazar(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: rechazoSchema }) body: z.infer<typeof rechazoSchema>, @Ip() ip: string) {
    return this.ausencias.rechazar(usuario, id, body.motivo, ip);
  }

  @Post('ausencias/solicitudes/:id/cancelar')
  @Can(AusenciasPolicy, 'usar')
  @HttpCode(200)
  cancelar(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.ausencias.cancelar(usuario, id, ip);
  }

  @Get('ausencias/calendario')
  @Can(AusenciasPolicy, 'usar')
  calendario(@CurrentUser() usuario: UsuarioAutenticado, @Query({ schema: mesSchema }) q: z.infer<typeof mesSchema>) {
    return this.ausencias.calendario(usuario, q.mes, q.sedeId);
  }
}

@Module({
  imports: [AuditoriaModule, AvisosModule],
  controllers: [AusenciasController],
  providers: [AusenciasPolicy, AusenciasService],
  exports: [AusenciasService],
})
export class AusenciasModule {}
