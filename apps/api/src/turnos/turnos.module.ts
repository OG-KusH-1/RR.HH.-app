/**
 * Turnos semanales, cambios de turno y archivo de novedades (Fase 2: HU-22 a HU-25).
 *
 * Flujo de la jefatura: copia la semana anterior como plantilla, ajusta celdas (cada guardado
 * revisa la semana completa de esa persona), y publica. Al publicar, cada persona recibe aviso
 * y ve su turno en el celular: se acaba la foto del turno en el grupo de WhatsApp.
 *
 * Cambio de turno: el solicitante propone, el compañero acepta, la jefatura aprueba.
 * Al aprobar se vuelven a revisar ambas semanas: un cambio no puede dejar a nadie con un
 * turno sobre sus vacaciones o en un feriado irrenunciable.
 *
 * Límites conocidos:
 * - Un turno por persona y día (no turnos partidos con dos tramos).
 * - Las horas sobre jornada del archivo de novedades se estiman desde los turnos publicados,
 *   no desde un control de asistencia. El registro de asistencia válido ante la Dirección del
 *   Trabajo requiere un sistema certificado; se integra en la fase de integraciones.
 */
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Ip, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can, Policy } from '@nestjs/authorization';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, desc, eq, gte, inArray, lte, ne, or, type SQL } from 'drizzle-orm';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { AuditoriaService } from '../audit/auditoria.service.js';
import { hoyEn, limitesDelMes, sumarDias } from '../ausencias/calendario-laboral.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosModule } from '../avisos/avisos.module.js';
import { AvisosService } from '../avisos/avisos.service.js';
import type { Database } from '../db/database.js';
import { cambiosTurno, feriados, sedes, solicitudesAusencia, tiposAusencia, trabajadores, turnos } from '../db/schema.js';
import { aCsv, calcularNovedades } from './novedades.js';
import { diasDeLaSemana, domingosLibresDelMes, esHora, horasTurno, lunesDe, MIN_DOMINGOS_LIBRES_MES, revisarSemana, type Problema, type TurnoDia } from './reglas-turnos.js';

interface Persona {
  id: string;
  empresaId: string;
  jefaturaId: string | null;
  sedeId: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  horasSemanales: number;
}

const columnasPersona = {
  id: trabajadores.id,
  empresaId: trabajadores.empresaId,
  jefaturaId: trabajadores.jefaturaId,
  sedeId: trabajadores.sedeId,
  nombres: trabajadores.nombres,
  apellidos: trabajadores.apellidos,
  cargo: trabajadores.cargo,
  horasSemanales: trabajadores.horasSemanales,
};

/** Quién arma turnos de quién: la jefatura directa o Personas. */
export function puedeGestionarTurnos(u: UsuarioAutenticado, p: Pick<Persona, 'empresaId' | 'jefaturaId'>): boolean {
  if (p.empresaId !== u.empresaId) return false;
  return u.rol === 'PERSONAS' || (u.rol === 'JEFATURA' && p.jefaturaId === u.trabajadorId);
}

