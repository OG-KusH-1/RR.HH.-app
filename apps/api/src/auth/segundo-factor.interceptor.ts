/**
 * Exige el segundo factor a los roles con acceso amplio (HU-04).
 *
 * Es un interceptor y no un guard porque los interceptores corren después de todos los guards:
 * así el usuario ya está autenticado y `request.user` existe. Mientras no active su segundo
 * factor, la persona solo puede usar las rutas de su cuenta (/auth/*), donde lo activa.
 *
 * Se apaga con SEGUNDO_FACTOR_OBLIGATORIO=false, pensado solo para demostraciones locales.
 */
import { ForbiddenException, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Observable } from 'rxjs';
import type { Database } from '../db/database.js';
import { usuarios } from '../db/schema.js';
import { AccesoService } from './acceso.service.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

@Injectable()
export class SegundoFactorInterceptor implements NestInterceptor {
  constructor(
    private readonly acceso: AccesoService,
    @InjectDrizzle() private readonly db: Database,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{ user?: UsuarioAutenticado | null; path?: string; url: string }>();
    const usuario = req.user;
    const ruta = req.path ?? req.url;
    if (!usuario || ruta.startsWith('/api/auth/') || !this.acceso.segundoFactorObligatorio(usuario.rol)) return next.handle();
    const [f] = await this.db.select({ activo: usuarios.totpActivadoEn }).from(usuarios).where(eq(usuarios.id, usuario.id));
    if (!f?.activo) throw new ForbiddenException({ statusCode: 403, mensaje: 'Activa el segundo factor para continuar.', codigo: 'SEGUNDO_FACTOR_PENDIENTE' });
    return next.handle();
  }
}
