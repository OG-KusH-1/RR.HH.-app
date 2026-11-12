import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Cron } from '@nestjs/schedule';
import { desc, eq, lte } from 'drizzle-orm';
import { AuditoriaService } from '../audit/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Database } from '../db/database.js';
import { indicadoresMensuales, type IndicadoresMensuales } from '../db/schema.js';
import { FUENTES_INDICADORES, type FuenteIndicadores, type ValorIndicador } from './fuentes/fuente-indicadores.js';
import { esPeriodoValido, hoyEnChile, periodoActual, periodoAnterior, ultimoDiaDelMes } from './periodo.js';

/**
 * Mantiene al día los indicadores previsionales de cada mes.
 *
 * Flujo:
 * 1. Todos los días a las 07:00 (hora de Chile) `sincronizar()` prepara el mes en curso:
 *    copia del mes anterior los parámetros que no tienen API (topes, SIS, reforma,
 *    tramos) y consulta UF y UTM en las fuentes externas. Queda en BORRADOR.
 * 2. Personas revisa el borrador contra la tabla de Previred del mes y lo CONFIRMA.
 * 3. Solo los indicadores confirmados se usan en liquidaciones. Un mes confirmado
 *    no se vuelve a sincronizar: así una liquidación ya emitida no cambia sola.
 */
@Injectable()
export class IndicadoresService {
  private readonly logger = new Logger(IndicadoresService.name);

  constructor(
    @InjectDrizzle() private readonly db: Database,
    @Inject(FUENTES_INDICADORES) private readonly fuentes: FuenteIndicadores[],
    private readonly auditoria: AuditoriaService,
  ) {}

  @Cron('0 7 * * *', { name: 'sincronizar-indicadores', timeZone: 'America/Santiago' })
  async sincronizacionDiaria() {
    if (process.env.SINCRONIZACION_AUTOMATICA === 'false') return;
    try {
      await this.sincronizar(periodoActual());
    } catch (error) {
      // No se relanza: una falla externa no debe botar la aplicación. Queda en el log y
      // la interfaz muestra la antigüedad de los datos.
      this.logger.error(`Falló la sincronización diaria: ${(error as Error).message}`);
    }
  }

  async obtener(periodo: string): Promise<IndicadoresMensuales> {
    this.validarPeriodo(periodo);
    const [fila] = await this.db.select().from(indicadoresMensuales).where(eq(indicadoresMensuales.periodo, periodo));
    if (!fila) throw new NotFoundException(`No hay indicadores para ${periodo}. Sincronízalos primero.`);
    return fila;
  }

  /** Los indicadores confirmados más recientes que no sean posteriores al período pedido. */
  async confirmadosPara(periodo: string): Promise<IndicadoresMensuales> {
    const fila = await this.obtener(periodo);
    if (fila.estado !== 'CONFIRMADO') {
      throw new ConflictException(`Los indicadores de ${periodo} todavía están en borrador. Personas debe revisarlos y confirmarlos en la sección Indicadores antes de calcular liquidaciones de ese mes.`);
    }
    return fila;
  }

  async listar() {
    return this.db.select().from(indicadoresMensuales).orderBy(desc(indicadoresMensuales.periodo)).limit(12);
  }

