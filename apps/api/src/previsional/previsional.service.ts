import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { AuditoriaService } from '../audit/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Database } from '../db/database.js';
import { afps, institucionesSalud, tasasAfp, trabajadores } from '../db/schema.js';
import { IndicadoresService } from './indicadores.service.js';
import { calcularLiquidacion, LIMITACIONES } from './liquidacion/calculo.js';
import { PrevisionalPolicy } from './previsional.policy.js';

export interface DatosVariablesMes {
  diasTrabajados: number;
  horasExtra: number;
  bonosImponibles: number;
  noImponibles: number;
}

@Injectable()
export class PrevisionalService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly indicadores: IndicadoresService,
    private readonly authorization: AuthorizationService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Comisión vigente de cada AFP a una fecha. Es lo que llena el selector de la
   * interfaz: al elegir una AFP, la tasa ya viene calculada.
   */
  async afpsConTasa(fecha: string) {
    const lista = await this.db.select().from(afps).orderBy(asc(afps.nombre));
    return Promise.all(
      lista.map(async (a) => {
        const [tasa] = await this.db
          .select()
          .from(tasasAfp)
          .where(and(eq(tasasAfp.afpId, a.id), lte(tasasAfp.vigenteDesde, fecha)))
          .orderBy(desc(tasasAfp.vigenteDesde))
          .limit(1);
        return { ...a, comision: tasa?.comision ?? null, vigenteDesde: tasa?.vigenteDesde ?? null, fuente: tasa?.fuente ?? null };
      }),
    );
  }

  async opciones(fecha: string) {
    const [listaAfp, salud] = await Promise.all([
      this.afpsConTasa(fecha),
      this.db.select().from(institucionesSalud).orderBy(asc(institucionesSalud.tipo), asc(institucionesSalud.nombre)),
    ]);
    return { afps: listaAfp, salud };
  }

  async registrarTasaAfp(afpId: string, vigenteDesde: string, comision: number, fuente: string, usuario: UsuarioAutenticado) {
    const [fila] = await this.db
      .insert(tasasAfp)
      .values({ afpId, vigenteDesde, comision, fuente })
      .onConflictDoUpdate({ target: [tasasAfp.afpId, tasasAfp.vigenteDesde], set: { comision, fuente, registradoEn: new Date() } })
      .returning();
    await this.auditoria.registrar({ usuario, accion: 'REGISTRAR_TASA_AFP', entidad: 'afp', entidadId: afpId, detalle: { vigenteDesde, comision, fuente } });
    return fila;
  }

  async actualizarPrevision(
    trabajadorId: string,
    cambios: { afpId?: string | null; saludId?: string | null; planIsapreUf?: number | null; sueldoBase?: number | null },
    usuario: UsuarioAutenticado,
  ) {
    const [t] = await this.db.select({ id: trabajadores.id, empresaId: trabajadores.empresaId }).from(trabajadores).where(eq(trabajadores.id, trabajadorId));
    if (!t || t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');

    // Fonasa no tiene plan en UF: se limpia para no dejar datos contradictorios.
    if (cambios.saludId) {
      const [inst] = await this.db.select().from(institucionesSalud).where(eq(institucionesSalud.id, cambios.saludId));
      if (!inst) throw new UnprocessableEntityException('Institución de salud desconocida.');
      if (inst.tipo === 'FONASA') cambios.planIsapreUf = null;
      else if (!cambios.planIsapreUf) throw new UnprocessableEntityException('Para una Isapre debes indicar el plan pactado en UF.');
    }

    await this.db.update(trabajadores).set({ ...cambios, actualizadoEn: new Date() }).where(eq(trabajadores.id, trabajadorId));
    // El sueldo no se guarda en el detalle de auditoría: basta con saber que cambió.
    const { sueldoBase, ...visible } = cambios;
    await this.auditoria.registrar({
      usuario,
      accion: 'EDITAR_PREVISION',
      entidad: 'trabajador',
      entidadId: trabajadorId,
      detalle: { ...visible, ...(sueldoBase !== undefined ? { sueldoBase: 'modificado' } : {}) },
    });
  }

  /** Liquidación de referencia de un trabajador para un período con indicadores confirmados. */
  async liquidacion(usuario: UsuarioAutenticado, trabajadorId: string, periodo: string, variables: DatosVariablesMes, ip?: string) {
    const [t] = await this.db
      .select({
        id: trabajadores.id,
        empresaId: trabajadores.empresaId,
        nombres: trabajadores.nombres,
        apellidos: trabajadores.apellidos,
        sueldoBase: trabajadores.sueldoBase,
        horasSemanales: trabajadores.horasSemanales,
        tipoContrato: trabajadores.tipoContrato,
        afpId: trabajadores.afpId,
        planIsapreUf: trabajadores.planIsapreUf,
        salud: institucionesSalud,
      })
      .from(trabajadores)
      .leftJoin(institucionesSalud, eq(institucionesSalud.id, trabajadores.saludId))
      .where(eq(trabajadores.id, trabajadorId));
    if (!t || !(await this.authorization.can(PrevisionalPolicy, 'verRemuneracion', usuario, t))) {
      throw new NotFoundException('Ficha no encontrada');
    }

    const faltantes = [!t.sueldoBase && 'sueldo base', !t.afpId && 'AFP', !t.salud && 'institución de salud'].filter(Boolean);
    if (faltantes.length) throw new UnprocessableEntityException(`Falta registrar: ${faltantes.join(', ')}.`);

    const p = await this.indicadores.confirmadosPara(periodo);
    const afp = (await this.afpsConTasa(`${periodo}-01`)).find((a) => a.id === t.afpId);
    if (!afp || afp.comision === null) throw new UnprocessableEntityException(`No hay comisión vigente para la AFP en ${periodo}.`);

    const resultado = calcularLiquidacion(
      {
        sueldoBase: t.sueldoBase!,
        horasSemanales: t.horasSemanales,
        tipoContrato: t.tipoContrato,
        afp: { nombre: afp.nombre, comision: afp.comision },
        salud: { tipo: t.salud!.tipo, nombre: t.salud!.nombre, planUf: t.planIsapreUf },
        ...variables,
      },
      p,
    );

    if (t.id !== usuario.trabajadorId) {
      await this.auditoria.registrar({ usuario, accion: 'VER_LIQUIDACION', entidad: 'trabajador', entidadId: t.id, detalle: { periodo }, ip });
    }
    return { trabajador: { id: t.id, nombres: t.nombres, apellidos: t.apellidos }, liquidacion: resultado, limitaciones: LIMITACIONES, indicadores: { periodo: p.periodo, uf: p.uf, utm: p.utm, confirmadoEn: p.confirmadoEn } };
  }
}
