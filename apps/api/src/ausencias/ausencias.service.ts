/**
 * Vacaciones, permisos y licencias (épica E3: HU-08 a HU-13).
 *
 * Flujo:
 *   trabajador solicita → se valida (saldo, cruces, días hábiles) → aviso a la jefatura
 *   → la jefatura aprueba o rechaza viendo quién más falta → el saldo se descuenta con
 *   un movimiento en el libro → aviso al trabajador.
 *
 * Reglas de privacidad:
 * - La jefatura ve fechas y tipo de ausencia de su equipo, nunca el detalle reservado
 *   (diagnóstico, folio de licencia). Ese campo solo sale hacia el titular y Personas.
 * - Toda resolución, ajuste de saldo y lectura de un detalle reservado queda en auditoría.
 *
 * Límites conocidos (ver docs/12-vacaciones-y-documentos.md):
 * - No valida el fraccionamiento del art. 70 (10 días continuos como mínimo); se informa en pantalla.
 * - Una solicitud que cruza el cambio de año usa los feriados de ambos años, si están cargados.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { AuditoriaService } from '../audit/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosService } from '../avisos/avisos.service.js';
import type { Database } from '../db/database.js';
import { feriados, movimientosVacaciones, sedes, solicitudesAusencia, tiposAusencia, trabajadores, usuarios, type TipoAusencia } from '../db/schema.js';
import { alcanceListado, puedeVerFicha } from '../employees/alcance.js';
import { hoyEn, limitesDelMes } from './calendario-laboral.js';
import { formatearDias, puedeResolver, puedeVerDetalleReservado, puedeVerSolicitud, validarSolicitud } from './reglas-solicitud.js';
import { calcularSaldo } from './saldo-vacaciones.js';

export interface DatosSolicitud {
  tipoCodigo: string;
  desde: string;
  hasta: string;
  comentario?: string;
  detalleReservado?: string;
  /** Solo Personas puede registrar a nombre de otra persona (por ejemplo, una licencia que llegó por papel). */
  trabajadorId?: string;
}

type Ambito = 'mias' | 'equipo' | 'todas';