  /**
   * Crea o actualiza el BORRADOR de un período. Devuelve la fila y qué valores
   * no se pudieron actualizar, para mostrarlo en pantalla.
   */
  async sincronizar(periodo: string, usuario?: UsuarioAutenticado) {
    this.validarPeriodo(periodo);
    const [existente] = await this.db.select().from(indicadoresMensuales).where(eq(indicadoresMensuales.periodo, periodo));
    if (existente?.estado === 'CONFIRMADO') {
      throw new ConflictException(`${periodo} ya está confirmado y no se modifica.`);
    }

    // Base: el último mes disponible anterior al pedido.
    const [anterior] = await this.db
      .select()
      .from(indicadoresMensuales)
      .where(lte(indicadoresMensuales.periodo, periodoAnterior(periodo)))
      .orderBy(desc(indicadoresMensuales.periodo))
      .limit(1);
    const base = existente ?? anterior;
    if (!base) throw new BadRequestException('No hay un mes anterior desde el cual copiar los parámetros. Carga el primero a mano.');

    // UF: la del último día del mes; si ese día aún no llega, la de hoy.
    const hoy = hoyEnChile();
    const fechaUf = ultimoDiaDelMes(periodo) < hoy ? ultimoDiaDelMes(periodo) : hoy;
    const [uf, utm] = await Promise.all([
      this.primeraQueResponda((f) => f.uf(fechaUf)),
      this.primeraQueResponda((f) => f.utm(periodo)),
    ]);

    const consultadoEn = new Date().toISOString();
    const fuentes = { ...base.fuentes };
    const pendientes: string[] = [];
    if (uf) fuentes.uf = { fuente: `${uf.fuente}, UF al ${uf.fecha}`, consultadoEn };
    else pendientes.push('UF');
    if (utm) fuentes.utm = { fuente: utm.fuente, consultadoEn };
    else pendientes.push('UTM');
    if (!existente) {
      for (const clave of ['ingresoMinimo', 'topes', 'tasaSis', 'tasaEmpleadorReforma', 'tasaAccidentes', 'tramosImpuesto']) {
        fuentes[clave] = { fuente: `Copiado de ${base.periodo}: verificar con Previred`, consultadoEn };
      }
    }

    const valores = {
      periodo,
      estado: 'BORRADOR' as const,
      uf: uf?.valor ?? base.uf,
      utm: utm?.valor ?? base.utm,
      ingresoMinimo: base.ingresoMinimo,
      topeImponibleAfpUf: base.topeImponibleAfpUf,
      topeImponibleCesantiaUf: base.topeImponibleCesantiaUf,
      tasaSis: base.tasaSis,
      tasaEmpleadorReforma: base.tasaEmpleadorReforma,
      tasaAccidentes: base.tasaAccidentes,
      tramosImpuesto: base.tramosImpuesto,
      fuentes,
      actualizadoEn: new Date(),
    };
    const [fila] = await this.db
      .insert(indicadoresMensuales)
      .values(valores)
      .onConflictDoUpdate({ target: indicadoresMensuales.periodo, set: valores })
      .returning();

    await this.auditoria.registrar({ usuario, accion: 'SINCRONIZAR_INDICADORES', entidad: 'indicadores', entidadId: periodo, detalle: { pendientes } });
    return { indicadores: fila, pendientes };
  }

  /** Personas corrige a mano un valor del borrador (por ejemplo, la tasa SIS publicada por Previred). */
  async corregir(periodo: string, cambios: Partial<Pick<IndicadoresMensuales, 'uf' | 'utm' | 'ingresoMinimo' | 'topeImponibleAfpUf' | 'topeImponibleCesantiaUf' | 'tasaSis' | 'tasaEmpleadorReforma' | 'tasaAccidentes'>>, usuario: UsuarioAutenticado) {
    const actual = await this.obtener(periodo);
    if (actual.estado === 'CONFIRMADO') throw new ConflictException(`${periodo} ya está confirmado y no se modifica.`);
    const ahora = new Date().toISOString();
    const fuentes = { ...actual.fuentes };
    for (const clave of Object.keys(cambios)) fuentes[clave] = { fuente: `Ingresado por ${usuario.nombres} ${usuario.apellidos}`, consultadoEn: ahora };
    const [fila] = await this.db
      .update(indicadoresMensuales)
      .set({ ...cambios, fuentes, actualizadoEn: new Date() })
      .where(eq(indicadoresMensuales.periodo, periodo))
      .returning();
    await this.auditoria.registrar({ usuario, accion: 'CORREGIR_INDICADORES', entidad: 'indicadores', entidadId: periodo, detalle: cambios });
    return fila;
  }

  async confirmar(periodo: string, usuario: UsuarioAutenticado) {
    const actual = await this.obtener(periodo);
    if (actual.estado === 'CONFIRMADO') return actual;
    const [fila] = await this.db
      .update(indicadoresMensuales)
      .set({ estado: 'CONFIRMADO', confirmadoPor: usuario.id, confirmadoEn: new Date(), actualizadoEn: new Date() })
      .where(eq(indicadoresMensuales.periodo, periodo))
      .returning();
    await this.auditoria.registrar({ usuario, accion: 'CONFIRMAR_INDICADORES', entidad: 'indicadores', entidadId: periodo });
    return fila;
  }

  /** Prueba las fuentes en orden. Devuelve null si ninguna responde, sin lanzar error. */
  private async primeraQueResponda(consulta: (f: FuenteIndicadores) => Promise<ValorIndicador>): Promise<ValorIndicador | null> {
    for (const fuente of this.fuentes) {
      try {
        return await consulta(fuente);
      } catch (error) {
        this.logger.warn(`${fuente.nombre}: ${(error as Error).message}`);
      }
    }
    return null;
  }

  private validarPeriodo(periodo: string) {
    if (!esPeriodoValido(periodo)) throw new BadRequestException('El período debe tener el formato AAAA-MM.');
  }
}
