import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, count, eq, or, type SQL } from 'drizzle-orm';
import { AuditoriaService } from '../audit/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Database } from '../db/database.js';
import { afps, institucionesSalud, sedes, trabajadores } from '../db/schema.js';
import { alcanceListado } from './alcance.js';
import { TrabajadoresPolicy } from './trabajadores.policy.js';

const columnasLista = {
  id: trabajadores.id,
  empresaId: trabajadores.empresaId,
  jefaturaId: trabajadores.jefaturaId,
  rut: trabajadores.rut,
  nombres: trabajadores.nombres,
  apellidos: trabajadores.apellidos,
  cargo: trabajadores.cargo,
  fechaIngreso: trabajadores.fechaIngreso,
  tipoContrato: trabajadores.tipoContrato,
  horasSemanales: trabajadores.horasSemanales,
  sede: sedes.nombre,
  sedeId: sedes.id,
  zonaHoraria: sedes.zonaHoraria,
};

@Injectable()
export class TrabajadoresService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly authorization: AuthorizationService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Lista filtrada en la base de datos según el rol: nunca se traen filas que el usuario no puede ver. */
  async listar(usuario: UsuarioAutenticado) {
    const alcance = alcanceListado(usuario);
    const condiciones: SQL[] = [eq(trabajadores.empresaId, usuario.empresaId), eq(trabajadores.estado, 'ACTIVO')];
    if (alcance.tipo === 'equipo') {
      condiciones.push(or(eq(trabajadores.jefaturaId, alcance.jefaturaId), eq(trabajadores.id, usuario.trabajadorId))!);
    } else if (alcance.tipo === 'propio') {
      condiciones.push(eq(trabajadores.id, usuario.trabajadorId));
    }
    return this.db
      .select(columnasLista)
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(and(...condiciones))
      .orderBy(asc(sedes.nombre), asc(trabajadores.apellidos));
  }

  async ver(usuario: UsuarioAutenticado, id: string, ip?: string) {
    const [fila] = await this.db
      .select({
        ...columnasLista,
        telefono: trabajadores.telefono,
        afpId: trabajadores.afpId,
        afp: afps.nombre,
        saludId: trabajadores.saludId,
        salud: institucionesSalud.nombre,
        saludTipo: institucionesSalud.tipo,
        planIsapreUf: trabajadores.planIsapreUf,
        sueldoBase: trabajadores.sueldoBase,
      })
      .from(trabajadores)
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .leftJoin(afps, eq(afps.id, trabajadores.afpId))
      .leftJoin(institucionesSalud, eq(institucionesSalud.id, trabajadores.saludId))
      .where(eq(trabajadores.id, id));
    // El sueldo solo lo ven el propio trabajador, Personas y Gerencia (nunca la jefatura).
    const veSueldo = fila && (fila.id === usuario.trabajadorId || usuario.rol === 'PERSONAS' || usuario.rol === 'GERENCIA');
    const ficha = fila && { ...fila, sueldoBase: veSueldo ? fila.sueldoBase : undefined, puedeVerRemuneracion: Boolean(veSueldo) };
    // Se responde 404 también cuando no tiene permiso para no revelar qué fichas existen.
    if (!ficha || !(await this.authorization.can(TrabajadoresPolicy, 'ver', usuario, ficha))) {
      throw new NotFoundException('Ficha no encontrada');
    }
    if (ficha.id !== usuario.trabajadorId) {
      await this.auditoria.registrar({ usuario, accion: 'VER_FICHA', entidad: 'trabajador', entidadId: ficha.id, ip });
    }
    return ficha;
  }

  async resumenPorSede(usuario: UsuarioAutenticado) {
    return this.db
      .select({ sedeId: sedes.id, sede: sedes.nombre, ciudad: sedes.ciudad, zonaHoraria: sedes.zonaHoraria, dotacion: count(trabajadores.id) })
      .from(sedes)
      .leftJoin(trabajadores, and(eq(trabajadores.sedeId, sedes.id), eq(trabajadores.estado, 'ACTIVO')))
      .where(eq(sedes.empresaId, usuario.empresaId))
      .groupBy(sedes.id)
      .orderBy(asc(sedes.nombre));
  }
}