@Injectable()
export class TurnosService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
  ) {}

  /** Personas cuyo turno arma el usuario. Personas elige sede; la jefatura ve su equipo. */
  private async alcance(u: UsuarioAutenticado, sedeId?: string): Promise<Persona[]> {
    const condiciones: SQL[] = [eq(trabajadores.empresaId, u.empresaId), eq(trabajadores.estado, 'ACTIVO')];
    if (u.rol === 'JEFATURA') condiciones.push(eq(trabajadores.jefaturaId, u.trabajadorId));
    else if (u.rol === 'PERSONAS') {
      if (sedeId) condiciones.push(eq(trabajadores.sedeId, sedeId));
    } else throw new ForbiddenException('No armas turnos.');
    return this.db.select(columnasPersona).from(trabajadores).where(and(...condiciones)).orderBy(asc(trabajadores.apellidos));
  }

  private async persona(id: string): Promise<Persona | undefined> {
    const [p] = await this.db.select(columnasPersona).from(trabajadores).where(eq(trabajadores.id, id));
    return p;
  }

  /** Contexto legal de una semana para varias personas: ausencias aprobadas y feriados irrenunciables. */
  private async contexto(ids: string[], desde: string, hasta: string) {
    const ausencias = ids.length
      ? await this.db
          .select({ trabajadorId: solicitudesAusencia.trabajadorId, desde: solicitudesAusencia.desde, hasta: solicitudesAusencia.hasta, tipo: tiposAusencia.nombre })
          .from(solicitudesAusencia)
          .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
          .where(and(inArray(solicitudesAusencia.trabajadorId, ids), eq(solicitudesAusencia.estado, 'APROBADA'), lte(solicitudesAusencia.desde, hasta), gte(solicitudesAusencia.hasta, desde)))
      : [];
    const listaFeriados = await this.db.select().from(feriados).where(and(gte(feriados.fecha, desde), lte(feriados.fecha, hasta)));
    const ausentePorPersona = new Map<string, Map<string, string>>();
    for (const a of ausencias) {
      const mapa = ausentePorPersona.get(a.trabajadorId) ?? new Map<string, string>();
      for (let f = a.desde > desde ? a.desde : desde; f <= (a.hasta < hasta ? a.hasta : hasta); f = sumarDias(f, 1)) mapa.set(f, a.tipo);
      ausentePorPersona.set(a.trabajadorId, mapa);
    }
    return { ausentePorPersona, feriados: listaFeriados, irrenunciables: new Map(listaFeriados.filter((f) => f.irrenunciable).map((f) => [f.fecha, f.nombre])) };
  }

  private async turnosEntre(ids: string[], desde: string, hasta: string) {
    if (!ids.length) return [];
    return this.db
      .select()
      .from(turnos)
      .where(and(inArray(turnos.trabajadorId, ids), gte(turnos.fecha, desde), lte(turnos.fecha, hasta)))
      .orderBy(asc(turnos.fecha));
  }

  /** Revisa la semana de una persona, opcionalmente reemplazando o quitando un día. */
  private async revisar(p: Persona, lunes: string, cambio?: { fecha: string; turno: TurnoDia | null }, excluirTurnoId?: string): Promise<{ horas: number; problemas: Problema[] }> {
    const dias = diasDeLaSemana(lunes);
    const existentes = (await this.turnosEntre([p.id], dias[0], dias[6])).filter((t) => t.id !== excluirTurnoId);
    let semana: TurnoDia[] = existentes.map((t) => ({ fecha: t.fecha, inicio: t.inicio, fin: t.fin, colacionMin: t.colacionMin }));
    if (cambio) {
      semana = semana.filter((t) => t.fecha !== cambio.fecha);
      if (cambio.turno) semana.push(cambio.turno);
    }
    const ctx = await this.contexto([p.id], dias[0], dias[6]);
    return revisarSemana(semana, { horasPactadas: p.horasSemanales, diasAusente: new Set(ctx.ausentePorPersona.get(p.id)?.keys() ?? []), irrenunciables: ctx.irrenunciables });
  }

  async semana(u: UsuarioAutenticado, fecha: string, sedeId?: string) {
    const lunes = lunesDe(fecha);
    const dias = diasDeLaSemana(lunes);
    const personas = await this.alcance(u, sedeId);
    const ids = personas.map((p) => p.id);
    const lista = await this.turnosEntre(ids, dias[0], dias[6]);
    const ctx = await this.contexto(ids, dias[0], dias[6]);
    // Domingos del mes del lunes, para la regla del comercio.
    const mes = lunes.slice(0, 7);
    const { desde, hasta } = limitesDelMes(mes);
    const turnosMes = await this.turnosEntre(ids, desde, hasta);

    const filas = personas.map((p) => {
      const propios = lista.filter((t) => t.trabajadorId === p.id);
      const ausente = ctx.ausentePorPersona.get(p.id) ?? new Map<string, string>();
      const r = revisarSemana(
        propios.map((t) => ({ fecha: t.fecha, inicio: t.inicio, fin: t.fin, colacionMin: t.colacionMin })),
        { horasPactadas: p.horasSemanales, diasAusente: new Set(ausente.keys()), irrenunciables: ctx.irrenunciables },
      );
      const domingos = domingosLibresDelMes(mes, new Set(turnosMes.filter((t) => t.trabajadorId === p.id).map((t) => t.fecha)));
      const problemas = [...r.problemas];
      if (domingos.libres < MIN_DOMINGOS_LIBRES_MES) problemas.push({ nivel: 'alerta', mensaje: `Solo ${domingos.libres} domingo(s) libre(s) en el mes: en el comercio deben ser al menos 2 (art. 38 N°7 CT).` });
      return {
        persona: { id: p.id, nombres: p.nombres, apellidos: p.apellidos, cargo: p.cargo, horasPactadas: p.horasSemanales },
        dias: dias.map((f) => {
          const t = propios.find((x) => x.fecha === f);
          return { fecha: f, turno: t ? { id: t.id, inicio: t.inicio, fin: t.fin, colacionMin: t.colacionMin, publicado: t.publicado, horas: horasTurno(t) } : null, ausencia: ausente.get(f) ?? null };
        }),
        horas: r.horas,
        problemas,
      };
    });
    const listaSedes = u.rol === 'PERSONAS' ? await this.db.select({ id: sedes.id, nombre: sedes.nombre }).from(sedes).where(eq(sedes.empresaId, u.empresaId)).orderBy(asc(sedes.nombre)) : [];
    return { lunes, dias, feriados: ctx.feriados, filas, sinPublicar: lista.filter((t) => !t.publicado).length, sedes: listaSedes };
  }

  async guardar(u: UsuarioAutenticado, d: { trabajadorId: string; fecha: string; inicio: string; fin: string; colacionMin: number }) {
    const p = await this.persona(d.trabajadorId);
    if (!p || !puedeGestionarTurnos(u, p)) throw new NotFoundException('Ficha no encontrada');
    if (!esHora(d.inicio) || !esHora(d.fin)) throw new BadRequestException('Usa el formato HH:MM.');
    const r = await this.revisar(p, lunesDe(d.fecha), { fecha: d.fecha, turno: d });
    const errores = r.problemas.filter((x) => x.nivel === 'error');
    if (errores.length) throw new BadRequestException({ mensaje: errores.map((e) => e.mensaje).join(' '), problemas: errores });
    // Al editar un turno ya publicado vuelve a borrador: la persona se entera al publicar de nuevo.
    await this.db
      .insert(turnos)
      .values({ empresaId: p.empresaId, trabajadorId: p.id, fecha: d.fecha, inicio: d.inicio, fin: d.fin, colacionMin: d.colacionMin, creadoPor: u.id })
      .onConflictDoUpdate({ target: [turnos.trabajadorId, turnos.fecha], set: { inicio: d.inicio, fin: d.fin, colacionMin: d.colacionMin, publicado: false, actualizadoEn: new Date() } });
    return { ok: true, alertas: r.problemas };
  }

  async eliminar(u: UsuarioAutenticado, id: string) {
    const [t] = await this.db.select().from(turnos).where(eq(turnos.id, id));
    const p = t && (await this.persona(t.trabajadorId));
    if (!t || !p || !puedeGestionarTurnos(u, p)) throw new NotFoundException('Turno no encontrado');
    await this.db.delete(turnos).where(eq(turnos.id, id));
    if (t.publicado) {
      await this.avisos.crear({ empresaId: p.empresaId, destinatarios: [p.id], tipo: 'TURNO_ELIMINADO', titulo: 'Se quitó un turno de tu semana', mensaje: `Ya no trabajas el ${t.fecha} de ${t.inicio} a ${t.fin}.`, enlace: '/turnos' });
    }
  }

  /** Copia la semana anterior como plantilla, sin pisar turnos existentes ni días con ausencia o feriado irrenunciable. */
  async copiarSemanaAnterior(u: UsuarioAutenticado, fecha: string, sedeId?: string) {
    const lunes = lunesDe(fecha);
    const personas = await this.alcance(u, sedeId);
    const ids = personas.map((p) => p.id);
    const anterior = await this.turnosEntre(ids, sumarDias(lunes, -7), sumarDias(lunes, -1));
    const actuales = await this.turnosEntre(ids, lunes, sumarDias(lunes, 6));
    const ctx = await this.contexto(ids, lunes, sumarDias(lunes, 6));
    let copiados = 0;
    let omitidos = 0;
    for (const t of anterior) {
      const fechaNueva = sumarDias(t.fecha, 7);
      const ocupado = actuales.some((a) => a.trabajadorId === t.trabajadorId && a.fecha === fechaNueva);
      const bloqueado = ctx.ausentePorPersona.get(t.trabajadorId)?.has(fechaNueva) || ctx.irrenunciables.has(fechaNueva);
      if (ocupado || bloqueado) {
        omitidos++;
        continue;
      }
      await this.db.insert(turnos).values({ empresaId: t.empresaId, trabajadorId: t.trabajadorId, fecha: fechaNueva, inicio: t.inicio, fin: t.fin, colacionMin: t.colacionMin, creadoPor: u.id });
      copiados++;
    }
    return { copiados, omitidos };
  }

  async publicar(u: UsuarioAutenticado, fecha: string, sedeId?: string, ip?: string) {
    const lunes = lunesDe(fecha);
    const personas = await this.alcance(u, sedeId);
    const ids = personas.map((p) => p.id);
    if (!ids.length) return { publicados: 0 };
    const pendientes = await this.db
      .update(turnos)
      .set({ publicado: true, actualizadoEn: new Date() })
      .where(and(inArray(turnos.trabajadorId, ids), gte(turnos.fecha, lunes), lte(turnos.fecha, sumarDias(lunes, 6)), eq(turnos.publicado, false)))
      .returning({ trabajadorId: turnos.trabajadorId });
    const afectados = [...new Set(pendientes.map((p) => p.trabajadorId))];
    await this.avisos.crear({ empresaId: u.empresaId, destinatarios: afectados, tipo: 'TURNO_PUBLICADO', titulo: 'Tu turno de la semana está publicado', mensaje: `Semana del ${lunes}.`, enlace: '/turnos' });
    await this.auditoria.registrar({ usuario: u, accion: 'PUBLICAR_TURNOS', entidad: 'turnos', ip, detalle: { lunes, turnos: pendientes.length } });
    return { publicados: pendientes.length, personas: afectados.length };
  }

  /** Mis turnos publicados de esta semana y la siguiente, y los de mi equipo (para proponer cambios). */
  async mios(u: UsuarioAutenticado) {
    const [yo] = await this.db.select({ jefaturaId: trabajadores.jefaturaId, zona: sedes.zonaHoraria }).from(trabajadores).innerJoin(sedes, eq(sedes.id, trabajadores.sedeId)).where(eq(trabajadores.id, u.trabajadorId));
    const lunes = lunesDe(hoyEn(yo?.zona ?? 'America/Santiago'));
    const hasta = sumarDias(lunes, 13);
    const propios = await this.db.select().from(turnos).where(and(eq(turnos.trabajadorId, u.trabajadorId), eq(turnos.publicado, true), gte(turnos.fecha, lunes), lte(turnos.fecha, hasta))).orderBy(asc(turnos.fecha));
    const equipo = yo?.jefaturaId
      ? await this.db
          .select({ id: turnos.id, trabajadorId: turnos.trabajadorId, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, fecha: turnos.fecha, inicio: turnos.inicio, fin: turnos.fin })
          .from(turnos)
          .innerJoin(trabajadores, eq(trabajadores.id, turnos.trabajadorId))
          .where(and(eq(trabajadores.jefaturaId, yo.jefaturaId), ne(turnos.trabajadorId, u.trabajadorId), eq(turnos.publicado, true), gte(turnos.fecha, lunes), lte(turnos.fecha, hasta)))
          .orderBy(asc(turnos.fecha))
      : [];
    const companeros = yo?.jefaturaId
      ? await this.db.select({ id: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos }).from(trabajadores).where(and(eq(trabajadores.jefaturaId, yo.jefaturaId), ne(trabajadores.id, u.trabajadorId), eq(trabajadores.estado, 'ACTIVO'))).orderBy(asc(trabajadores.nombres))
      : [];
    return { desde: lunes, hasta, turnos: propios.map((t) => ({ ...t, horas: horasTurno(t) })), equipo, companeros };
  }

  // ------------------------------------------------------------ cambios de turno (HU-25)

  async solicitarCambio(u: UsuarioAutenticado, d: { turnoId: string; companeroId: string; turnoCompaneroId?: string; motivo?: string }) {
    const [mio] = await this.db.select().from(turnos).where(eq(turnos.id, d.turnoId));
    if (!mio || mio.trabajadorId !== u.trabajadorId || !mio.publicado) throw new NotFoundException('Turno no encontrado');
    const yo = await this.persona(u.trabajadorId);
    const companero = await this.persona(d.companeroId);
    if (!companero || !yo || companero.jefaturaId !== yo.jefaturaId || companero.id === yo.id) throw new BadRequestException('El cambio es con alguien de tu mismo equipo.');
    if (d.turnoCompaneroId) {
      const [suyo] = await this.db.select().from(turnos).where(eq(turnos.id, d.turnoCompaneroId));
      if (!suyo || suyo.trabajadorId !== companero.id) throw new BadRequestException('Ese turno no es de tu compañero.');
    }
    const [c] = await this.db.insert(cambiosTurno).values({ empresaId: u.empresaId, turnoSolicitanteId: mio.id, turnoCompaneroId: d.turnoCompaneroId ?? null, solicitanteId: u.trabajadorId, companeroId: companero.id, motivo: d.motivo?.trim() || null }).returning();
    await this.avisos.crear({ empresaId: u.empresaId, destinatarios: [companero.id], tipo: 'CAMBIO_TURNO', titulo: `${u.nombres} te propone un cambio de turno`, mensaje: `Su turno del ${mio.fecha} (${mio.inicio} a ${mio.fin}).`, enlace: '/turnos' });
    return c;
  }

  async listarCambios(u: UsuarioAutenticado) {
    const condiciones: SQL[] = [eq(cambiosTurno.solicitanteId, u.trabajadorId), eq(cambiosTurno.companeroId, u.trabajadorId)];
    let equipo: string[] = [];
    if (u.rol === 'JEFATURA' || u.rol === 'PERSONAS') {
      equipo = (await this.alcance(u)).map((p) => p.id);
      if (equipo.length) condiciones.push(and(inArray(cambiosTurno.solicitanteId, equipo), eq(cambiosTurno.estado, 'ESPERA_JEFATURA'))!);
    }
    const filas = await this.db.select().from(cambiosTurno).where(and(eq(cambiosTurno.empresaId, u.empresaId), or(...condiciones))).orderBy(desc(cambiosTurno.creadoEn)).limit(50);
    const idsTurnos = filas.flatMap((f) => [f.turnoSolicitanteId, f.turnoCompaneroId].filter((x): x is string => Boolean(x)));
    const idsPersonas = [...new Set(filas.flatMap((f) => [f.solicitanteId, f.companeroId]))];
    const mapaT = new Map((idsTurnos.length ? await this.db.select().from(turnos).where(inArray(turnos.id, idsTurnos)) : []).map((t) => [t.id, t]));
    const mapaP = new Map((idsPersonas.length ? await this.db.select({ id: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos }).from(trabajadores).where(inArray(trabajadores.id, idsPersonas)) : []).map((p) => [p.id, `${p.nombres} ${p.apellidos.split(' ')[0]}`]));
    return filas.map((f) => ({
      ...f,
      solicitante: mapaP.get(f.solicitanteId),
      companero: mapaP.get(f.companeroId),
      turnoSolicitante: mapaT.get(f.turnoSolicitanteId),
      turnoCompanero: f.turnoCompaneroId ? mapaT.get(f.turnoCompaneroId) : null,
      puedoResponder: f.estado === 'ESPERA_COMPANERO' && f.companeroId === u.trabajadorId,
      puedoAprobar: f.estado === 'ESPERA_JEFATURA' && equipo.includes(f.solicitanteId) && f.solicitanteId !== u.trabajadorId && f.companeroId !== u.trabajadorId,
    }));
  }

  async responderCambio(u: UsuarioAutenticado, id: string, acepta: boolean) {
    const [c] = await this.db.select().from(cambiosTurno).where(eq(cambiosTurno.id, id));
    if (!c || c.companeroId !== u.trabajadorId) throw new NotFoundException('Cambio no encontrado');
    if (c.estado !== 'ESPERA_COMPANERO') throw new ConflictException('El cambio ya fue respondido.');
    await this.db.update(cambiosTurno).set({ estado: acepta ? 'ESPERA_JEFATURA' : 'RECHAZADO', resueltoEn: acepta ? null : new Date() }).where(eq(cambiosTurno.id, id));
    const solicitante = await this.persona(c.solicitanteId);
    await this.avisos.crear({ empresaId: c.empresaId, destinatarios: [c.solicitanteId], tipo: 'CAMBIO_TURNO', titulo: `${u.nombres} ${acepta ? 'aceptó' : 'rechazó'} tu cambio de turno`, mensaje: acepta ? 'Falta la aprobación de tu jefatura.' : 'El turno queda como estaba.', enlace: '/turnos' });
    if (acepta && solicitante?.jefaturaId) await this.avisos.crear({ empresaId: c.empresaId, destinatarios: [solicitante.jefaturaId], tipo: 'CAMBIO_TURNO', titulo: `Cambio de turno por aprobar: ${solicitante.nombres} y ${u.nombres}`, mensaje: 'Ambos están de acuerdo.', enlace: '/turnos/armar' });
  }

  async resolverCambio(u: UsuarioAutenticado, id: string, aprueba: boolean, ip?: string) {
    const [c] = await this.db.select().from(cambiosTurno).where(eq(cambiosTurno.id, id));
    const solicitante = c && (await this.persona(c.solicitanteId));
    const companero = c && (await this.persona(c.companeroId));
    if (!c || !solicitante || !companero || !puedeGestionarTurnos(u, solicitante)) throw new NotFoundException('Cambio no encontrado');
    if (c.estado !== 'ESPERA_JEFATURA') throw new ConflictException('El cambio no está esperando aprobación.');
    if (!aprueba) {
      await this.db.update(cambiosTurno).set({ estado: 'RECHAZADO', resueltoPor: u.id, resueltoEn: new Date() }).where(eq(cambiosTurno.id, id));
    } else {
      const [tA] = await this.db.select().from(turnos).where(eq(turnos.id, c.turnoSolicitanteId));
      const [tB] = c.turnoCompaneroId ? await this.db.select().from(turnos).where(eq(turnos.id, c.turnoCompaneroId)) : [undefined];
      if (!tA) throw new ConflictException('El turno ya no existe.');
      // Se valida la semana de cada uno como quedaría después del cambio.
      const datosA = { fecha: tA.fecha, inicio: tA.inicio, fin: tA.fin, colacionMin: tA.colacionMin };
      const datosB = tB ? { fecha: tB.fecha, inicio: tB.inicio, fin: tB.fin, colacionMin: tB.colacionMin } : null;
      const revCompanero = await this.revisar(companero, lunesDe(tA.fecha), { fecha: tA.fecha, turno: datosA }, tB?.id);
      const revSolicitante = datosB ? await this.revisar(solicitante, lunesDe(datosB.fecha), { fecha: datosB.fecha, turno: datosB }, tA.id) : { problemas: [] };
      const errores = [...revCompanero.problemas, ...revSolicitante.problemas].filter((p) => p.nivel === 'error');
      if (errores.length) throw new BadRequestException({ mensaje: errores.map((e) => e.mensaje).join(' '), problemas: errores });
      await this.db.transaction(async (tx) => {
        await tx.delete(turnos).where(inArray(turnos.id, [tA.id, ...(tB ? [tB.id] : [])]));
        // El compañero no puede tener ya otro turno ese día: el índice único lo impide y aquí se explica.
        const [choque] = await tx.select({ id: turnos.id }).from(turnos).where(and(eq(turnos.trabajadorId, companero.id), eq(turnos.fecha, tA.fecha)));
        if (choque) throw new ConflictException(`${companero.nombres} ya tiene otro turno el ${tA.fecha}.`);
        await tx.insert(turnos).values({ ...datosA, empresaId: c.empresaId, trabajadorId: companero.id, publicado: true, creadoPor: u.id });
        if (datosB) await tx.insert(turnos).values({ ...datosB, empresaId: c.empresaId, trabajadorId: solicitante.id, publicado: true, creadoPor: u.id });
        await tx.update(cambiosTurno).set({ estado: 'APROBADO', resueltoPor: u.id, resueltoEn: new Date() }).where(eq(cambiosTurno.id, id));
      });
    }
    await this.auditoria.registrar({ usuario: u, accion: aprueba ? 'APROBAR_CAMBIO_TURNO' : 'RECHAZAR_CAMBIO_TURNO', entidad: 'cambio_turno', entidadId: id, ip });
    await this.avisos.crear({ empresaId: c.empresaId, destinatarios: [c.solicitanteId, c.companeroId], tipo: 'CAMBIO_TURNO', titulo: `Tu jefatura ${aprueba ? 'aprobó' : 'rechazó'} el cambio de turno`, mensaje: aprueba ? 'Revisa tu turno actualizado.' : 'Los turnos quedan como estaban.', enlace: '/turnos' });
  }

  async cancelarCambio(u: UsuarioAutenticado, id: string) {
    const [c] = await this.db.select().from(cambiosTurno).where(eq(cambiosTurno.id, id));
    if (!c || c.solicitanteId !== u.trabajadorId) throw new NotFoundException('Cambio no encontrado');
    if (c.estado !== 'ESPERA_COMPANERO' && c.estado !== 'ESPERA_JEFATURA') throw new ConflictException('El cambio ya fue resuelto.');
    await this.db.update(cambiosTurno).set({ estado: 'CANCELADO', resueltoEn: new Date() }).where(eq(cambiosTurno.id, id));
  }

  // ------------------------------------------------------------ novedades (HU-22)

  async novedades(u: UsuarioAutenticado, mes: string) {
    const { desde, hasta } = limitesDelMes(mes);
    const personas = await this.db
      .select({ id: trabajadores.id, rut: trabajadores.rut, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, sede: sedes.nombre, fechaIngreso: trabajadores.fechaIngreso, fechaDesvinculacion: trabajadores.fechaDesvinculacion, estado: trabajadores.estado, horas: trabajadores.horasSemanales })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(eq(trabajadores.empresaId, u.empresaId))
      .orderBy(asc(sedes.nombre), asc(trabajadores.apellidos));
    // Se incluyen quienes salieron en el mes: el contador los necesita para el finiquito.
    const vigentes = personas.filter((p) => p.estado === 'ACTIVO' || (p.fechaDesvinculacion && p.fechaDesvinculacion >= desde));
    const ausencias = await this.db
      .select({ trabajadorId: solicitudesAusencia.trabajadorId, codigo: tiposAusencia.codigo, desde: solicitudesAusencia.desde, hasta: solicitudesAusencia.hasta })
      .from(solicitudesAusencia)
      .innerJoin(tiposAusencia, eq(tiposAusencia.id, solicitudesAusencia.tipoId))
      .where(and(eq(solicitudesAusencia.empresaId, u.empresaId), eq(solicitudesAusencia.estado, 'APROBADA'), lte(solicitudesAusencia.desde, hasta), gte(solicitudesAusencia.hasta, desde)));
    const setFeriados = new Set((await this.db.select({ f: feriados.fecha }).from(feriados).where(and(gte(feriados.fecha, desde), lte(feriados.fecha, hasta)))).map((x) => x.f));
    // Horas sobre jornada: semanas cuyo lunes cae en el mes, según turnos publicados.
    const turnosMes = await this.db.select().from(turnos).where(and(eq(turnos.empresaId, u.empresaId), eq(turnos.publicado, true), gte(turnos.fecha, lunesDe(desde)), lte(turnos.fecha, sumarDias(hasta, 6))));
    const rutPorId = new Map(personas.map((p) => [p.id, p]));
    const extra = new Map<string, number>();
    const porSemana = new Map<string, number>();
    for (const t of turnosMes) {
      const lunes = lunesDe(t.fecha);
      if (lunes < desde || lunes > hasta) continue;
      porSemana.set(`${t.trabajadorId}|${lunes}`, (porSemana.get(`${t.trabajadorId}|${lunes}`) ?? 0) + horasTurno(t));
    }
    for (const [clave, horas] of porSemana) {
      const p = rutPorId.get(clave.split('|')[0]);
      if (p && horas > p.horas) extra.set(p.rut, Math.round(((extra.get(p.rut) ?? 0) + horas - p.horas) * 100) / 100);
    }
    const filas = calcularNovedades(
      mes,
      vigentes.map((p) => ({ rut: p.rut, nombre: `${p.nombres} ${p.apellidos}`, sede: p.sede, fechaIngreso: p.fechaIngreso, fechaDesvinculacion: p.fechaDesvinculacion })),
      ausencias.map((a) => ({ rut: rutPorId.get(a.trabajadorId)!.rut, codigo: a.codigo, desde: a.desde, hasta: a.hasta })),
      setFeriados,
      extra,
    );
    await this.auditoria.registrar({ usuario: u, accion: 'GENERAR_NOVEDADES', entidad: 'novedades', detalle: { mes, filas: filas.length } });
    return { mes, filas };
  }
}

