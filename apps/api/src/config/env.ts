import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  /** Orígenes del frontend que pueden usar la cookie de sesión. */
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  /** Clave de la API de la CMF para UF y UTM oficiales. Sin ella se usa mindicador.cl como respaldo. */
  CMF_API_KEY: z.string().optional(),
  /** "false" desactiva la sincronización diaria de indicadores (útil en pruebas). */
  SINCRONIZACION_AUTOMATICA: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof esquema>;

export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = esquema.safeParse(config);
  if (!resultado.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
