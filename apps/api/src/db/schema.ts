import { sql } from 'drizzle-orm';
import { date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ROLES } from '../common/roles.js';

export const rolEnum = pgEnum('rol', ROLES);
export const estadoTrabajadorEnum = pgEnum('estado_trabajador', ['ACTIVO', 'DESVINCULADO']);
export const tipoContratoEnum = pgEnum('tipo_contrato', ['INDEFINIDO', 'PLAZO_FIJO', 'OBRA_FAENA']);

const auditoria = {
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
};

/** La empresa existe desde el inicio para poder atender varias en el futuro (ADR-0003). */
export const empresas = pgTable('empresas', {
  id: uuid().primaryKey().defaultRandom(),
  rut: text().notNull().unique(),
  razonSocial: text('razon_social').notNull(),
  nombreFantasia: text('nombre_fantasia').notNull(),
  ...auditoria,
});

/** Cada sede guarda su zona horaria IANA (ADR-0004). */
export const sedes = pgTable('sedes', {
  id: uuid().primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id').notNull().references(() => empresas.id),
  nombre: text().notNull(),
  ciudad: text().notNull(),
  zonaHoraria: text('zona_horaria').notNull(),
  ...auditoria,
});

export const trabajadores = pgTable(
  'trabajadores',
  {
    id: uuid().primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id').notNull().references(() => empresas.id),
    sedeId: uuid('sede_id').notNull().references(() => sedes.id),
    jefaturaId: uuid('jefatura_id'),
    rut: text().notNull(),
    nombres: text().notNull(),
    apellidos: text().notNull(),
    cargo: text().notNull(),
    fechaIngreso: date('fecha_ingreso').notNull(),
    tipoContrato: tipoContratoEnum('tipo_contrato').notNull(),
    horasSemanales: integer('horas_semanales').notNull().default(42),
    telefono: text(),
    estado: estadoTrabajadorEnum().notNull().default('ACTIVO'),
    // --- Previsión y remuneración (módulo previsional, ver src/previsional) ---
    /** Sueldo base mensual bruto en pesos, para jornada completa pactada. */
    sueldoBase: integer('sueldo_base'),
    afpId: uuid('afp_id').references(() => afps.id),
    saludId: uuid('salud_id').references(() => institucionesSalud.id),
    /** Plan pactado con la Isapre, en UF. Nulo para Fonasa. */
    planIsapreUf: numeric('plan_isapre_uf', { precision: 8, scale: 4, mode: 'number' }),
    ...auditoria,
  },
  (t) => [uniqueIndex('trabajadores_empresa_rut_uq').on(t.empresaId, t.rut), index('trabajadores_sede_idx').on(t.sedeId)],
);

export const usuarios = pgTable('usuarios', {
  id: uuid().primaryKey().defaultRandom(),
  trabajadorId: uuid('trabajador_id')
    .notNull()
    .unique()
    .references(() => trabajadores.id),
  rol: rolEnum().notNull().default('TRABAJADOR'),
  hashClave: text('hash_clave'),
  intentosFallidos: integer('intentos_fallidos').notNull().default(0),
  bloqueadoHasta: timestamp('bloqueado_hasta', { withTimezone: true }),
  ultimoIngreso: timestamp('ultimo_ingreso', { withTimezone: true }),
  ...auditoria,
});

