/**
 * Panel de gerencia (HU-21): la foto del mes en una sola respuesta.
 *
 * Reúne datos que ya calculan otros módulos (saldos, vencimientos, faltantes) para no duplicar
 * reglas. Las ausencias del mes se cuentan en días hábiles dentro del mes, para que una licencia
 * que empezó el mes anterior no infle las cifras.
 *
 * Privacidad: el panel muestra cantidades por tipo y sede, nunca diagnósticos.
 * Solo Personas, Gerencia y Administración del sistema lo ven.
 */
import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can, Policy } from '@nestjs/authorization';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { AusenciasModule } from '../ausencias/ausencias.controller.js';
import { AusenciasService } from '../ausencias/ausencias.service.js';
import { contarDiasHabiles, hoyEn, limitesDelMes } from '../ausencias/calendario-laboral.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Database } from '../db/database.js';
import { feriados, sedes, solicitudesAusencia, solicitudesTitular, tiposAusencia, trabajadores } from '../db/schema.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { DocumentosService } from '../documentos/documentos.service.js';

@Injectable()
export class PanelService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly ausencias: AusenciasService,
    private readonly documentos: DocumentosService,
  ) {}

  async resumen(usuario: UsuarioAutenticado, mes?: string) {
    const hoy = hoyEn('America/Santiago');
    const periodo = mes ?? hoy.slice(0, 7);
    const { desde, hasta } = limitesDelMes(periodo);

    const personas = await this.db
      .select({ id: trabajadores.id, sedeId: trabajadores.sedeId, tipoContrato: trabajadores.tipoContrato, horas: trabajadores.horasSemanales })
      .from(trabajadores)
      .where(and(eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO')));
    const listaSedes = await this.db.select({ id: sedes.id, nombre: sedes.nombre, zona: sedes.zonaHoraria }).from(sedes).where(eq(sedes.empresaId, usuario.empresaId)).orderBy(asc(sedes.nombre));

    const ausenciasMes = await this.db
      .select({ trabajadorId: solicitudesAusencia.trabajadorId, sedeId: trabajadores.sedeId, tipo: tiposAusencia.nombre, codigo: tiposAusencia.codigo, desde: solicitudesAusencia.desde, hasta: solicitudesAusencia.hasta })
      .from(solicitudesAusencia)
      .innerJoin(trabajadores, eq(trabajadores.id, solicitudesAusencia.trabajadorId))
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(and(eq(solicitudesAusencia.empresaId, usuario.empresaId), eq(solicitudesAusencia.estado, 'APROBADA'), lte(solicitudesAusencia.desde, hasta), gte(solicitudesAusencia.hasta, desde)));
    const setFeriados = new Set((await this.db.select({ f: feriados.fecha }).from(feriados).where(and(gte(feriados.fecha, desde), lte(feriados.fecha, hasta)))).map((x) => x.f));
    // Solo la parte del rango que cae dentro del mes consultado.
    const diasEnMes = (a: { desde: string; hasta: string }) => contarDiasHabiles(a.desde > desde ? a.desde : desde, a.hasta < hasta ? a.hasta : hasta, setFeriados);

    const saldos = await this.ausencias.saldosDelEquipo(usuario);
    const vencimientos = await this.documentos.vencimientos(usuario, 30);
    const faltantes = await this.documentos.faltantes(usuario);
    const pendientes = await this.db
      .select({ creadoEn: solicitudesAusencia.creadoEn })
      .from(solicitudesAusencia)
      .where(and(eq(solicitudesAusencia.empresaId, usuario.empresaId), eq(solicitudesAusencia.estado, 'PENDIENTE')));
    const titular = await this.db
      .select({ id: solicitudesTitular.id })
      .from(solicitudesTitular)
      .where(and(eq(solicitudesTitular.empresaId, usuario.empresaId), inArray(solicitudesTitular.estado, ['ABIERTA'])));

    const porSede = listaSedes.map((s) => {
      const gente = personas.filter((p) => p.sedeId === s.id);
      const hoySede = hoyEn(s.zona);
      const aus = ausenciasMes.filter((a) => a.sedeId === s.id);
      return {
        sedeId: s.id,
        sede: s.nombre,
        dotacion: gente.length,
        indefinidos: gente.filter((p) => p.tipoContrato === 'INDEFINIDO').length,
        plazoFijo: gente.filter((p) => p.tipoContrato !== 'INDEFINIDO').length,
        ausentesHoy: new Set(aus.filter((a) => a.desde <= hoySede && a.hasta >= hoySede).map((a) => a.trabajadorId)).size,
        diasAusenciaMes: aus.reduce((acc, a) => acc + diasEnMes(a), 0),
        vacacionesAcumuladas: Math.round(saldos.filter((x) => x.sedeId === s.id).reduce((acc, x) => acc + Math.max(0, x.saldo), 0) * 10) / 10,
      };
    });

    const porTipo = new Map<string, number>();
    for (const a of ausenciasMes) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + diasEnMes(a));
    const ahora = Date.now();

    return {
      periodo,
      hoy,
      totales: {
        dotacion: personas.length,
        ausentesHoy: porSede.reduce((a, s) => a + s.ausentesHoy, 0),
        diasAusenciaMes: porSede.reduce((a, s) => a + s.diasAusenciaMes, 0),
        vacacionesAcumuladas: Math.round(porSede.reduce((a, s) => a + s.vacacionesAcumuladas, 0) * 10) / 10,
      },
      porSede,
      ausenciasPorTipo: [...porTipo].map(([tipo, dias]) => ({ tipo, dias })).sort((a, b) => b.dias - a.dias),
      alertas: {
        solicitudesPendientes: pendientes.length,
        // Más de 3 días sin respuesta: la persona no puede planificar su viaje.
        pendientesAtrasadas: pendientes.filter((p) => ahora - p.creadoEn.getTime() > 3 * 86_400_000).length,
        vencimientos30Dias: vencimientos.items.filter((i) => i.diasRestantes >= 0).length,
        vencidos: vencimientos.items.filter((i) => i.diasRestantes < 0).length,
        contratosPorDecidir: vencimientos.items.filter((i) => i.requiereDecision).length,
        carpetasIncompletas: faltantes.personas.length,
        acumulanMasDeDosPeriodos: saldos.filter((s) => s.excedeAcumulacion).length,
        solicitudesDatosAbiertas: titular.length,
      },
    };
  }
}

@Policy()
export class PanelPolicy {
  ver(u: UsuarioAutenticado | null) {
    return u !== null && ['PERSONAS', 'GERENCIA', 'ADMIN'].includes(u.rol);
  }
}

@Controller('panel')
export class PanelController {
  constructor(private readonly panel: PanelService) {}

  @Get()
  @Can(PanelPolicy, 'ver')
  resumen(@CurrentUser() u: UsuarioAutenticado, @Query('mes') mes?: string) {
    return this.panel.resumen(u, mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : undefined);
  }
}

@Module({
  imports: [AusenciasModule, DocumentosModule],
  controllers: [PanelController],
  providers: [PanelPolicy, PanelService],
})
export class PanelModule {}
