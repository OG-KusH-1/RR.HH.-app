CREATE TYPE "estado_indicadores" AS ENUM('BORRADOR', 'CONFIRMADO');--> statement-breakpoint
CREATE TYPE "tipo_salud" AS ENUM('FONASA', 'ISAPRE');--> statement-breakpoint
CREATE TABLE "afps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codigo" text NOT NULL UNIQUE,
	"nombre" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicadores_mensuales" (
	"periodo" text PRIMARY KEY,
	"estado" "estado_indicadores" DEFAULT 'BORRADOR'::"estado_indicadores" NOT NULL,
	"uf" numeric(10,2) NOT NULL,
	"utm" integer NOT NULL,
	"ingreso_minimo" integer NOT NULL,
	"tope_imponible_afp_uf" numeric(6,2) NOT NULL,
	"tope_imponible_cesantia_uf" numeric(6,2) NOT NULL,
	"tasa_sis" numeric(5,3) NOT NULL,
	"tasa_empleador_reforma" numeric(5,3) NOT NULL,
	"tasa_accidentes" numeric(5,3) NOT NULL,
	"tramos_impuesto" jsonb NOT NULL,
	"fuentes" jsonb NOT NULL,
	"confirmado_por" uuid,
	"confirmado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instituciones_salud" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"codigo" text NOT NULL UNIQUE,
	"nombre" text NOT NULL,
	"tipo" "tipo_salud" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasas_afp" (
	"afp_id" uuid,
	"vigente_desde" date,
	"comision" numeric(6,4) NOT NULL,
	"fuente" text NOT NULL,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasas_afp_pkey" PRIMARY KEY("afp_id","vigente_desde")
);
--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "sueldo_base" integer;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "afp_id" uuid;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "salud_id" uuid;--> statement-breakpoint
ALTER TABLE "trabajadores" ADD COLUMN "plan_isapre_uf" numeric(8,4);--> statement-breakpoint
ALTER TABLE "indicadores_mensuales" ADD CONSTRAINT "indicadores_mensuales_confirmado_por_usuarios_id_fkey" FOREIGN KEY ("confirmado_por") REFERENCES "usuarios"("id");--> statement-breakpoint
ALTER TABLE "tasas_afp" ADD CONSTRAINT "tasas_afp_afp_id_afps_id_fkey" FOREIGN KEY ("afp_id") REFERENCES "afps"("id");--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_afp_id_afps_id_fkey" FOREIGN KEY ("afp_id") REFERENCES "afps"("id");--> statement-breakpoint
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_salud_id_instituciones_salud_id_fkey" FOREIGN KEY ("salud_id") REFERENCES "instituciones_salud"("id");