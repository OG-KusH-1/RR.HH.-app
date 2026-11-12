CREATE TYPE "estado_solicitud" AS ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "estado_solicitud_titular" AS ENUM('ABIERTA', 'RESUELTA', 'RECHAZADA');--> statement-breakpoint
CREATE TYPE "tipo_movimiento_vacaciones" AS ENUM('TOMADO_ANTERIOR', 'TOMADO', 'REVERSA', 'AJUSTE');--> statement-breakpoint
CREATE TYPE "tipo_solicitud_titular" AS ENUM('ACCESO', 'RECTIFICACION');--> statement-breakpoint
CREATE TYPE "visibilidad_documento" AS ENUM('TRABAJADOR', 'INTERNO', 'RESERVADO');--> statement-breakpoint
CREATE TABLE "certificados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"codigo" text NOT NULL UNIQUE,
	"tipo" text NOT NULL,
	"datos" jsonb NOT NULL,
	"emitido_por" uuid,
	"emitido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_en" timestamp with time zone,
	"motivo_revocacion" text
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"nombre_archivo" text NOT NULL,
	"mime" text NOT NULL,
	"tamano" integer NOT NULL,
	"clave_almacen" text NOT NULL,
	"sha256" text NOT NULL,
	"vence_el" date,
	"visibilidad" "visibilidad_documento" NOT NULL,
	"notas" text,
	"subido_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documentos_requeridos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"cargo" text NOT NULL,
	"tipo_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feriados" (
	"fecha" date PRIMARY KEY,
	"nombre" text NOT NULL,
	"irrenunciable" boolean DEFAULT false NOT NULL,
	"fuente" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"usuario_id" uuid NOT NULL,
	"hash_codigo" text NOT NULL UNIQUE,
	"expira_en" timestamp with time zone NOT NULL,
	"usada_en" timestamp with time zone,
	"creada_por" uuid,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_vacaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"trabajador_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"tipo" "tipo_movimiento_vacaciones" NOT NULL,
	"dias" numeric(6,2) NOT NULL,
	"solicitud_id" uuid,
	"motivo" text NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"mensaje" text NOT NULL,
	"enlace" text,
	"clave_unica" text UNIQUE,
	"leida_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitudes_ausencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"dias_habiles" integer NOT NULL,
	"estado" "estado_solicitud" DEFAULT 'PENDIENTE'::"estado_solicitud" NOT NULL,
	"comentario" text,
	"detalle_reservado" text,
	"motivo_rechazo" text,
	"creada_por" uuid,
	"resuelta_por" uuid,
	"resuelta_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitudes_titular" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"tipo" "tipo_solicitud_titular" NOT NULL,
	"detalle" text NOT NULL,
	"estado" "estado_solicitud_titular" DEFAULT 'ABIERTA'::"estado_solicitud_titular" NOT NULL,
	"respuesta" text,
	"resuelta_por" uuid,
	"resuelta_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_ausencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codigo" text NOT NULL UNIQUE,
	"nombre" text NOT NULL,
	"descripcion" text NOT NULL,
	"afecta_saldo" boolean DEFAULT false NOT NULL,
	"con_goce" boolean DEFAULT true NOT NULL,
	"sensible" boolean DEFAULT false NOT NULL,
	"requiere_aprobacion" boolean DEFAULT true NOT NULL,
	"permite_retroactivo" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codigo" text NOT NULL UNIQUE,
	"nombre" text NOT NULL,
	"con_vencimiento" boolean DEFAULT false NOT NULL,
	"visibilidad_por_defecto" "visibilidad_documento" DEFAULT 'TRABAJADOR'::"visibilidad_documento" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "fecha_termino_contrato" date;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "fecha_desvinculacion" date;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "anios_previos_reconocidos" numeric(4,1) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "respaldo_anios_previos" text;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "totp_secreto_cifrado" text;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "totp_activado_en" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "documentos_trabajador_idx" ON "documentos" ("trabajador_id");--> statement-breakpoint
CREATE INDEX "documentos_vence_idx" ON "documentos" ("vence_el");--> statement-breakpoint
CREATE UNIQUE INDEX "requeridos_uq" ON "documentos_requeridos" ("empresa_id","cargo","tipo_id");--> statement-breakpoint
CREATE INDEX "movimientos_trabajador_idx" ON "movimientos_vacaciones" ("trabajador_id");--> statement-breakpoint
CREATE INDEX "notificaciones_destinatario_idx" ON "notificaciones" ("trabajador_id","leida_en");--> statement-breakpoint
CREATE INDEX "solicitudes_trabajador_idx" ON "solicitudes_ausencia" ("trabajador_id");--> statement-breakpoint
CREATE INDEX "solicitudes_empresa_fechas_idx" ON "solicitudes_ausencia" ("empresa_id","desde","hasta");--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_emitido_por_usuarios_id_fkey" FOREIGN KEY ("emitido_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tipo_id_tipos_documento_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_documento"("id");--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_usuarios_id_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "documentos_requeridos" ADD CONSTRAINT "documentos_requeridos_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "documentos_requeridos" ADD CONSTRAINT "documentos_requeridos_tipo_id_tipos_documento_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_documento"("id");--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_usuario_id_usuarios_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_creada_por_usuarios_id_fkey" FOREIGN KEY ("creada_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "movimientos_vacaciones" ADD CONSTRAINT "movimientos_vacaciones_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "movimientos_vacaciones" ADD CONSTRAINT "movimientos_vacaciones_W7icCDY4H4hv_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_ausencia"("id");--> statement-breakpoint
ALTER TABLE "movimientos_vacaciones" ADD CONSTRAINT "movimientos_vacaciones_creado_por_usuarios_id_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_ausencia" ADD CONSTRAINT "solicitudes_ausencia_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_ausencia" ADD CONSTRAINT "solicitudes_ausencia_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_ausencia" ADD CONSTRAINT "solicitudes_ausencia_tipo_id_tipos_ausencia_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_ausencia"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_ausencia" ADD CONSTRAINT "solicitudes_ausencia_creada_por_usuarios_id_fkey" FOREIGN KEY ("creada_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_ausencia" ADD CONSTRAINT "solicitudes_ausencia_resuelta_por_usuarios_id_fkey" FOREIGN KEY ("resuelta_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_titular" ADD CONSTRAINT "solicitudes_titular_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_titular" ADD CONSTRAINT "solicitudes_titular_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "solicitudes_titular" ADD CONSTRAINT "solicitudes_titular_resuelta_por_usuarios_id_fkey" FOREIGN KEY ("resuelta_por") REFERENCES "usuarios"("id");