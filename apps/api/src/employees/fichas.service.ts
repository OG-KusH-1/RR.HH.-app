/**
 * Administración de fichas (HU-05 y HU-07), en manos de Personas.
 *
 * - Crear una ficha crea también su usuario (rol Trabajador, sin contraseña): la persona
 *   la crea con una invitación (HU-02).
 * - Cada cambio guarda en auditoría qué campos cambiaron, con valor anterior y nuevo.
 *   El sueldo se edita en el módulo previsional y nunca se escribe en la auditoría.
 * - Desvincular no borra nada: la ficha queda inactiva, se cierran sus sesiones y se informa
 *   el saldo de vacaciones a la fecha, que es la base del feriado proporcional del finiquito.
 * - Roles: Personas asigna roles de negocio; solo Administración del sistema asigna ADMIN,
 *   y nadie cambia su propio rol (evita escalar permisos desde la propia cuenta).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { AuditoriaService } from '../audit/auditoria.service.js';
import { hoyEn } from '../ausencias/calendario-laboral.js';
import { calcularSaldo } from '../ausencias/saldo-vacaciones.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Rol } from '../common/roles.js';
import { normalizarRut } from '../common/rut.js';
import type { Database } from '../db/database.js';
import { movimientosVacaciones, sedes, sesiones, trabajadores, usuarios } from '../db/schema.js';
import { leerPlanilla } from './planilla.js';

export interface DatosFicha {
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  sedeId: string;
  jefaturaId?: string | null;
  fechaIngreso: string;
  tipoContrato: 'INDEFINIDO' | 'PLAZO_FIJO' | 'OBRA_FAENA';
  fechaTerminoContrato?: string | null;
  horasSemanales: number;
  telefono?: string | null;
  email?: string | null;
  rol?: Rol;
}

const CAMPOS_AUDITABLES = ['rut', 'nombres', 'apellidos', 'cargo', 'sedeId', 'jefaturaId', 'fechaIngreso', 'tipoContrato', 'fechaTerminoContrato', 'horasSemanales', 'telefono', 'email'] as const;

@Injectable()
export class FichasService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Datos para los selectores del formulario. */
  async opciones(usuario: UsuarioAutenticado) {
    const listaSedes = await this.db.select({ id: sedes.id, nombre: sedes.nombre }).from(sedes).where(eq(sedes.empresaId, usuario.empresaId)).orderBy(asc(sedes.nombre));
    const jefaturas = await this.db
      .select({ id: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, cargo: trabajadores.cargo, rol: usuarios.rol })
      .from(trabajadores)
      .innerJoin(usuarios, eq(usuarios.trabajadorId, trabajadores.id))
      .where(and(eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO'), inArray(usuarios.rol, ['JEFATURA', 'GERENCIA', 'PERSONAS'])))
      .orderBy(asc(trabajadores.apellidos));
    return { sedes: listaSedes, jefaturas };
  }

  private validarCoherencia(d: Partial<DatosFicha>) {
    if (d.tipoContrato === 'PLAZO_FIJO' && !d.fechaTerminoContrato) throw new BadRequestException('Un contrato a plazo fijo necesita fecha de término.');
    if (d.fechaTerminoContrato && d.fechaIngreso && d.fechaTerminoContrato < d.fechaIngreso) throw new BadRequestException('La fecha de término es anterior al ingreso.');
  }

  private async validarReferencias(usuario: UsuarioAutenticado, d: Partial<DatosFicha>, idPropio?: string) {
    if (d.sedeId) {
      const [s] = await this.db.select({ id: sedes.id }).from(sedes).where(and(eq(sedes.id, d.sedeId), eq(sedes.empresaId, usuario.empresaId)));
      if (!s) throw new BadRequestException('Sede desconocida.');
    }
    if (d.jefaturaId) {
      if (d.jefaturaId === idPropio) throw new BadRequestException('Una persona no puede ser su propia jefatura.');
      const [j] = await this.db.select({ id: trabajadores.id }).from(trabajadores).where(and(eq(trabajadores.id, d.jefaturaId), eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO')));
      if (!j) throw new BadRequestException('Jefatura desconocida.');
    }
  }

  private validarRol(usuario: UsuarioAutenticado, rol: Rol | undefined, idObjetivo?: string) {
    if (!rol) return;
    if (idObjetivo === usuario.trabajadorId) throw new ForbiddenException('Nadie puede cambiar su propio rol.');
    if (rol === 'ADMIN' && usuario.rol !== 'ADMIN') throw new ForbiddenException('Solo Administración del sistema asigna ese rol.');
  }

  async crear(usuario: UsuarioAutenticado, d: DatosFicha, ip?: string) {
    const rut = normalizarRut(d.rut);
    if (!rut) throw new BadRequestException('RUT inválido.');
    this.validarCoherencia(d);
    this.validarRol(usuario, d.rol);
    await this.validarReferencias(usuario, d);
    const [existe] = await this.db.select({ id: trabajadores.id }).from(trabajadores).where(and(eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.rut, rut)));
    if (existe) throw new ConflictException('Ese RUT ya tiene ficha en la empresa.');
    const t = await this.db.transaction(async (tx) => {
      const [nuevo] = await tx
        .insert(trabajadores)
        .values({ ...this.columnas(d), rut, empresaId: usuario.empresaId })
        .returning();
      await tx.insert(usuarios).values({ trabajadorId: nuevo.id, rol: d.rol ?? 'TRABAJADOR' });
      return nuevo;
    });
    await this.auditoria.registrar({ usuario, accion: 'CREAR_FICHA', entidad: 'trabajador', entidadId: t.id, ip, detalle: { rut, rol: d.rol ?? 'TRABAJADOR' } });
    return t;
  }

  private columnas(d: Partial<DatosFicha>) {
    const c: Partial<typeof trabajadores.$inferInsert> = {};
    if (d.nombres !== undefined) c.nombres = d.nombres.trim();
    if (d.apellidos !== undefined) c.apellidos = d.apellidos.trim();
    if (d.cargo !== undefined) c.cargo = d.cargo.trim();
    if (d.sedeId !== undefined) c.sedeId = d.sedeId;
    if (d.jefaturaId !== undefined) c.jefaturaId = d.jefaturaId;
    if (d.fechaIngreso !== undefined) c.fechaIngreso = d.fechaIngreso;
    if (d.tipoContrato !== undefined) c.tipoContrato = d.tipoContrato;
    if (d.fechaTerminoContrato !== undefined) c.fechaTerminoContrato = d.tipoContrato === 'INDEFINIDO' ? null : d.fechaTerminoContrato;
    if (d.horasSemanales !== undefined) c.horasSemanales = d.horasSemanales;
    if (d.telefono !== undefined) c.telefono = d.telefono?.trim() || null;
    if (d.email !== undefined) c.email = d.email?.trim() || null;
    return c as typeof trabajadores.$inferInsert;
  }

  async editar(usuario: UsuarioAutenticado, id: string, d: Partial<DatosFicha>, ip?: string) {
    const [actual] = await this.db.select().from(trabajadores).where(eq(trabajadores.id, id));
    if (!actual || actual.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    // Administración del sistema solo cambia roles; los datos de la persona son de Personas.
    if (usuario.rol === 'ADMIN' && Object.keys(d).some((k) => k !== 'rol')) throw new ForbiddenException('Administración del sistema solo puede cambiar roles.');
    this.validarRol(usuario, d.rol, id);
    const rut = d.rut !== undefined ? normalizarRut(d.rut) : actual.rut;
    if (!rut) throw new BadRequestException('RUT inválido.');
    this.validarCoherencia({ ...actual, ...d });
    await this.validarReferencias(usuario, d, id);

    const cambios = this.columnas({ ...d, tipoContrato: d.tipoContrato ?? actual.tipoContrato });
    if (d.rut !== undefined) cambios.rut = rut;
    const diferencias: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const campo of CAMPOS_AUDITABLES) {
      const nuevo = (cambios as Record<string, unknown>)[campo];
      if (nuevo !== undefined && nuevo !== (actual as Record<string, unknown>)[campo]) diferencias[campo] = { antes: (actual as Record<string, unknown>)[campo], despues: nuevo };
    }
    if (Object.keys(diferencias).length) await this.db.update(trabajadores).set({ ...cambios, actualizadoEn: new Date() }).where(eq(trabajadores.id, id));
    if (d.rol) {
      const [u] = await this.db.select({ rol: usuarios.rol }).from(usuarios).where(eq(usuarios.trabajadorId, id));
      if (u && u.rol !== d.rol) {
        await this.db.update(usuarios).set({ rol: d.rol, actualizadoEn: new Date() }).where(eq(usuarios.trabajadorId, id));
        diferencias.rol = { antes: u.rol, despues: d.rol };
      }
    }
    if (Object.keys(diferencias).length) await this.auditoria.registrar({ usuario, accion: 'EDITAR_FICHA', entidad: 'trabajador', entidadId: id, ip, detalle: { cambios: diferencias } });
    return { ok: true, camposCambiados: Object.keys(diferencias) };
  }

  async desvincular(usuario: UsuarioAutenticado, id: string, fecha: string, motivo: string, ip?: string) {
    const [t] = await this.db.select({ t: trabajadores, zona: sedes.zonaHoraria }).from(trabajadores).innerJoin(sedes, eq(sedes.id, trabajadores.sedeId)).where(eq(trabajadores.id, id));
    if (!t || t.t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    if (t.t.id === usuario.trabajadorId) throw new ForbiddenException('No puedes desvincular tu propia ficha.');
    if (t.t.estado !== 'ACTIVO') throw new ConflictException('La persona ya está desvinculada.');
    if (fecha < t.t.fechaIngreso) throw new BadRequestException('La fecha es anterior al ingreso.');
    const [{ suma } = { suma: '0' }] = await this.db.select({ suma: sql<string>`coalesce(sum(${movimientosVacaciones.dias}), 0)` }).from(movimientosVacaciones).where(eq(movimientosVacaciones.trabajadorId, id));
    const saldo = calcularSaldo({ fechaIngreso: t.t.fechaIngreso, aniosPrevios: t.t.aniosPreviosReconocidos, fechaCorte: fecha, movimientos: Number(suma) });
    await this.db.transaction(async (tx) => {
      await tx.update(trabajadores).set({ estado: 'DESVINCULADO', fechaDesvinculacion: fecha, actualizadoEn: new Date() }).where(eq(trabajadores.id, id));
      const [u] = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.trabajadorId, id));
      if (u) await tx.delete(sesiones).where(eq(sesiones.usuarioId, u.id));
    });
    await this.auditoria.registrar({ usuario, accion: 'DESVINCULAR', entidad: 'trabajador', entidadId: id, ip, detalle: { fecha, motivo } });
    // El cálculo en pesos del feriado proporcional (art. 73 CT) lo hace el contador en el finiquito.
    return { ok: true, saldoVacacionesAlTermino: saldo.saldo, nota: 'Días hábiles de vacaciones pendientes a la fecha de término, base del feriado proporcional del finiquito.' };
  }

  /** HU-07: valida todo y, solo si no hay errores y se confirma, carga en una transacción. */
  async importar(usuario: UsuarioAutenticado, contenido: string, confirmar: boolean, ip?: string) {
    const listaSedes = await this.db.select({ id: sedes.id, nombre: sedes.nombre, zona: sedes.zonaHoraria }).from(sedes).where(eq(sedes.empresaId, usuario.empresaId));
    const existentes = await this.db.select({ id: trabajadores.id, rut: trabajadores.rut }).from(trabajadores).where(eq(trabajadores.empresaId, usuario.empresaId));
    const { filas, errores } = leerPlanilla(contenido, { sedes: listaSedes.map((s) => s.nombre), rutsExistentes: new Set(existentes.map((e) => e.rut)), hoy: hoyEn('America/Santiago') });
    const vista = filas.map((f) => ({ fila: f.fila, rut: f.rut, nombre: `${f.nombres} ${f.apellidos}`, cargo: f.cargo, sede: f.sede, tipoContrato: f.tipoContrato, saldoVacaciones: f.saldoVacaciones }));
    if (errores.length || !confirmar) return { cargados: 0, validas: filas.length, errores, vista };

    const idPorRut = new Map(existentes.map((e) => [e.rut, e.id]));
    await this.db.transaction(async (tx) => {
      // Primero todas las fichas, después las jefaturas: una jefatura puede venir más abajo en la planilla.
      for (const f of filas) {
        const sede = listaSedes.find((s) => s.nombre === f.sede)!;
        const [t] = await tx
          .insert(trabajadores)
          .values({ empresaId: usuario.empresaId, sedeId: sede.id, rut: f.rut, nombres: f.nombres, apellidos: f.apellidos, cargo: f.cargo, fechaIngreso: f.fechaIngreso, tipoContrato: f.tipoContrato, horasSemanales: f.horasSemanales, telefono: f.telefono, email: f.email, fechaTerminoContrato: f.fechaTerminoContrato })
          .returning({ id: trabajadores.id });
        idPorRut.set(f.rut, t.id);
        await tx.insert(usuarios).values({ trabajadorId: t.id, rol: 'TRABAJADOR' });
        if (f.saldoVacaciones !== null) {
          // El saldo de la planilla manda: se registra la diferencia con lo devengado como días ya tomados.
          const devengado = calcularSaldo({ fechaIngreso: f.fechaIngreso, aniosPrevios: 0, fechaCorte: hoyEn(sede.zona), movimientos: 0 }).devengado;
          const diferencia = Math.round((f.saldoVacaciones - devengado) * 100) / 100;
          if (diferencia !== 0) await tx.insert(movimientosVacaciones).values({ trabajadorId: t.id, fecha: hoyEn(sede.zona), tipo: 'TOMADO_ANTERIOR', dias: diferencia, motivo: `Saldo inicial de la planilla de carga: ${f.saldoVacaciones} días`, creadoPor: usuario.id });
        }
      }
      for (const f of filas) {
        if (f.rutJefatura) await tx.update(trabajadores).set({ jefaturaId: idPorRut.get(f.rutJefatura)! }).where(eq(trabajadores.id, idPorRut.get(f.rut)!));
      }
    });
    await this.auditoria.registrar({ usuario, accion: 'IMPORTAR_PLANILLA', entidad: 'trabajador', ip, detalle: { cantidad: filas.length } });
    return { cargados: filas.length, validas: filas.length, errores: [], vista };
  }
}
