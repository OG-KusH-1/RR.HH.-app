/**
 * Carpeta digital del trabajador (épica E4: HU-14 a HU-17).
 *
 * Seguridad, en el orden en que se aplica al subir:
 *   1. Solo Personas sube y elimina (política del controlador).
 *   2. Se valida tamaño y tipo real por los bytes (reglas-documentos.ts).
 *   3. Se calcula la huella SHA-256 del original y se cifra con AES-256-GCM.
 *   4. Se guarda con una clave interna aleatoria: el nombre del archivo nunca forma la ruta.
 * Al descargar: enlace firmado de 5 minutos atado al usuario + nueva revisión de permisos
 * + registro en auditoría.
 *
 * Avisos de vencimiento: proceso diario a las 07:30 de Chile continental. Se deduplican
 * con `claveUnica`, así correrlo dos veces el mismo día no repite avisos.
 *
 * Límites conocidos:
 * - El archivo viaja en base64 dentro del JSON (simple y suficiente hasta 10 MB). Para
 *   archivos grandes conviene subida directa al bucket con URL prefirmada (integraciones).
 * - Eliminar es lógico: el archivo cifrado se conserva por los plazos legales de retención.
 */
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Cron } from '@nestjs/schedule';
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, type SQL } from 'drizzle-orm';
import { AuditoriaService } from '../audit/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosService } from '../avisos/avisos.service.js';
import { hoyEn, sumarDias, diasCorridos } from '../ausencias/calendario-laboral.js';
import { cifrar, claveDesdeBase64, descifrar } from '../common/cifrado.js';
import type { Env } from '../config/env.js';
import type { Database } from '../db/database.js';
import { documentos, documentosRequeridos, empresas, sedes, tiposDocumento, trabajadores } from '../db/schema.js';
import { ALMACEN, type AlmacenArchivos } from './almacen.js';
import { detectarTipo, faltantes, firmarEnlace, limpiarNombre, MINUTOS_ENLACE, puedeVerDocumento, TAMANO_MAXIMO, umbralAviso, verificarEnlace, visibilidadesPermitidas, type Visibilidad } from './reglas-documentos.js';

export interface DatosSubida {
  trabajadorId: string;
  tipoId: string;
  nombreArchivo: string;
  contenidoBase64: string;
  venceEl?: string | null;
  visibilidad?: Visibilidad;
  notas?: string;
}