@Policy()
export class TurnosPolicy {
  usar(u: UsuarioAutenticado | null) {
    return u !== null;
  }

  armar(u: UsuarioAutenticado | null) {
    return u !== null && (u.rol === 'JEFATURA' || u.rol === 'PERSONAS');
  }

  verNovedades(u: UsuarioAutenticado | null) {
    return u !== null && (u.rol === 'PERSONAS' || u.rol === 'GERENCIA');
  }
}

const fecha = z.iso.date();
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa HH:MM');
const turnoSchema = z.object({ trabajadorId: z.uuid(), fecha, inicio: hora, fin: hora, colacionMin: z.number().int().min(0).max(120).default(30) });
const semanaSchema = z.object({ fecha, sedeId: z.uuid().optional() });
const cambioSchema = z.object({ turnoId: z.uuid(), companeroId: z.uuid(), turnoCompaneroId: z.uuid().optional(), motivo: z.string().max(300).optional() });
const decisionSchema = z.object({ acepta: z.boolean() });
const mesSchema = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), formato: z.enum(['json', 'csv']).default('json') });

@Controller()
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

  @Get('turnos/semana')
  @Can(TurnosPolicy, 'armar')
  semana(@CurrentUser() u: UsuarioAutenticado, @Query({ schema: semanaSchema }) q: z.infer<typeof semanaSchema>) {
    return this.turnos.semana(u, q.fecha, q.sedeId);
  }

  @Put('turnos')
  @Can(TurnosPolicy, 'armar')
  guardar(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: turnoSchema }) body: z.infer<typeof turnoSchema>) {
    return this.turnos.guardar(u, body);
  }

  @Delete('turnos/:id')
  @Can(TurnosPolicy, 'armar')
  @HttpCode(204)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.turnos.eliminar(u, id);
  }

  @Post('turnos/copiar-semana-anterior')
  @Can(TurnosPolicy, 'armar')
  @HttpCode(200)
  copiar(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: semanaSchema }) body: z.infer<typeof semanaSchema>) {
    return this.turnos.copiarSemanaAnterior(u, body.fecha, body.sedeId);
  }

  @Post('turnos/publicar')
  @Can(TurnosPolicy, 'armar')
  @HttpCode(200)
  publicar(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: semanaSchema }) body: z.infer<typeof semanaSchema>, @Ip() ip: string) {
    return this.turnos.publicar(u, body.fecha, body.sedeId, ip);
  }

  @Get('turnos/mios')
  @Can(TurnosPolicy, 'usar')
  mios(@CurrentUser() u: UsuarioAutenticado) {
    return this.turnos.mios(u);
  }

  @Get('turnos/cambios')
  @Can(TurnosPolicy, 'usar')
  cambios(@CurrentUser() u: UsuarioAutenticado) {
    return this.turnos.listarCambios(u);
  }

  @Post('turnos/cambios')
  @Can(TurnosPolicy, 'usar')
  solicitar(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: cambioSchema }) body: z.infer<typeof cambioSchema>) {
    return this.turnos.solicitarCambio(u, body);
  }

  @Post('turnos/cambios/:id/responder')
  @Can(TurnosPolicy, 'usar')
  @HttpCode(204)
  responder(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: decisionSchema }) body: z.infer<typeof decisionSchema>) {
    return this.turnos.responderCambio(u, id, body.acepta);
  }

  @Post('turnos/cambios/:id/resolver')
  @Can(TurnosPolicy, 'armar')
  @HttpCode(204)
  resolver(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: decisionSchema }) body: z.infer<typeof decisionSchema>, @Ip() ip: string) {
    return this.turnos.resolverCambio(u, id, body.acepta, ip);
  }

  @Post('turnos/cambios/:id/cancelar')
  @Can(TurnosPolicy, 'usar')
  @HttpCode(204)
  cancelar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.turnos.cancelarCambio(u, id);
  }

  @Get('novedades')
  @Can(TurnosPolicy, 'verNovedades')
  async novedades(@CurrentUser() u: UsuarioAutenticado, @Query({ schema: mesSchema }) q: z.infer<typeof mesSchema>, @Res({ passthrough: true }) res: Response) {
    const r = await this.turnos.novedades(u, q.mes);
    if (q.formato === 'csv') {
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="novedades-${q.mes}.csv"` });
      return aCsv(r.filas);
    }
    return r;
  }
}

@Module({
  imports: [AuditoriaModule, AvisosModule],
  controllers: [TurnosController],
  providers: [TurnosPolicy, TurnosService],
})
export class TurnosModule {}