/** Sesiones del navegador. El id es el SHA-256 del token de la cookie: el token nunca se guarda. */
export const sesiones = pgTable(
  'sesiones',
  {
    id: text().primaryKey(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    creadaEn: timestamp('creada_en', { withTimezone: true }).notNull(),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    ultimaActividad: timestamp('ultima_actividad', { withTimezone: true }).notNull(),
    mfa: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [index('sesiones_usuario_idx').on(t.usuarioId), index('sesiones_expira_idx').on(t.expiraEn)],
);

/** Registro de auditoría: solo se inserta, nunca se modifica (HU-19). */
export const registrosAuditoria = pgTable(
  'registros_auditoria',
  {
    id: uuid().primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id').references(() => empresas.id),
    usuarioId: uuid('usuario_id').references(() => usuarios.id),
    accion: text().notNull(),
    entidad: text().notNull(),
    entidadId: text('entidad_id'),
    detalle: jsonb().$type<Record<string, unknown>>(),
    ip: text(),
    fecha: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('auditoria_entidad_idx').on(t.entidad, t.entidadId), index('auditoria_fecha_idx').on(t.fecha)],
);

// ---------------------------------------------------------------------------
// Módulo previsional
//
// Regla de diseño: ningún parámetro legal (tasas, topes, UF, UTM, tramos) vive
// en el código. Todos se guardan con su fecha de vigencia y su fuente, para que
// una liquidación de cualquier mes se pueda recalcular con los valores de ese mes.
// ---------------------------------------------------------------------------

export const tipoSaludEnum = pgEnum('tipo_salud', ['FONASA', 'ISAPRE']);
export const estadoIndicadoresEnum = pgEnum('estado_indicadores', ['BORRADOR', 'CONFIRMADO']);

/** Administradoras de fondos de pensiones. La comisión vive en `tasas_afp`, porque cambia en el tiempo. */
export const afps = pgTable('afps', {
  id: uuid().primaryKey().defaultRandom(),
  codigo: text().notNull().unique(),
  nombre: text().notNull(),
});

/**
 * Comisión de cada AFP con su vigencia. La tasa que paga el trabajador es
 * 10 % (cotización obligatoria) + esta comisión. Para un período se usa la fila
 * con la mayor `vigenteDesde` que no sea posterior al primer día del período.
 */
export const tasasAfp = pgTable(
  'tasas_afp',
  {
    afpId: uuid('afp_id')
      .notNull()
      .references(() => afps.id),
    vigenteDesde: date('vigente_desde').notNull(),
    /** Porcentaje, por ejemplo 0.46 para 0,46 %. */
    comision: numeric({ precision: 6, scale: 4, mode: 'number' }).notNull(),
    fuente: text().notNull(),
    registradoEn: timestamp('registrado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.afpId, t.vigenteDesde] })],
);

/** Fonasa e Isapres. Fonasa siempre descuenta el 7 % legal; una Isapre descuenta el mayor entre el 7 % y el plan pactado. */
export const institucionesSalud = pgTable('instituciones_salud', {
  id: uuid().primaryKey().defaultRandom(),
  codigo: text().notNull().unique(),
  nombre: text().notNull(),
  tipo: tipoSaludEnum().notNull(),
});

/** Un tramo del impuesto único de segunda categoría, expresado en UTM. */
export interface TramoImpuesto {
  /** Límite inferior en UTM (exclusivo, salvo el primer tramo). */
  desdeUtm: number;
  /** Límite superior en UTM; null en el último tramo. */
  hastaUtm: number | null;
  /** Factor como porcentaje: 4 para 4 %. */
  factor: number;
  /** Cantidad a rebajar, en UTM. */
  rebajaUtm: number;
}

/**
 * Indicadores previsionales de un mes. Se crean en BORRADOR por la sincronización
 * automática y Personas los CONFIRMA antes de usarlos en liquidaciones.
 * `fuentes` registra de dónde salió cada valor y cuándo se consultó.
 */
export const indicadoresMensuales = pgTable('indicadores_mensuales', {
  /** Período "AAAA-MM". */
  periodo: text().primaryKey(),
  estado: estadoIndicadoresEnum().notNull().default('BORRADOR'),
  /** UF del último día del mes, la que Previred usa para los topes. */
  uf: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull(),
  utm: integer().notNull(),
  /** Ingreso mínimo mensual vigente, base del tope de gratificación. */
  ingresoMinimo: integer('ingreso_minimo').notNull(),
  topeImponibleAfpUf: numeric('tope_imponible_afp_uf', { precision: 6, scale: 2, mode: 'number' }).notNull(),
  topeImponibleCesantiaUf: numeric('tope_imponible_cesantia_uf', { precision: 6, scale: 2, mode: 'number' }).notNull(),
  /** Seguro de invalidez y sobrevivencia, cargo del empleador. */
  tasaSis: numeric('tasa_sis', { precision: 5, scale: 3, mode: 'number' }).notNull(),
  /** Cotización adicional del empleador de la Ley 21.735 (reforma de pensiones). */
  tasaEmpleadorReforma: numeric('tasa_empleador_reforma', { precision: 5, scale: 3, mode: 'number' }).notNull(),
  /** Seguro de accidentes del trabajo: cotización básica + Ley SANNA (+ adicional por riesgo, si aplica). */
  tasaAccidentes: numeric('tasa_accidentes', { precision: 5, scale: 3, mode: 'number' }).notNull(),
  tramosImpuesto: jsonb('tramos_impuesto').$type<TramoImpuesto[]>().notNull(),
  fuentes: jsonb().$type<Record<string, { fuente: string; consultadoEn: string }>>().notNull(),
  confirmadoPor: uuid('confirmado_por').references(() => usuarios.id),
  confirmadoEn: timestamp('confirmado_en', { withTimezone: true }),
  ...auditoria,
});

export type Empresa = typeof empresas.$inferSelect;
export type Sede = typeof sedes.$inferSelect;
export type Trabajador = typeof trabajadores.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Afp = typeof afps.$inferSelect;
export type InstitucionSalud = typeof institucionesSalud.$inferSelect;
export type IndicadoresMensuales = typeof indicadoresMensuales.$inferSelect;
