import { Body, Controller, Get, HttpCode, Ip, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Policy } from '@nestjs/authorization';
import { z } from 'zod';
import { AccesoService } from '../auth/acceso.service.js';
import { ROLES } from '../common/roles.js';
import { FichasService } from './fichas.service.js';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { TrabajadoresPolicy } from './trabajadores.policy.js';
import { TrabajadoresService } from './trabajadores.service.js';

@Policy()
export class FichasPolicy {
  gestionar(u: UsuarioAutenticado | null) {
    return u !== null && u.rol === 'PERSONAS';
  }

  /** Editar: Personas los datos; Administración del sistema solo el rol (se revisa en el servicio). */
  editar(u: UsuarioAutenticado | null) {
    return u !== null && (u.rol === 'PERSONAS' || u.rol === 'ADMIN');
  }

  restablecer2fa(u: UsuarioAutenticado | null) {
    return u !== null && u.rol === 'ADMIN';
  }
}

const fecha = z.iso.date();
const fichaSchema = z.object({
  rut: z.string().min(8).max(12),
  nombres: z.string().trim().min(2).max(80),
  apellidos: z.string().trim().min(2).max(80),
  cargo: z.string().trim().min(2).max(80),
  sedeId: z.uuid(),
  jefaturaId: z.uuid().nullable().optional(),
  fechaIngreso: fecha,
  tipoContrato: z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'OBRA_FAENA']),
  fechaTerminoContrato: fecha.nullable().optional(),
  // Jornada ordinaria máxima: 42 horas desde el 26-04-2026 (Ley 21.561).
  horasSemanales: z.number().int().min(1).max(42),
  telefono: z.string().max(30).nullable().optional(),
  email: z.email().nullable().optional(),
  rol: z.enum(ROLES).optional(),
});
const desvincularSchema = z.object({ fecha, motivo: z.string().trim().min(5).max(300) });
const importarSchema = z.object({ contenido: z.string().min(10).max(2_000_000), confirmar: z.boolean().default(false) });

@Controller('trabajadores')
export class TrabajadoresController {
  constructor(
    private readonly trabajadores: TrabajadoresService,
    private readonly fichas: FichasService,
    private readonly acceso: AccesoService,
  ) {}

  @Get('opciones-ficha')
  @Can(FichasPolicy, 'editar')
  opciones(@CurrentUser() u: UsuarioAutenticado) {
    return this.fichas.opciones(u);
  }

  @Post()
  @Can(FichasPolicy, 'gestionar')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: fichaSchema }) body: z.infer<typeof fichaSchema>, @Ip() ip: string) {
    return this.fichas.crear(u, body, ip);
  }

  @Post('importar')
  @Can(FichasPolicy, 'gestionar')
  @HttpCode(200)
  importar(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: importarSchema }) body: z.infer<typeof importarSchema>, @Ip() ip: string) {
    return this.fichas.importar(u, body.contenido, body.confirmar, ip);
  }

  @Patch(':id')
  @Can(FichasPolicy, 'editar')
  editar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: fichaSchema.partial() }) body: Partial<z.infer<typeof fichaSchema>>, @Ip() ip: string) {
    return this.fichas.editar(u, id, body, ip);
  }

  @Post(':id/desvincular')
  @Can(FichasPolicy, 'gestionar')
  @HttpCode(200)
  desvincular(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: desvincularSchema }) body: z.infer<typeof desvincularSchema>, @Ip() ip: string) {
    return this.fichas.desvincular(u, id, body.fecha, body.motivo, ip);
  }

  @Post(':id/invitacion')
  @Can(FichasPolicy, 'gestionar')
  @HttpCode(200)
  invitar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.acceso.invitar(u, id, ip);
  }

  @Post(':id/restablecer-2fa')
  @Can(FichasPolicy, 'restablecer2fa')
  @HttpCode(204)
  restablecer2fa(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.acceso.restablecer2fa(u, id, ip);
  }

  @Get()
  @Can(TrabajadoresPolicy, 'listar')
  listar(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.trabajadores.listar(usuario);
  }

  @Get('resumen')
  @Can(TrabajadoresPolicy, 'verResumen')
  resumen(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.trabajadores.resumenPorSede(usuario);
  }

  @Get(':id')
  @Can.Anyone()
  ver(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.trabajadores.ver(usuario, id, ip);
  }
}
