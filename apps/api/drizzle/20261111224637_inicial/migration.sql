CREATE TYPE "estado_trabajador" AS ENUM('ACTIVO', 'DESVINCULADO');--> statement-breakpoint
CREATE TYPE "rol" AS ENUM('TRABAJADOR', 'JEFATURA', 'PERSONAS', 'GERENCIA', 'ADMIN');--> statement-breakpoint
CREATE TYPE "tipo_contrato" AS ENUM('INDEFINIDO', 'PLAZO_FIJO', 'OBRA_FAENA');--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"rut" text NOT NULL UNIQUE,
	"razon_social" text NOT NULL,
	"nombre_fantasia" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registros_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid,
	"usuario_id" uuid,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"detalle" jsonb,
	"ip" text,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sedes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"ciudad" text NOT NULL,
	"zona_horaria" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY,
	"usuario_id" uuid NOT NULL,
	"creada_en" timestamp with time zone NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"ultima_actividad" timestamp with time zone NOT NULL,
	"mfa" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "trabajadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"jefatura_id" uuid,
	"rut" text NOT NULL,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"cargo" text NOT NULL,
	"fecha_ingreso" date NOT NULL,
	"tipo_contrato" "tipo_contrato" NOT NULL,
	"horas_semanales" integer DEFAULT 42 NOT NULL,
	"telefono" text,
	"estado" "estado_trabajador" DEFAULT 'ACTIVO'::"estado_trabajador" NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"trabajador_id" uuid NOT NULL UNIQUE,
	"rol" "rol" DEFAULT 'TRABAJADOR'::"rol" NOT NULL,
	"hash_clave" text,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"ultimo_ingreso" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "registros_auditoria" ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "auditoria_fecha_idx" ON "registros_auditoria" ("fecha");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_expira_idx" ON "sesiones" ("expira_en");--> statement-breakpoint
CREATE UNIQUE INDEX "trabajadores_empresa_rut_uq" ON "trabajadores" ("empresa_id","rut");--> statement-breakpoint
CREATE INDEX "trabajadores_sede_idx" ON "trabajadores" ("sede_id");--> statement-breakpoint
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "registros_auditoria" ADD CONSTRAINT "registros_auditoria_usuario_id_usuarios_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_sede_id_sedes_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id");--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");