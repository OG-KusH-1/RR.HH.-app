CREATE TYPE "estado_cambio_turno" AS ENUM('ESPERA_COMPANERO', 'ESPERA_JEFATURA', 'APROBADO', 'RECHAZADO', 'CANCELADO');--> statement-breakpoint
CREATE TABLE "cambios_turno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"turno_solicitante_id" uuid NOT NULL,
	"turno_companero_id" uuid,
	"solicitante_id" uuid NOT NULL,
	"companero_id" uuid NOT NULL,
	"motivo" text,
	"estado" "estado_cambio_turno" DEFAULT 'ESPERA_COMPANERO'::"estado_cambio_turno" NOT NULL,
	"resuelto_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"resuelto_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "turnos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"empresa_id" uuid NOT NULL,
	"trabajador_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"inicio" text NOT NULL,
	"fin" text NOT NULL,
	"colacion_min" integer DEFAULT 30 NOT NULL,
	"publicado" boolean DEFAULT false NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "turnos_persona_dia_uq" ON "turnos" ("trabajador_id","fecha");--> statement-breakpoint
CREATE INDEX "turnos_empresa_fecha_idx" ON "turnos" ("empresa_id","fecha");--> statement-breakpoint
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_turno_solicitante_id_turnos_id_fkey" FOREIGN KEY ("turno_solicitante_id") REFERENCES "turnos"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_turno_companero_id_turnos_id_fkey" FOREIGN KEY ("turno_companero_id") REFERENCES "turnos"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_solicitante_id_trabajadores_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_companero_id_trabajadores_id_fkey" FOREIGN KEY ("companero_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "cambios_turno" ADD CONSTRAINT "cambios_turno_resuelto_por_usuarios_id_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_empresa_id_empresas_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id");--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_trabajador_id_trabajadores_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id");--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_creado_por_usuarios_id_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id");