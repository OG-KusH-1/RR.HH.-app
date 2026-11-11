import { Injectable } from '@nestjs/common';
import { AuthenticationStorage, type SessionRecord, type SessionStore } from '@nestjs/authentication';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '../db/database.js';
import { sesiones } from '../db/schema.js';
import { UsuariosRepository } from './usuarios.repository.js';

type FilaSesion = typeof sesiones.$inferSelect;

function aRegistro(fila: FilaSesion): SessionRecord {
  return {
    id: fila.id,
    userId: fila.usuarioId,
    createdAt: fila.creadaEn,
    expiresAt: fila.expiraEn,
    lastActiveAt: fila.ultimaActividad,
    ...(fila.mfa ? { mfa: fila.mfa as SessionRecord['mfa'] } : {}),
    ...(fila.metadata ? { metadata: fila.metadata } : {}),
  };
}

/** Guarda las sesiones en PostgreSQL en vez de la memoria del proceso. */
@Injectable()
export class SesionesStore implements SessionStore {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly usuarios: UsuariosRepository,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const [fila] = await this.db.select().from(sesiones).where(eq(sesiones.id, id));
    if (!fila) return undefined;
    const registro = aRegistro(fila);
    const user = await this.usuarios.buscarPorId(fila.usuarioId);
    return user ? { ...registro, extra: { user } } : registro;
  }

  async createSession(r: SessionRecord): Promise<void> {
    await this.db.insert(sesiones).values({
      id: r.id,
      usuarioId: r.userId,
      creadaEn: r.createdAt,
      expiraEn: r.expiresAt,
      ultimaActividad: r.lastActiveAt,
      mfa: r.mfa ?? null,
      metadata: r.metadata ?? null,
    });
    await this.db.delete(sesiones).where(lt(sesiones.expiraEn, new Date()));
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.db
      .update(sesiones)
      .set({ ultimaActividad: lastActiveAt })
      .where(and(eq(sesiones.id, id), lt(sesiones.ultimaActividad, lastActiveAt)));
  }

  async deleteSession(id: string): Promise<boolean> {
    const borradas = await this.db.delete(sesiones).where(eq(sesiones.id, id)).returning({ id: sesiones.id });
    return borradas.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const filas = await this.db.select().from(sesiones).where(eq(sesiones.usuarioId, userId));
    return filas.map(aRegistro);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(sesiones).where(eq(sesiones.usuarioId, userId));
  }
}