@Injectable()
export class AusenciasService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  // ---------------------------------------------------------------- catálogos

  tipos() {
    return this.db.select().from(tiposAusencia).where(eq(tiposAusencia.activo, true)).orderBy(asc(tiposAusencia.nombre));
  }

  private async tipoPorCodigo(codigo: string): Promise<TipoAusencia> {
    const [tipo] = await this.db.select().from(tiposAusencia).where(and(eq(tiposAusencia.codigo, codigo), eq(tiposAusencia.activo, true)));
    if (!tipo) throw new BadRequestException('Tipo de ausencia desconocido.');
    return tipo;
  }

  listarFeriados(anio: number) {
    return this.db
      .select()
      .from(feriados)
      .where(and(gte(feriados.fecha, `${anio}-01-01`), lte(feriados.fecha, `${anio}-12-31`)))
      .orderBy(asc(feriados.fecha));
  }

  async registrarFeriado(usuario: UsuarioAutenticado, f: { fecha: string; nombre: string; irrenunciable: boolean; fuente: string }) {
    await this.db.insert(feriados).values(f).onConflictDoUpdate({ target: feriados.fecha, set: { nombre: f.nombre, irrenunciable: f.irrenunciable, fuente: f.fuente } });
    await this.auditoria.registrar({ usuario, accion: 'REGISTRAR_FERIADO', entidad: 'feriado', entidadId: f.fecha, detalle: { nombre: f.nombre } });
  }

  async eliminarFeriado(usuario: UsuarioAutenticado, fecha: string) {
    await this.db.delete(feriados).where(eq(feriados.fecha, fecha));
    await this.auditoria.registrar({ usuario, accion: 'ELIMINAR_FERIADO', entidad: 'feriado', entidadId: fecha });
  }

  /** Feriados entre dos fechas, con un margen para rangos que cruzan de año. */
  private async feriadosEntre(desde: string, hasta: string): Promise<Set<string>> {
    const filas = await this.db
      .select({ fecha: feriados.fecha })
      .from(feriados)
      .where(and(gte(feriados.fecha, desde), lte(feriados.fecha, hasta)));
    return new Set(filas.map((f) => f.fecha));
  }

  // ---------------------------------------------------------------- saldo

  private async trabajador(id: string) {
    const [t] = await this.db
      .select({
        id: trabajadores.id,
        empresaId: trabajadores.empresaId,
        jefaturaId: trabajadores.jefaturaId,
        nombres: trabajadores.nombres,
        apellidos: trabajadores.apellidos,
        fechaIngreso: trabajadores.fechaIngreso,
        aniosPrevios: trabajadores.aniosPreviosReconocidos,
        zonaHoraria: sedes.zonaHoraria,
        sedeId: sedes.id,
      })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(eq(trabajadores.id, id));
    return t;
  }

  private async sumaMovimientos(trabajadorId: string, db: Pick<Database, 'select'> = this.db): Promise<number> {
    const [fila] = await db
      .select({ total: sql<string>`coalesce(sum(${movimientosVacaciones.dias}), 0)` })
      .from(movimientosVacaciones)
      .where(eq(movimientosVacaciones.trabajadorId, trabajadorId));
    return Number(fila?.total ?? 0);
  }

  /** Saldo con su explicación línea por línea (HU-08). */
  async saldo(usuario: UsuarioAutenticado, trabajadorId: string) {
    const t = await this.trabajador(trabajadorId);
    // 404 también sin permiso, para no revelar qué fichas existen (mismo criterio que la ficha).
    if (!t || !puedeVerFicha(usuario, t)) throw new NotFoundException('Ficha no encontrada');
    const hoy = hoyEn(t.zonaHoraria);
    const movimientos = await this.db
      .select({
        id: movimientosVacaciones.id,
        fecha: movimientosVacaciones.fecha,
        tipo: movimientosVacaciones.tipo,
        dias: movimientosVacaciones.dias,
        motivo: movimientosVacaciones.motivo,
        solicitudId: movimientosVacaciones.solicitudId,
      })
      .from(movimientosVacaciones)
      .where(eq(movimientosVacaciones.trabajadorId, trabajadorId))
      .orderBy(desc(movimientosVacaciones.fecha), desc(movimientosVacaciones.creadoEn));
    const suma = movimientos.reduce((acc, m) => acc + m.dias, 0);
    const saldo = calcularSaldo({ fechaIngreso: t.fechaIngreso, aniosPrevios: t.aniosPrevios, fechaCorte: hoy, movimientos: suma });
    const [pendiente] = await this.db
      .select({ dias: sql<string>`coalesce(sum(${solicitudesAusencia.diasHabiles}), 0)` })
      .from(solicitudesAusencia)
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(and(eq(solicitudesAusencia.trabajadorId, trabajadorId), eq(solicitudesAusencia.estado, 'PENDIENTE'), eq(tiposAusencia.afectaSaldo, true)));
    return {
      trabajador: { id: t.id, nombres: t.nombres, apellidos: t.apellidos, fechaIngreso: t.fechaIngreso, aniosPrevios: t.aniosPrevios },
      hoy,
      ...saldo,
      diasEnSolicitudesPendientes: Number(pendiente?.dias ?? 0),
      movimientosDetalle: movimientos,
    };
  }

  // ---------------------------------------------------------------- solicitudes

  /** Calcula y valida sin guardar: alimenta la vista previa del formulario. */
  async previsualizar(usuario: UsuarioAutenticado, d: DatosSolicitud) {
    const { tipo, t, validacion, saldo } = await this.preparar(usuario, d);
    return { tipo: { codigo: tipo.codigo, nombre: tipo.nombre, afectaSaldo: tipo.afectaSaldo }, trabajadorId: t.id, ...validacion, disponible: saldo.disponible };
  }

  private async preparar(usuario: UsuarioAutenticado, d: DatosSolicitud, excluirSolicitudId?: string, db: Database = this.db) {
    const trabajadorId = d.trabajadorId ?? usuario.trabajadorId;
    if (trabajadorId !== usuario.trabajadorId && usuario.rol !== 'PERSONAS' && !excluirSolicitudId) {
      throw new ForbiddenException('Solo Personas puede registrar ausencias a nombre de otra persona.');
    }
    const t = await this.trabajador(trabajadorId);
    if (!t || t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    const tipo = await this.tipoPorCodigo(d.tipoCodigo);
    const hoy = hoyEn(t.zonaHoraria);
    const condiciones: SQL[] = [eq(solicitudesAusencia.trabajadorId, t.id)];
    if (excluirSolicitudId) condiciones.push(ne(solicitudesAusencia.id, excluirSolicitudId));
    const existentes = await db
      .select({ desde: solicitudesAusencia.desde, hasta: solicitudesAusencia.hasta, estado: solicitudesAusencia.estado })
      .from(solicitudesAusencia)
      .where(and(...condiciones));
    const saldo = calcularSaldo({ fechaIngreso: t.fechaIngreso, aniosPrevios: t.aniosPrevios, fechaCorte: hoy, movimientos: await this.sumaMovimientos(t.id, db) });
    // Los días de otras solicitudes pendientes quedan reservados: si no, se podrían pedir dos veces los mismos días.
    const condPendientes: SQL[] = [eq(solicitudesAusencia.trabajadorId, t.id), eq(solicitudesAusencia.estado, 'PENDIENTE'), eq(tiposAusencia.afectaSaldo, true)];
    if (excluirSolicitudId) condPendientes.push(ne(solicitudesAusencia.id, excluirSolicitudId));
    const [{ reservados } = { reservados: '0' }] = await db
      .select({ reservados: sql<string>`coalesce(sum(${solicitudesAusencia.diasHabiles}), 0)` })
      .from(solicitudesAusencia)
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(and(...condPendientes));
    const disponibleEfectivo = Math.max(0, saldo.disponible - Number(reservados));
    // Personas puede registrar retroactivo cualquier tipo (regularizar), el resto según el tipo.
    const tipoValidacion = usuario.rol === 'PERSONAS' && trabajadorId !== usuario.trabajadorId ? { ...tipo, permiteRetroactivo: true } : tipo;
    const validacion = validarSolicitud({
      tipo: tipoValidacion,
      desde: d.desde,
      hasta: d.hasta,
      hoy,
      feriados: await this.feriadosEntre(d.desde, d.hasta),
      disponible: disponibleEfectivo,
      existentes,
    });
    return { tipo, t, hoy, validacion, saldo: { ...saldo, disponible: disponibleEfectivo } };
  }

  async crear(usuario: UsuarioAutenticado, d: DatosSolicitud, ip?: string) {
    const { tipo, t, validacion } = await this.preparar(usuario, d);
    if (validacion.problemas.length) throw new BadRequestException({ mensaje: validacion.problemas.join(' '), problemas: validacion.problemas });
    if (tipo.sensible === false && d.detalleReservado) d.detalleReservado = undefined;

    // Un tipo sin aprobación (licencia médica) queda registrado al informarlo: no es algo que se autorice.
    const directa = !tipo.requiereAprobacion;
    const [solicitud] = await this.db
      .insert(solicitudesAusencia)
      .values({
        empresaId: t.empresaId,
        trabajadorId: t.id,
        tipoId: tipo.id,
        desde: d.desde,
        hasta: d.hasta,
        diasHabiles: validacion.diasHabiles,
        estado: directa ? 'APROBADA' : 'PENDIENTE',
        comentario: d.comentario?.trim() || null,
        detalleReservado: d.detalleReservado?.trim() || null,
        creadaPor: usuario.id,
        resueltaPor: directa ? usuario.id : null,
        resueltaEn: directa ? new Date() : null,
      })
      .returning();

    await this.auditoria.registrar({
      usuario,
      accion: 'SOLICITAR_AUSENCIA',
      entidad: 'solicitud_ausencia',
      entidadId: solicitud.id,
      ip,
      detalle: { tipo: tipo.codigo, desde: d.desde, hasta: d.hasta, diasHabiles: validacion.diasHabiles, aNombreDe: t.id !== usuario.trabajadorId ? t.id : undefined },
    });

    const nombre = `${t.nombres} ${t.apellidos.split(' ')[0]}`;
    const fechas = rango(d.desde, d.hasta);
    if (directa) {
      // Licencias: Personas debe saberlo siempre; la jefatura, solo que la persona estará ausente.
      const personas = await this.avisos.trabajadoresConRol(t.empresaId, ['PERSONAS']);
      await this.avisos.crear({ empresaId: t.empresaId, destinatarios: personas.filter((p) => p !== usuario.trabajadorId), tipo: 'AUSENCIA_INFORMADA', titulo: `${nombre} informó ${tipo.nombre.toLowerCase()}`, mensaje: fechas, enlace: `/ausencias/${solicitud.id}` });
      if (t.jefaturaId) await this.avisos.crear({ empresaId: t.empresaId, destinatarios: [t.jefaturaId], tipo: 'AUSENCIA_INFORMADA', titulo: `${nombre} estará ausente`, mensaje: fechas, enlace: `/calendario` });
    } else {
      const aprobadores = t.jefaturaId ? [t.jefaturaId] : await this.avisos.trabajadoresConRol(t.empresaId, ['PERSONAS']);
      await this.avisos.crear({
        empresaId: t.empresaId,
        destinatarios: aprobadores.filter((a) => a !== t.id),
        tipo: 'SOLICITUD_PENDIENTE',
        titulo: `${nombre} pide ${tipo.nombre.toLowerCase()}`,
        mensaje: `${fechas}${tipo.afectaSaldo ? `, ${formatearDias(validacion.diasHabiles)} hábiles` : ''}.`,
        enlace: `/ausencias/${solicitud.id}`,
      });
    }
    if (t.id !== usuario.trabajadorId) {
      await this.avisos.crear({ empresaId: t.empresaId, destinatarios: [t.id], tipo: 'AUSENCIA_REGISTRADA', titulo: `Personas registró ${tipo.nombre.toLowerCase()} a tu nombre`, mensaje: fechas, enlace: `/ausencias/${solicitud.id}` });
    }
    return solicitud;
  }

  /** Listado según ámbito y rol. El filtro va en SQL: nunca se traen filas que el usuario no puede ver. */
  async listar(usuario: UsuarioAutenticado, ambito: Ambito, estado?: string) {
    const condiciones: SQL[] = [eq(solicitudesAusencia.empresaId, usuario.empresaId)];
    if (ambito === 'mias') {
      condiciones.push(eq(solicitudesAusencia.trabajadorId, usuario.trabajadorId));
    } else {
      const alcance = alcanceListado(usuario);
      if (alcance.tipo === 'propio') throw new ForbiddenException('No tienes un equipo a cargo.');
      if (alcance.tipo === 'equipo' || ambito === 'equipo') {
        if (alcance.tipo === 'equipo') condiciones.push(eq(trabajadores.jefaturaId, usuario.trabajadorId));
      }
      // Nadie ve sus propias solicitudes en la bandeja de aprobación.
      condiciones.push(ne(solicitudesAusencia.trabajadorId, usuario.trabajadorId));
    }
    if (estado) condiciones.push(eq(solicitudesAusencia.estado, estado as 'PENDIENTE'));
    return this.db
      .select({
        id: solicitudesAusencia.id,
        trabajadorId: solicitudesAusencia.trabajadorId,
        nombres: trabajadores.nombres,
        apellidos: trabajadores.apellidos,
        sede: sedes.nombre,
        tipo: tiposAusencia.nombre,
        tipoCodigo: tiposAusencia.codigo,
        desde: solicitudesAusencia.desde,
        hasta: solicitudesAusencia.hasta,
        diasHabiles: solicitudesAusencia.diasHabiles,
        estado: solicitudesAusencia.estado,
        creadoEn: solicitudesAusencia.creadoEn,
      })
      .from(solicitudesAusencia)
      .innerJoin(trabajadores, eq(trabajadores.id, solicitudesAusencia.trabajadorId))
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(and(...condiciones))
      .orderBy(sql`case when ${solicitudesAusencia.estado} = 'PENDIENTE' then 0 else 1 end`, desc(solicitudesAusencia.desde))
      .limit(200);
  }

  private async cargar(id: string, db: Database = this.db, bloquear = false) {
    const consulta = db
      .select({ s: solicitudesAusencia, tipo: tiposAusencia, t: { id: trabajadores.id, empresaId: trabajadores.empresaId, jefaturaId: trabajadores.jefaturaId, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, sede: sedes.nombre, zonaHoraria: sedes.zonaHoraria } })
      .from(solicitudesAusencia)
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .innerJoin(trabajadores, eq(trabajadores.id, solicitudesAusencia.trabajadorId))
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(eq(solicitudesAusencia.id, id));
    // FOR UPDATE: dos jefaturas aprobando a la vez no pueden descontar el saldo dos veces.
    const [fila] = bloquear ? await consulta.for('update', { of: solicitudesAusencia }) : await consulta;
    return fila;
  }

  /** Detalle con las ausencias del equipo en las mismas fechas (HU-10). */
  async ver(usuario: UsuarioAutenticado, id: string, ip?: string) {
    const fila = await this.cargar(id);
    if (!fila || !puedeVerSolicitud(usuario, fila.t)) throw new NotFoundException('Solicitud no encontrada');
    const { s, tipo, t } = fila;
    const veReservado = puedeVerDetalleReservado(usuario, t);
    if (veReservado && s.detalleReservado && t.id !== usuario.trabajadorId) {
      await this.auditoria.registrar({ usuario, accion: 'VER_DETALLE_RESERVADO', entidad: 'solicitud_ausencia', entidadId: s.id, ip });
    }

    // Compañeros del mismo equipo (misma jefatura) ausentes en esas fechas.
    const coincidencias = t.jefaturaId
      ? await this.db
          .select({ nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, tipo: tiposAusencia.nombre, desde: solicitudesAusencia.desde, hasta: solicitudesAusencia.hasta, estado: solicitudesAusencia.estado })
          .from(solicitudesAusencia)
          .innerJoin(trabajadores, eq(trabajadores.id, solicitudesAusencia.trabajadorId))
          .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
          .where(
            and(
              eq(trabajadores.jefaturaId, t.jefaturaId),
              ne(solicitudesAusencia.id, s.id),
              inArray(solicitudesAusencia.estado, ['APROBADA', 'PENDIENTE']),
              lte(solicitudesAusencia.desde, s.hasta),
              gte(solicitudesAusencia.hasta, s.desde),
            ),
          )
      : [];
    const [{ total: equipo } = { total: 0 }] = t.jefaturaId
      ? await this.db.select({ total: sql<number>`count(*)::int` }).from(trabajadores).where(and(eq(trabajadores.jefaturaId, t.jefaturaId), eq(trabajadores.estado, 'ACTIVO')))
      : [];

    const resolvedor = s.resueltaPor ? await this.nombreUsuario(s.resueltaPor) : null;
    const saldo = tipo.afectaSaldo && s.estado === 'PENDIENTE' ? await this.saldo(usuario, t.id).catch(() => null) : null;

    return {
      ...s,
      detalleReservado: veReservado ? s.detalleReservado : undefined,
      tieneDetalleReservado: Boolean(s.detalleReservado),
      tipo: { codigo: tipo.codigo, nombre: tipo.nombre, afectaSaldo: tipo.afectaSaldo, sensible: tipo.sensible },
      trabajador: { id: t.id, nombres: t.nombres, apellidos: t.apellidos, sede: t.sede },
      resueltaPorNombre: resolvedor,
      puedeResolver: s.estado === 'PENDIENTE' && puedeResolver(usuario, t),
      puedeCancelar: this.puedeCancelar(usuario, s, t.id, hoyEn(t.zonaHoraria)),
      saldoDisponible: saldo?.disponible ?? null,
      coincidencias,
      tamanoEquipo: equipo,
    };
  }

  private puedeCancelar(usuario: UsuarioAutenticado, s: { estado: string; desde: string }, titularId: string, hoy: string) {
    const esTitularOPersonas = titularId === usuario.trabajadorId || usuario.rol === 'PERSONAS';
    if (!esTitularOPersonas) return false;
    if (s.estado === 'PENDIENTE') return true;
    // Una vez iniciadas, las vacaciones ya no se anulan desde el portal: se ajusta con Personas.
    return s.estado === 'APROBADA' && s.desde > hoy;
  }

  private async nombreUsuario(usuarioId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ nombres: trabajadores.nombres, apellidos: trabajadores.apellidos })
      .from(usuarios)
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(eq(usuarios.id, usuarioId));
    return f ? `${f.nombres} ${f.apellidos.split(' ')[0]}` : null;
  }

  async aprobar(usuario: UsuarioAutenticado, id: string, ip?: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const fila = await this.cargar(id, tx as unknown as Database, true);
      if (!fila || !puedeVerSolicitud(usuario, fila.t)) throw new NotFoundException('Solicitud no encontrada');
      if (!puedeResolver(usuario, fila.t)) throw new ForbiddenException('No puedes resolver esta solicitud.');
      if (fila.s.estado !== 'PENDIENTE') throw new ConflictException('La solicitud ya fue resuelta.');
      // Se revalida: entre el envío y la aprobación el saldo o los feriados pudieron cambiar.
      const { validacion } = await this.preparar(usuario, { tipoCodigo: fila.tipo.codigo, desde: fila.s.desde, hasta: fila.s.hasta, trabajadorId: fila.t.id }, fila.s.id, tx as unknown as Database);
      // Una solicitud pendiente cuyas fechas ya llegaron se puede aprobar igual: la jefatura se atrasó, no el trabajador.
      const problemas = validacion.problemas.filter((p) => !p.includes('ya pasaron'));
      if (problemas.length) throw new BadRequestException({ mensaje: problemas.join(' '), problemas });
      await tx.update(solicitudesAusencia).set({ estado: 'APROBADA', diasHabiles: validacion.diasHabiles, resueltaPor: usuario.id, resueltaEn: new Date(), actualizadoEn: new Date() }).where(eq(solicitudesAusencia.id, id));
      if (fila.tipo.afectaSaldo) {
        await tx.insert(movimientosVacaciones).values({
          trabajadorId: fila.t.id,
          fecha: fila.s.desde,
          tipo: 'TOMADO',
          dias: -validacion.diasHabiles,
          solicitudId: id,
          motivo: `Vacaciones ${rango(fila.s.desde, fila.s.hasta)}`,
          creadoPor: usuario.id,
        });
      }
      return { ...fila, dias: validacion.diasHabiles };
    });
    await this.auditoria.registrar({ usuario, accion: 'APROBAR_AUSENCIA', entidad: 'solicitud_ausencia', entidadId: id, ip, detalle: { diasHabiles: resultado.dias } });
    await this.avisos.crear({
      empresaId: resultado.t.empresaId,
      destinatarios: [resultado.t.id],
      tipo: 'SOLICITUD_APROBADA',
      titulo: `Aprobaron tu solicitud de ${resultado.tipo.nombre.toLowerCase()}`,
      mensaje: rango(resultado.s.desde, resultado.s.hasta),
      enlace: `/ausencias/${id}`,
    });
    return { ok: true };
  }

  async rechazar(usuario: UsuarioAutenticado, id: string, motivo: string, ip?: string) {
    const fila = await this.db.transaction(async (tx) => {
      const f = await this.cargar(id, tx as unknown as Database, true);
      if (!f || !puedeVerSolicitud(usuario, f.t)) throw new NotFoundException('Solicitud no encontrada');
      if (!puedeResolver(usuario, f.t)) throw new ForbiddenException('No puedes resolver esta solicitud.');
      if (f.s.estado !== 'PENDIENTE') throw new ConflictException('La solicitud ya fue resuelta.');
      await tx.update(solicitudesAusencia).set({ estado: 'RECHAZADA', motivoRechazo: motivo.trim(), resueltaPor: usuario.id, resueltaEn: new Date(), actualizadoEn: new Date() }).where(eq(solicitudesAusencia.id, id));
      return f;
    });
    await this.auditoria.registrar({ usuario, accion: 'RECHAZAR_AUSENCIA', entidad: 'solicitud_ausencia', entidadId: id, ip });
    await this.avisos.crear({ empresaId: fila.t.empresaId, destinatarios: [fila.t.id], tipo: 'SOLICITUD_RECHAZADA', titulo: `Rechazaron tu solicitud de ${fila.tipo.nombre.toLowerCase()}`, mensaje: `Motivo: ${motivo.trim()}`, enlace: `/ausencias/${id}` });
    return { ok: true };
  }

  async cancelar(usuario: UsuarioAutenticado, id: string, ip?: string) {
    const fila = await this.db.transaction(async (tx) => {
      const f = await this.cargar(id, tx as unknown as Database, true);
      if (!f || !puedeVerSolicitud(usuario, f.t)) throw new NotFoundException('Solicitud no encontrada');
      if (!this.puedeCancelar(usuario, f.s, f.t.id, hoyEn(f.t.zonaHoraria))) throw new ConflictException('Esta solicitud ya no se puede cancelar. Habla con Personas.');
      await tx.update(solicitudesAusencia).set({ estado: 'CANCELADA', actualizadoEn: new Date() }).where(eq(solicitudesAusencia.id, id));
      // Si ya se había descontado, se devuelve con un movimiento nuevo: el libro nunca se edita.
      if (f.s.estado === 'APROBADA' && f.tipo.afectaSaldo) {
        await tx.insert(movimientosVacaciones).values({ trabajadorId: f.t.id, fecha: hoyEn(f.t.zonaHoraria), tipo: 'REVERSA', dias: f.s.diasHabiles, solicitudId: id, motivo: `Cancelación de vacaciones ${rango(f.s.desde, f.s.hasta)}`, creadoPor: usuario.id });
      }
      return f;
    });
    await this.auditoria.registrar({ usuario, accion: 'CANCELAR_AUSENCIA', entidad: 'solicitud_ausencia', entidadId: id, ip, detalle: { estadoAnterior: fila.s.estado } });
    if (fila.t.jefaturaId && fila.t.jefaturaId !== usuario.trabajadorId) {
      await this.avisos.crear({ empresaId: fila.t.empresaId, destinatarios: [fila.t.jefaturaId], tipo: 'SOLICITUD_CANCELADA', titulo: `${fila.t.nombres} canceló ${fila.tipo.nombre.toLowerCase()}`, mensaje: rango(fila.s.desde, fila.s.hasta), enlace: '/calendario' });
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------- calendario (HU-13)

  async calendario(usuario: UsuarioAutenticado, mes: string, sedeId?: string) {
    const { desde, hasta } = limitesDelMes(mes);
    const alcance = alcanceListado(usuario);
    const condiciones: SQL[] = [
      eq(solicitudesAusencia.empresaId, usuario.empresaId),
      inArray(solicitudesAusencia.estado, ['APROBADA', 'PENDIENTE']),
      lte(solicitudesAusencia.desde, hasta),
      gte(solicitudesAusencia.hasta, desde),
    ];
    if (alcance.tipo === 'equipo') condiciones.push(or(eq(trabajadores.jefaturaId, usuario.trabajadorId), eq(trabajadores.id, usuario.trabajadorId))!);
    else if (alcance.tipo === 'propio') condiciones.push(eq(trabajadores.id, usuario.trabajadorId));
    if (sedeId) condiciones.push(eq(trabajadores.sedeId, sedeId));

    const ausencias = await this.db
      .select({
        id: solicitudesAusencia.id,
        trabajadorId: trabajadores.id,
        nombres: trabajadores.nombres,
        apellidos: trabajadores.apellidos,
        sede: sedes.nombre,
        tipo: tiposAusencia.nombre,
        tipoCodigo: tiposAusencia.codigo,
        desde: solicitudesAusencia.desde,
        hasta: solicitudesAusencia.hasta,
        estado: solicitudesAusencia.estado,
      })
      .from(solicitudesAusencia)
      .innerJoin(trabajadores, eq(trabajadores.id, solicitudesAusencia.trabajadorId))
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(and(...condiciones))
      .orderBy(asc(solicitudesAusencia.desde));

    const listaFeriados = await this.db.select().from(feriados).where(and(gte(feriados.fecha, desde), lte(feriados.fecha, hasta)));
    const listaSedes = await this.db.select({ id: sedes.id, nombre: sedes.nombre, zonaHoraria: sedes.zonaHoraria }).from(sedes).where(eq(sedes.empresaId, usuario.empresaId)).orderBy(asc(sedes.nombre));
    // "Hoy" depende de la sede: a medianoche en Santiago aún es de tarde en Rapa Nui.
    const hoyPorSede = Object.fromEntries(listaSedes.map((s) => [s.id, hoyEn(s.zonaHoraria)]));
    return { mes, desde, hasta, ausencias, feriados: listaFeriados, sedes: alcance.tipo === 'empresa' ? listaSedes : [], hoyPorSede, hoy: hoyEn('America/Santiago') };
  }

  // ---------------------------------------------------------------- gestión de Personas

  async ajustar(usuario: UsuarioAutenticado, trabajadorId: string, dias: number, motivo: string, ip?: string) {
    const t = await this.trabajador(trabajadorId);
    if (!t || t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    await this.db.insert(movimientosVacaciones).values({ trabajadorId, fecha: hoyEn(t.zonaHoraria), tipo: 'AJUSTE', dias, motivo: motivo.trim(), creadoPor: usuario.id });
    await this.auditoria.registrar({ usuario, accion: 'AJUSTAR_SALDO_VACACIONES', entidad: 'trabajador', entidadId: trabajadorId, ip, detalle: { dias, motivo } });
    await this.avisos.crear({ empresaId: t.empresaId, destinatarios: [trabajadorId], tipo: 'AJUSTE_SALDO', titulo: `Personas ajustó tu saldo de vacaciones en ${dias > 0 ? '+' : ''}${formatearDias(dias)}`, mensaje: motivo.trim(), enlace: '/vacaciones' });
    return this.saldo(usuario, trabajadorId);
  }

  async registrarAniosPrevios(usuario: UsuarioAutenticado, trabajadorId: string, anios: number, respaldo: string, ip?: string) {
    const t = await this.trabajador(trabajadorId);
    if (!t || t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    await this.db.update(trabajadores).set({ aniosPreviosReconocidos: anios, respaldoAniosPrevios: respaldo.trim(), actualizadoEn: new Date() }).where(eq(trabajadores.id, trabajadorId));
    await this.auditoria.registrar({ usuario, accion: 'REGISTRAR_ANIOS_PREVIOS', entidad: 'trabajador', entidadId: trabajadorId, ip, detalle: { anios, anterior: t.aniosPrevios } });
    return this.saldo(usuario, trabajadorId);
  }

  /** Vista rápida de saldos del alcance del usuario, para la bandeja de la jefatura y el panel. */
  async saldosDelEquipo(usuario: UsuarioAutenticado) {
    const alcance = alcanceListado(usuario);
    const condiciones: SQL[] = [eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO')];
    if (alcance.tipo === 'equipo') condiciones.push(eq(trabajadores.jefaturaId, usuario.trabajadorId));
    else if (alcance.tipo === 'propio') condiciones.push(eq(trabajadores.id, usuario.trabajadorId));
    const lista = await this.db
      .select({ id: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, sede: sedes.nombre, sedeId: sedes.id, fechaIngreso: trabajadores.fechaIngreso, aniosPrevios: trabajadores.aniosPreviosReconocidos, zonaHoraria: sedes.zonaHoraria })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(and(...condiciones))
      .orderBy(asc(sedes.nombre), asc(trabajadores.apellidos));
    if (lista.length === 0) return [];
    const sumas = await this.db
      .select({ trabajadorId: movimientosVacaciones.trabajadorId, total: sql<string>`sum(${movimientosVacaciones.dias})` })
      .from(movimientosVacaciones)
      .where(inArray(movimientosVacaciones.trabajadorId, lista.map((t) => t.id)))
      .groupBy(movimientosVacaciones.trabajadorId);
    const porId = new Map(sumas.map((s) => [s.trabajadorId, Number(s.total)]));
    return lista.map(({ zonaHoraria, ...t }) => {
      const s = calcularSaldo({ fechaIngreso: t.fechaIngreso, aniosPrevios: t.aniosPrevios, fechaCorte: hoyEn(zonaHoraria), movimientos: porId.get(t.id) ?? 0 });
      return { ...t, saldo: s.saldo, disponible: s.disponible, derechoAnual: s.derechoAnual, excedeAcumulacion: s.excedeAcumulacion };
    });
  }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(f: string): string {
  const [a, m, d] = f.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}
function rango(desde: string, hasta: string): string {
  return desde === hasta ? `el ${fechaCorta(desde)}` : `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}
