import { sql } from 'drizzle-orm';
import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
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

export type Empresa = typeof empresas.$inferSelect;
export type Sede = typeof sedes.$inferSelect;
export type Trabajador = typeof trabajadores.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
