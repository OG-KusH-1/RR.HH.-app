import { Injectable, Logger } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { Database } from '../db/database.js';
import { registrosAuditoria } from '../db/schema.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';

export interface EventoAuditoria {
  usuario?: Pick<UsuarioAutenticado, 'id' | 'empresaId'>;
  accion: string;
  entidad: string;
  entidadId?: string;
  detalle?: Record<string, unknown>;
  ip?: string;
}

/**
 * Registro de quién hizo qué y cuándo (HU-19). Solo inserta: la aplicación no
 * tiene ninguna operación para editar o borrar registros.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(@InjectDrizzle() private readonly db: Database) {}

  async registrar(e: EventoAuditoria): Promise<void> {
    try {
      await this.db.insert(registrosAuditoria).values({
        empresaId: e.usuario?.empresaId ?? null,
        usuarioId: e.usuario?.id ?? null,
        accion: e.accion,
        entidad: e.entidad,
        entidadId: e.entidadId ?? null,
        detalle: e.detalle ?? null,
        ip: e.ip ?? null,
      });
    } catch (error) {
      // Una falla de auditoría no debe pasar inadvertida.
      this.logger.error(`No se pudo registrar ${e.accion}`, error as Error);
      throw error;
    }
  }
}
