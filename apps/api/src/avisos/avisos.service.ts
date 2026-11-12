/**
 * Avisos dentro de la aplicación (campana del portal).
 *
 * Es el único punto por donde los módulos avisan algo a una persona: vacaciones,
 * vencimientos, solicitudes de datos. Cuando se agregue correo o WhatsApp
 * (fase de integraciones), se suscriben aquí y no hay que tocar cada módulo.
 *
 * Los avisos van al trabajador, no al usuario, para no perder avisos de quien aún
 * no activa su cuenta: los verá al entrar por primera vez.
 */
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Database } from '../db/database.js';
import { notificaciones, trabajadores, usuarios } from '../db/schema.js';
import type { Rol } from '../common/roles.js';

export interface NuevoAviso {
  empresaId: string;
  destinatarios: string[];
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace?: string;
  /** Si se indica, se agrega ":<destinatario>" y el aviso no se repite aunque el proceso corra dos veces. */
  claveUnica?: string;
}

@Injectable()
export class AvisosService {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  /** Devuelve cuántos avisos se crearon (los duplicados por clave única se omiten en silencio). */
  async crear(a: NuevoAviso): Promise<number> {
    const destinatarios = [...new Set(a.destinatarios)];
    if (destinatarios.length === 0) return 0;
    const filas = await this.db
      .insert(notificaciones)
      .values(
        destinatarios.map((trabajadorId) => ({
          empresaId: a.empresaId,
          trabajadorId,
          tipo: a.tipo,
          titulo: a.titulo,
          mensaje: a.mensaje,
          enlace: a.enlace ?? null,
          claveUnica: a.claveUnica ? `${a.claveUnica}:${trabajadorId}` : null,
        })),
      )
      .onConflictDoNothing({ target: notificaciones.claveUnica })
      .returning({ id: notificaciones.id });
    return filas.length;
  }

  /** Trabajadores activos de la empresa con alguno de los roles indicados (por ejemplo, todo Personas). */
  async trabajadoresConRol(empresaId: string, roles: Rol[]): Promise<string[]> {
    const filas = await this.db
      .select({ id: trabajadores.id })
      .from(usuarios)
      .innerJoin(trabajadores, eq(trabajadores.id, usuarios.trabajadorId))
      .where(and(eq(trabajadores.empresaId, empresaId), eq(trabajadores.estado, 'ACTIVO'), inArray(usuarios.rol, roles)));
    return filas.map((f) => f.id);
  }

  listar(usuario: UsuarioAutenticado, limite = 50) {
    return this.db
      .select()
      .from(notificaciones)
      .where(eq(notificaciones.trabajadorId, usuario.trabajadorId))
      .orderBy(desc(notificaciones.creadaEn))
      .limit(limite);
  }

  async noLeidas(usuario: UsuarioAutenticado): Promise<number> {
    const [fila] = await this.db
      .select({ total: count() })
      .from(notificaciones)
      .where(and(eq(notificaciones.trabajadorId, usuario.trabajadorId), isNull(notificaciones.leidaEn)));
    return fila?.total ?? 0;
  }

  /** Solo marca avisos propios: el filtro por destinatario hace imposible marcar los de otra persona. */
  async marcarLeida(usuario: UsuarioAutenticado, id: string) {
    await this.db
      .update(notificaciones)
      .set({ leidaEn: new Date() })
      .where(and(eq(notificaciones.id, id), eq(notificaciones.trabajadorId, usuario.trabajadorId), isNull(notificaciones.leidaEn)));
  }

  async marcarTodas(usuario: UsuarioAutenticado) {
    await this.db
      .update(notificaciones)
      .set({ leidaEn: new Date() })
      .where(and(eq(notificaciones.trabajadorId, usuario.trabajadorId), isNull(notificaciones.leidaEn)));
  }
}
