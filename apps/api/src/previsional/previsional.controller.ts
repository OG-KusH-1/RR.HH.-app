import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { z } from 'zod';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { IndicadoresService } from './indicadores.service.js';
import { hoyEnChile, periodoActual } from './periodo.js';
import { PrevisionalPolicy } from './previsional.policy.js';
import { PrevisionalService } from './previsional.service.js';

const periodoSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato AAAA-MM');

const previsionSchema = z.object({
  afpId: z.uuid().nullable().optional(),
  saludId: z.uuid().nullable().optional(),
  planIsapreUf: z.number().positive().max(100).nullable().optional(),
  sueldoBase: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

const correccionSchema = z
  .object({
    uf: z.number().positive(),
    utm: z.number().int().positive(),
    ingresoMinimo: z.number().int().positive(),
    topeImponibleAfpUf: z.number().positive(),
    topeImponibleCesantiaUf: z.number().positive(),
    tasaSis: z.number().min(0).max(10),
    tasaEmpleadorReforma: z.number().min(0).max(15),
    tasaAccidentes: z.number().min(0).max(10),
  })
  .partial();

const tasaAfpSchema = z.object({
  vigenteDesde: z.iso.date(),
  comision: z.number().min(0).max(5),
  fuente: z.string().min(5).max(300),
});

const variablesSchema = z.object({
  periodo: periodoSchema.optional(),
  diasTrabajados: z.coerce.number().int().min(0).max(30).default(30),
  horasExtra: z.coerce.number().min(0).max(200).default(0),
  bonosImponibles: z.coerce.number().int().min(0).default(0),
  noImponibles: z.coerce.number().int().min(0).default(0),
});

@Controller()
export class PrevisionalController {
  constructor(
    private readonly previsional: PrevisionalService,
    private readonly indicadores: IndicadoresService,
  ) {}

  @Get('previsional/opciones')
  @Can(PrevisionalPolicy, 'verOpciones')
  opciones() {
    return this.previsional.opciones(hoyEnChile());
  }

  @Get('previsional/indicadores')
  @Can(PrevisionalPolicy, 'verIndicadores')
  async listar() {
    return { periodoActual: periodoActual(), meses: await this.indicadores.listar() };
  }

  @Get('previsional/indicadores/:periodo')
  @Can(PrevisionalPolicy, 'verIndicadores')
  obtener(@Param('periodo', { schema: periodoSchema }) periodo: string) {
    return this.indicadores.obtener(periodo);
  }

  @Post('previsional/indicadores/:periodo/sincronizar')
  @Can(PrevisionalPolicy, 'gestionarIndicadores')
  sincronizar(@Param('periodo', { schema: periodoSchema }) periodo: string, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.indicadores.sincronizar(periodo, usuario);
  }

  @Patch('previsional/indicadores/:periodo')
  @Can(PrevisionalPolicy, 'gestionarIndicadores')
  corregir(
    @Param('periodo', { schema: periodoSchema }) periodo: string,
    @Body({ schema: correccionSchema }) cambios: z.infer<typeof correccionSchema>,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.indicadores.corregir(periodo, cambios, usuario);
  }

  @Post('previsional/indicadores/:periodo/confirmar')
  @Can(PrevisionalPolicy, 'gestionarIndicadores')
  confirmar(@Param('periodo', { schema: periodoSchema }) periodo: string, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.indicadores.confirmar(periodo, usuario);
  }

  @Post('previsional/afps/:id/tasas')
  @Can(PrevisionalPolicy, 'gestionarIndicadores')
  registrarTasa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: tasaAfpSchema }) body: z.infer<typeof tasaAfpSchema>,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.previsional.registrarTasaAfp(id, body.vigenteDesde, body.comision, body.fuente, usuario);
  }

  @Patch('trabajadores/:id/prevision')
  @Can(PrevisionalPolicy, 'editarPrevision')
  async actualizarPrevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: previsionSchema }) body: z.infer<typeof previsionSchema>,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    await this.previsional.actualizarPrevision(id, body, usuario);
    return { ok: true };
  }

  /** El permiso se revisa en el servicio, después de cargar la ficha (depende de quién es el trabajador). */
  @Get('trabajadores/:id/liquidacion')
  @Can.Anyone()
  liquidacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Query({ schema: variablesSchema }) q: z.infer<typeof variablesSchema>,
    @CurrentUser() usuario: UsuarioAutenticado,
    @Ip() ip: string,
  ) {
    const { periodo, ...variables } = q;
    return this.previsional.liquidacion(usuario, id, periodo ?? periodoActual(), variables, ip);
  }
}