const ZONA_CHILE = 'America/Santiago';

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);
  private readonly clave: Buffer;
  private readonly secretoEnlaces: string;

  constructor(
    @InjectDrizzle() private readonly db: Database,
    @Inject(ALMACEN) private readonly almacen: AlmacenArchivos,
    private readonly auditoria: AuditoriaService,
    private readonly avisos: AvisosService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.clave = claveDesdeBase64(config.get('CLAVE_CIFRADO', { infer: true }));
    this.secretoEnlaces = config.get('SECRETO_ENLACES', { infer: true });
  }

  tipos() {
    return this.db.select().from(tiposDocumento).orderBy(asc(tiposDocumento.nombre));
  }

  private async trabajadorDeEmpresa(usuario: UsuarioAutenticado, trabajadorId: string) {
    const [t] = await this.db
      .select({ id: trabajadores.id, empresaId: trabajadores.empresaId, jefaturaId: trabajadores.jefaturaId, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos })
      .from(trabajadores)
      .where(eq(trabajadores.id, trabajadorId));
    if (!t || t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    return t;
  }

  async subir(usuario: UsuarioAutenticado, d: DatosSubida, ip?: string) {
    const t = await this.trabajadorDeEmpresa(usuario, d.trabajadorId);
    const [tipo] = await this.db.select().from(tiposDocumento).where(eq(tiposDocumento.id, d.tipoId));
    if (!tipo) throw new BadRequestException('Tipo de documento desconocido.');

    const bytes = Buffer.from(d.contenidoBase64, 'base64');
    if (bytes.length === 0) throw new BadRequestException('El archivo está vacío.');
    if (bytes.length > TAMANO_MAXIMO) throw new BadRequestException('El archivo supera los 10 MB.');
    const mime = detectarTipo(bytes);
    if (!mime) throw new BadRequestException('Solo se aceptan PDF, PNG o JPG.');

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    // La clave interna no contiene datos personales: ni el nombre del archivo ni el RUT.
    const claveAlmacen = `${t.empresaId}/${randomUUID()}`;
    await this.almacen.guardar(claveAlmacen, cifrar(bytes, this.clave));

    const [doc] = await this.db
      .insert(documentos)
      .values({
        empresaId: t.empresaId,
        trabajadorId: t.id,
        tipoId: tipo.id,
        nombreArchivo: limpiarNombre(d.nombreArchivo),
        mime,
        tamano: bytes.length,
        claveAlmacen,
        sha256,
        venceEl: d.venceEl ?? null,
        visibilidad: d.visibilidad ?? tipo.visibilidadPorDefecto,
        notas: d.notas?.trim() || null,
        subidoPor: usuario.id,
      })
      .returning();

    await this.auditoria.registrar({ usuario, accion: 'SUBIR_DOCUMENTO', entidad: 'documento', entidadId: doc.id, ip, detalle: { trabajadorId: t.id, tipo: tipo.codigo, tamano: bytes.length } });
    if (doc.visibilidad === 'TRABAJADOR') {
      await this.avisos.crear({ empresaId: t.empresaId, destinatarios: [t.id], tipo: 'DOCUMENTO_NUEVO', titulo: `Nuevo documento: ${tipo.nombre}`, mensaje: 'Ya está disponible en Mis documentos.', enlace: '/documentos' });
    }
    return this.sinClave(doc);
  }

  /** Nunca se expone la ubicación interna del archivo. */
  private sinClave<T extends { claveAlmacen: string }>(doc: T): Omit<T, 'claveAlmacen'> {
    const { claveAlmacen: _c, ...resto } = doc;
    return resto;
  }

  async listar(usuario: UsuarioAutenticado, trabajadorId: string) {
    const t = await this.trabajadorDeEmpresa(usuario, trabajadorId);
    const permitidas = visibilidadesPermitidas(usuario, t.id);
    // 404 si no puede ver ninguno: la jefatura no debe enterarse de qué documentos existen.
    if (permitidas.length === 0) throw new NotFoundException('Ficha no encontrada');
    const filas = await this.db
      .select({
        id: documentos.id,
        nombreArchivo: documentos.nombreArchivo,
        mime: documentos.mime,
        tamano: documentos.tamano,
        venceEl: documentos.venceEl,
        visibilidad: documentos.visibilidad,
        notas: documentos.notas,
        creadoEn: documentos.creadoEn,
        tipo: tiposDocumento.nombre,
        tipoCodigo: tiposDocumento.codigo,
      })
      .from(documentos)
      .innerJoin(tiposDocumento, eq(tiposDocumento.id, documentos.tipoId))
      .where(and(eq(documentos.trabajadorId, t.id), isNull(documentos.eliminadoEn), inArray(documentos.visibilidad, permitidas)))
      .orderBy(asc(tiposDocumento.nombre), desc(documentos.creadoEn));
    return { trabajador: { id: t.id, nombres: t.nombres, apellidos: t.apellidos }, documentos: filas, puedeSubir: usuario.rol === 'PERSONAS' };
  }

  private async cargar(id: string) {
    const [doc] = await this.db.select().from(documentos).where(and(eq(documentos.id, id), isNull(documentos.eliminadoEn)));
    return doc;
  }

  /** Paso 1 de la descarga: un enlace firmado y de corta vida (HU-15). */
  async enlace(usuario: UsuarioAutenticado, id: string) {
    const doc = await this.cargar(id);
    if (!doc || !puedeVerDocumento(usuario, doc)) throw new NotFoundException('Documento no encontrado');
    const token = firmarEnlace(doc.id, usuario.id, this.secretoEnlaces);
    return { url: `/api/documentos/descarga/${token}`, expiraEnMinutos: MINUTOS_ENLACE };
  }

  /** Paso 2: valida el enlace, vuelve a revisar permisos (pudieron cambiar) y descifra. */
  async descargar(usuario: UsuarioAutenticado, token: string, ip?: string) {
    const r = verificarEnlace(token, this.secretoEnlaces);
    if (!r.ok) throw new ForbiddenException(r.motivo === 'vencido' ? 'El enlace venció. Vuelve a pedir la descarga.' : 'Enlace inválido.');
    if (r.usuarioId !== usuario.id) throw new ForbiddenException('Este enlace es de otra persona.');
    const doc = await this.cargar(r.documentoId);
    if (!doc || !puedeVerDocumento(usuario, doc)) throw new NotFoundException('Documento no encontrado');
    const bytes = descifrar(await this.almacen.leer(doc.claveAlmacen), this.clave);
    // Si la huella no calza, el archivo se alteró fuera de la aplicación: mejor fallar que entregarlo.
    if (createHash('sha256').update(bytes).digest('hex') !== doc.sha256) {
      this.logger.error(`Huella distinta en documento ${doc.id}`);
      throw new Error('Integridad del documento comprometida');
    }
    await this.auditoria.registrar({ usuario, accion: 'DESCARGAR_DOCUMENTO', entidad: 'documento', entidadId: doc.id, ip, detalle: { trabajadorId: doc.trabajadorId } });
    return { bytes, mime: doc.mime, nombre: doc.nombreArchivo };
  }

  async eliminar(usuario: UsuarioAutenticado, id: string, motivo: string, ip?: string) {
    const doc = await this.cargar(id);
    if (!doc || doc.empresaId !== usuario.empresaId) throw new NotFoundException('Documento no encontrado');
    await this.db.update(documentos).set({ eliminadoEn: new Date() }).where(eq(documentos.id, id));
    await this.auditoria.registrar({ usuario, accion: 'ELIMINAR_DOCUMENTO', entidad: 'documento', entidadId: id, ip, detalle: { motivo } });
  }

  // ------------------------------------------------------------ vencimientos (HU-16)

  /** Documentos y contratos que vencen en los próximos `dias` (y los ya vencidos hace poco). */
  async vencimientos(usuario: UsuarioAutenticado, dias = 60) {
    const hoy = hoyEn(ZONA_CHILE);
    const limite = sumarDias(hoy, dias);
    const desde = sumarDias(hoy, -30);
    const alcance: SQL[] = [eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO')];
    if (usuario.rol === 'JEFATURA') alcance.push(eq(trabajadores.jefaturaId, usuario.trabajadorId));

    const docs = await this.db
      .select({ id: documentos.id, trabajadorId: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, sede: sedes.nombre, tipo: tiposDocumento.nombre, vence: documentos.venceEl })
      .from(documentos)
      .innerJoin(trabajadores, eq(trabajadores.id, documentos.trabajadorId))
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .innerJoin(tiposDocumento, eq(tiposDocumento.id, documentos.tipoId))
      .where(and(...alcance, isNull(documentos.eliminadoEn), isNotNull(documentos.venceEl), gte(documentos.venceEl, desde), lte(documentos.venceEl, limite)));

    const contratos = await this.db
      .select({ trabajadorId: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, sede: sedes.nombre, tipoContrato: trabajadores.tipoContrato, vence: trabajadores.fechaTerminoContrato })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(and(...alcance, isNotNull(trabajadores.fechaTerminoContrato), gte(trabajadores.fechaTerminoContrato, desde), lte(trabajadores.fechaTerminoContrato, limite)));

    const items = [
      ...docs.map((d) => ({ clase: 'DOCUMENTO' as const, id: d.id, trabajadorId: d.trabajadorId, nombres: d.nombres, apellidos: d.apellidos, sede: d.sede, que: d.tipo, vence: d.vence!, requiereDecision: false })),
      ...contratos.map((c) => ({ clase: 'CONTRATO' as const, id: `contrato-${c.trabajadorId}`, trabajadorId: c.trabajadorId, nombres: c.nombres, apellidos: c.apellidos, sede: c.sede, que: c.tipoContrato === 'PLAZO_FIJO' ? 'Contrato a plazo fijo' : 'Contrato por obra o faena', vence: c.vence!, requiereDecision: true })),
    ].map((i) => ({ ...i, diasRestantes: diasCorridos(hoy, i.vence) - 1 }));
    return { hoy, dias, items: items.sort((a, b) => a.vence.localeCompare(b.vence)) };
  }

  @Cron('30 7 * * *', { name: 'avisos-vencimiento', timeZone: ZONA_CHILE })
  async revisionDiaria() {
    if (this.config.get('ALERTAS_AUTOMATICAS', { infer: true }) === 'false') return;
    const lista = await this.db.select({ id: empresas.id }).from(empresas);
    for (const e of lista) {
      const total = await this.revisarVencimientos(e.id);
      this.logger.log(`Avisos de vencimiento para ${e.id}: ${total}`);
    }
  }

  /** Crea los avisos que correspondan hoy. Devuelve cuántos se crearon (0 si ya se habían enviado). */
  async revisarVencimientos(empresaId: string): Promise<number> {
    const hoy = hoyEn(ZONA_CHILE);
    const limite = sumarDias(hoy, 30);
    const desde = sumarDias(hoy, -1);
    const personas = await this.avisos.trabajadoresConRol(empresaId, ['PERSONAS']);
    let total = 0;

    const docs = await this.db
      .select({ id: documentos.id, vence: documentos.venceEl, visibilidad: documentos.visibilidad, tipo: tiposDocumento.nombre, t: { id: trabajadores.id, jefaturaId: trabajadores.jefaturaId, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos } })
      .from(documentos)
      .innerJoin(trabajadores, eq(trabajadores.id, documentos.trabajadorId))
      .innerJoin(tiposDocumento, eq(tiposDocumento.id, documentos.tipoId))
      .where(and(eq(documentos.empresaId, empresaId), eq(trabajadores.estado, 'ACTIVO'), isNull(documentos.eliminadoEn), gte(documentos.venceEl, desde), lte(documentos.venceEl, limite)));
    for (const d of docs) {
      const restantes = diasCorridos(hoy, d.vence!) - 1;
      const umbral = umbralAviso(restantes);
      if (umbral === null) continue;
      const nombre = `${d.t.nombres} ${d.t.apellidos.split(' ')[0]}`;
      const cuando = restantes < 0 ? 'venció' : restantes === 0 ? 'vence hoy' : `vence en ${restantes} días`;
      // La jefatura solo recibe qué vence y cuándo; el documento reservado ni se nombra.
      const tipoVisible = d.visibilidad === 'RESERVADO' ? 'Un documento' : d.tipo;
      total += await this.avisos.crear({ empresaId, destinatarios: personas, tipo: 'VENCIMIENTO', titulo: `${d.tipo} de ${nombre} ${cuando}`, mensaje: `Vence el ${d.vence}.`, enlace: '/vencimientos', claveUnica: `venc:${d.id}:${umbral}` });
      const otros = [d.t.jefaturaId, d.visibilidad === 'TRABAJADOR' ? d.t.id : null].filter((x): x is string => Boolean(x));
      total += await this.avisos.crear({ empresaId, destinatarios: otros, tipo: 'VENCIMIENTO', titulo: `${tipoVisible} de ${nombre} ${cuando}`, mensaje: `Vence el ${d.vence}. Personas está al tanto.`, claveUnica: `venc:${d.id}:${umbral}` });
    }

    const contratos = await this.db
      .select({ id: trabajadores.id, jefaturaId: trabajadores.jefaturaId, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, vence: trabajadores.fechaTerminoContrato })
      .from(trabajadores)
      .where(and(eq(trabajadores.empresaId, empresaId), eq(trabajadores.estado, 'ACTIVO'), gte(trabajadores.fechaTerminoContrato, desde), lte(trabajadores.fechaTerminoContrato, limite)));
    for (const c of contratos) {
      const restantes = diasCorridos(hoy, c.vence!) - 1;
      const umbral = umbralAviso(restantes);
      if (umbral === null) continue;
      const nombre = `${c.nombres} ${c.apellidos.split(' ')[0]}`;
      total += await this.avisos.crear({
        empresaId,
        destinatarios: [...personas, ...(c.jefaturaId ? [c.jefaturaId] : [])],
        tipo: 'CONTRATO_POR_VENCER',
        titulo: `El contrato de ${nombre} vence ${restantes <= 0 ? 'hoy' : `en ${restantes} días`}: requiere una decisión`,
        // El sistema no decide: informa las opciones. Las consecuencias legales se revisan con asesoría laboral.
        mensaje: `Término pactado: ${c.vence}. Opciones: renovar, pasar a indefinido o dejar que termine. Una segunda renovación lo convierte en indefinido.`,
        enlace: '/vencimientos',
        claveUnica: `contrato:${c.id}:${c.vence}:${umbral}`,
      });
    }
    return total;
  }

  // ------------------------------------------------------------ faltantes (HU-17)

  requeridos(usuario: UsuarioAutenticado) {
    return this.db
      .select({ id: documentosRequeridos.id, cargo: documentosRequeridos.cargo, tipoId: documentosRequeridos.tipoId, tipo: tiposDocumento.nombre })
      .from(documentosRequeridos)
      .innerJoin(tiposDocumento, eq(tiposDocumento.id, documentosRequeridos.tipoId))
      .where(eq(documentosRequeridos.empresaId, usuario.empresaId))
      .orderBy(asc(documentosRequeridos.cargo), asc(tiposDocumento.nombre));
  }

  async agregarRequerido(usuario: UsuarioAutenticado, cargo: string, tipoId: string) {
    await this.db.insert(documentosRequeridos).values({ empresaId: usuario.empresaId, cargo: cargo.trim(), tipoId }).onConflictDoNothing();
    await this.auditoria.registrar({ usuario, accion: 'AGREGAR_REQUISITO_DOCUMENTO', entidad: 'documento_requerido', detalle: { cargo, tipoId } });
  }

  async quitarRequerido(usuario: UsuarioAutenticado, id: string) {
    await this.db.delete(documentosRequeridos).where(and(eq(documentosRequeridos.id, id), eq(documentosRequeridos.empresaId, usuario.empresaId)));
    await this.auditoria.registrar({ usuario, accion: 'QUITAR_REQUISITO_DOCUMENTO', entidad: 'documento_requerido', entidadId: id });
  }

  /** Reporte de faltantes por sede. Se calcula en memoria: con cientos de personas es instantáneo. */
  async faltantes(usuario: UsuarioAutenticado) {
    const requisitos = await this.db.select().from(documentosRequeridos).where(eq(documentosRequeridos.empresaId, usuario.empresaId));
    const tipos = new Map((await this.tipos()).map((t) => [t.id, t.nombre]));
    const personas = await this.db
      .select({ id: trabajadores.id, nombres: trabajadores.nombres, apellidos: trabajadores.apellidos, cargo: trabajadores.cargo, sede: sedes.nombre })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(and(eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO')))
      .orderBy(asc(sedes.nombre), asc(trabajadores.apellidos));
    const tiene = await this.db
      .select({ trabajadorId: documentos.trabajadorId, tipoId: documentos.tipoId })
      .from(documentos)
      .where(and(eq(documentos.empresaId, usuario.empresaId), isNull(documentos.eliminadoEn), or(isNull(documentos.venceEl), gte(documentos.venceEl, hoyEn(ZONA_CHILE)))!))
      .groupBy(documentos.trabajadorId, documentos.tipoId);
    const porPersona = new Map<string, Set<string>>();
    for (const f of tiene) {
      if (!porPersona.has(f.trabajadorId)) porPersona.set(f.trabajadorId, new Set());
      porPersona.get(f.trabajadorId)!.add(f.tipoId);
    }
    const conFaltantes = personas
      .map((p) => ({ ...p, faltan: faltantes(p.cargo, requisitos, porPersona.get(p.id) ?? new Set()).map((id) => tipos.get(id) ?? id) }))
      .filter((p) => p.faltan.length > 0);
    const sedesResumen = [...new Set(personas.map((p) => p.sede))].map((sede) => ({
      sede,
      personas: personas.filter((p) => p.sede === sede).length,
      incompletas: conFaltantes.filter((p) => p.sede === sede).length,
    }));
    return { sedes: sedesResumen, personas: conFaltantes, totalRequisitos: requisitos.length, totalPersonas: personas.length };
  }
}
