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
  /** 32 bytes en base64 para cifrar documentos y secretos de 2FA. Perderla = perder los archivos. */
  CLAVE_CIFRADO: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'Debe tener 32 bytes en base64: openssl rand -base64 32'),
  /** Firma de enlaces de descarga temporales. Distinta de CLAVE_CIFRADO para poder rotarlas por separado. */
  SECRETO_ENLACES: z.string().min(32, 'Usa al menos 32 caracteres: openssl rand -base64 32'),
  /** Carpeta del almacén local de archivos cifrados. En producción se reemplaza por S3 (fase de integraciones). */
  ALMACEN_DIR: z.string().default('almacen'),
  /** URL pública del portal, para el enlace de verificación impreso en los certificados. */
  PORTAL_URL: z.string().url().default('http://localhost:3000'),
  /** "false" desactiva los avisos diarios de vencimiento (útil en pruebas). */
  ALERTAS_AUTOMATICAS: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof esquema>;

export function validarEnv(config: Record<string, unknown>): Env {
  const resultado = esquema.safeParse(config);
  if (!resultado.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(resultado.error)}`);
  }
  return resultado.data;
}
