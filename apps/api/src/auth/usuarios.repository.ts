import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/database.js';
import { trabajadores, usuarios } from '../db/schema.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

const columnasUsuario = {
  id: usuarios.id,
  trabajadorId: trabajadores.id,
  empresaId: trabajadores.empresaId,
  sedeId: trabajadores.sedeId,
  rol: usuarios.rol,
  rut: trabajadores.rut,
  nombres: trabajadores.nombres,
  apellidos: trabajadores.apellidos,
  cargo: trabajadores.cargo,
};

@Injectable()
export class UsuariosRepository {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  async buscarPorId(id: string): Promise<UsuarioAutenticado | null> {
    const [fila] = await this.db
      .select(columnasUsuario)
      .from(usuarios)
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(and(eq(usuarios.id, id), eq(trabajadores.estado, 'ACTIVO')));
    return fila ?? null;
  }

  /** Datos para verificar la contraseña. Solo trabajadores activos pueden ingresar. */
  async buscarCredenciales(rut: string) {
    const [fila] = await this.db
      .select({ ...columnasUsuario, hashClave: usuarios.hashClave, intentosFallidos: usuarios.intentosFallidos, bloqueadoHasta: usuarios.bloqueadoHasta })
      .from(usuarios)
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(and(eq(trabajadores.rut, rut), eq(trabajadores.estado, 'ACTIVO')));
    return fila ?? null;
  }

  async registrarIntentoFallido(id: string, maxIntentos: number, bloqueoMs: number) {
    await this.db
      .update(usuarios)
      .set({
        intentosFallidos: sql`${usuarios.intentosFallidos} + 1`,
        bloqueadoHasta: sql`case when ${usuarios.intentosFallidos} + 1 >= ${maxIntentos} then now() + make_interval(secs => ${bloqueoMs / 1000}) else ${usuarios.bloqueadoHasta} end`,
      })
      .where(eq(usuarios.id, id));
  }

  async registrarIngresoExitoso(id: string) {
    await this.db.update(usuarios).set({ intentosFallidos: 0, bloqueadoHasta: null, ultimoIngreso: new Date() }).where(eq(usuarios.id, id));
  }

  async actualizarHash(id: string, hashClave: string) {
    await this.db.update(usuarios).set({ hashClave, actualizadoEn: new Date() }).where(eq(usuarios.id, id));
  }
}
