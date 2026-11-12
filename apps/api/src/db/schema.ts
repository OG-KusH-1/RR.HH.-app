import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
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
    // --- Contrato y antigüedad ---
    /** Término pactado de un contrato a plazo fijo u obra. Alimenta las alertas de vencimiento (HU-16). */
    fechaTerminoContrato: date('fecha_termino_contrato'),
    fechaDesvinculacion: date('fecha_desvinculacion'),
    /**
     * Años trabajados con empleadores anteriores, acreditados con documento (HU-11).
     * El art. 68 del Código del Trabajo permite hacer valer hasta 10; el tope se aplica en el cálculo, no aquí,
     * para conservar el dato tal como se acreditó.
     */
    aniosPreviosReconocidos: numeric('anios_previos_reconocidos', { precision: 4, scale: 1, mode: 'number' }).notNull().default(0),
    respaldoAniosPrevios: text('respaldo_anios_previos'),
    /** Correo personal opcional, para invitaciones y avisos cuando se active el envío de correos. */
    email: text(),
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
  /** Secreto TOTP del segundo factor, cifrado con AES-256-GCM (ver common/cifrado.ts). Nunca se guarda en claro. */
  totpSecretoCifrado: text('totp_secreto_cifrado'),
  /** Fecha en que el usuario confirmó su primer código; sin ella el segundo factor no está activo. */
  totpActivadoEn: timestamp('totp_activado_en', { withTimezone: true }),
  ...auditoria,
});

/**
 * Invitaciones para crear la primera contraseña (HU-02). Se guarda el SHA-256 del código,
 * no el código: quien lea la base de datos no puede usar una invitación pendiente.
 */
export const invitaciones = pgTable('invitaciones', {
  id: uuid().primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  hashCodigo: text('hash_codigo').notNull().unique(),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  usadaEn: timestamp('usada_en', { withTimezone: true }),
  creadaPor: uuid('creada_por').references(() => usuarios.id),
  creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
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

// ---------------------------------------------------------------------------
// Vacaciones y ausencias (E3)
//
// El saldo de vacaciones NO se guarda como un número que se edita: se calcula.
// Devengado (función pura desde la fecha de ingreso) + movimientos del libro
// `movimientos_vacaciones`. Así cada saldo se puede explicar línea por línea (HU-08)
// y un error se corrige con un movimiento nuevo, nunca sobrescribiendo.
// ---------------------------------------------------------------------------

/** Feriados legales. Cambian por ley cada año, por eso viven en la base de datos con su fuente. */
export const feriados = pgTable('feriados', {
  fecha: date().primaryKey(),
  nombre: text().notNull(),
  /** Irrenunciable para el comercio (Ley 19.973). Lo usará el módulo de turnos. */
  irrenunciable: boolean().notNull().default(false),
  fuente: text().notNull(),
});

/** Tipos de ausencia configurables (HU-12). */
export const tiposAusencia = pgTable('tipos_ausencia', {
  id: uuid().primaryKey().defaultRandom(),
  codigo: text().notNull().unique(),
  nombre: text().notNull(),
  descripcion: text().notNull(),
  /** Descuenta días del saldo de vacaciones. Solo el feriado legal lo hace. */
  afectaSaldo: boolean('afecta_saldo').notNull().default(false),
  conGoce: boolean('con_goce').notNull().default(true),
  /** El detalle (diagnóstico, documento) es dato sensible: solo lo ve Personas y el propio trabajador. */
  sensible: boolean().notNull().default(false),
  /** Sin aprobación queda registrada al informarla (una licencia médica no se "aprueba"). */
  requiereAprobacion: boolean('requiere_aprobacion').notNull().default(true),
  /** Permite fechas pasadas. Las vacaciones no; una licencia sí, porque se informa después de emitida. */
  permiteRetroactivo: boolean('permite_retroactivo').notNull().default(false),
  activo: boolean().notNull().default(true),
});

export const estadoSolicitudEnum = pgEnum('estado_solicitud', ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA']);

export const solicitudesAusencia = pgTable(
  'solicitudes_ausencia',
  {
    id: uuid().primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id),
    trabajadorId: uuid('trabajador_id')
      .notNull()
      .references(() => trabajadores.id),
    tipoId: uuid('tipo_id')
      .notNull()
      .references(() => tiposAusencia.id),
    desde: date().notNull(),
    hasta: date().notNull(),
    /** Días hábiles que consume (lunes a viernes sin feriados, art. 69 CT). Se fija al enviar y se recalcula al aprobar. */
    diasHabiles: integer('dias_habiles').notNull(),
    estado: estadoSolicitudEnum().notNull().default('PENDIENTE'),
    comentario: text(),
    /** Diagnóstico o folio de licencia. Sensible: nunca sale hacia la jefatura ni a la auditoría. */
    detalleReservado: text('detalle_reservado'),
    motivoRechazo: text('motivo_rechazo'),
    creadaPor: uuid('creada_por').references(() => usuarios.id),
    resueltaPor: uuid('resuelta_por').references(() => usuarios.id),
    resueltaEn: timestamp('resuelta_en', { withTimezone: true }),
    ...auditoria,
  },
  (t) => [index('solicitudes_trabajador_idx').on(t.trabajadorId), index('solicitudes_empresa_fechas_idx').on(t.empresaId, t.desde, t.hasta)],
);

export const tipoMovimientoEnum = pgEnum('tipo_movimiento_vacaciones', ['TOMADO_ANTERIOR', 'TOMADO', 'REVERSA', 'AJUSTE']);

/**
 * Libro de movimientos de vacaciones. Solo se inserta.
 * `dias` es negativo cuando consume saldo y positivo cuando lo devuelve o lo aumenta.
 */
export const movimientosVacaciones = pgTable(
  'movimientos_vacaciones',
  {
    id: uuid().primaryKey().defaultRandom(),
    trabajadorId: uuid('trabajador_id')
      .notNull()
      .references(() => trabajadores.id),
    fecha: date().notNull(),
    tipo: tipoMovimientoEnum().notNull(),
    dias: numeric({ precision: 6, scale: 2, mode: 'number' }).notNull(),
    solicitudId: uuid('solicitud_id').references(() => solicitudesAusencia.id),
    motivo: text().notNull(),
    creadoPor: uuid('creado_por').references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('movimientos_trabajador_idx').on(t.trabajadorId)],
);

// ---------------------------------------------------------------------------
// Avisos dentro de la aplicación. El envío por correo o WhatsApp se agrega
// después como otro canal que lee esta misma tabla.
// ---------------------------------------------------------------------------

export const notificaciones = pgTable(
  'notificaciones',
  {
    id: uuid().primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id),
    /** Destinatario. Se usa el trabajador y no el usuario para avisar aunque aún no active su cuenta. */
    trabajadorId: uuid('trabajador_id')
      .notNull()
      .references(() => trabajadores.id),
    tipo: text().notNull(),
    titulo: text().notNull(),
    mensaje: text().notNull(),
    enlace: text(),
    /** Evita duplicados en avisos automáticos, por ejemplo "vence:<doc>:30:<destinatario>". */
    claveUnica: text('clave_unica').unique(),
    leidaEn: timestamp('leida_en', { withTimezone: true }),
    creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notificaciones_destinatario_idx').on(t.trabajadorId, t.leidaEn)],
);

// ---------------------------------------------------------------------------
// Documentos (E4)
// ---------------------------------------------------------------------------

/**
 * Quién ve un documento, además de Personas (que ve todo):
 * - TRABAJADOR: el propio trabajador y Gerencia (contrato, anexos).
 * - INTERNO: Gerencia, no el trabajador (evaluaciones en borrador, cotizaciones).
 * - RESERVADO: solo Personas (licencias, exámenes de salud). La jefatura nunca ve documentos.
 */
export const visibilidadDocumentoEnum = pgEnum('visibilidad_documento', ['TRABAJADOR', 'INTERNO', 'RESERVADO']);

export const tiposDocumento = pgTable('tipos_documento', {
  id: uuid().primaryKey().defaultRandom(),
  codigo: text().notNull().unique(),
  nombre: text().notNull(),
  /** Sugiere pedir fecha de vencimiento al subir (licencia de conducir, examen preocupacional). */
  conVencimiento: boolean('con_vencimiento').notNull().default(false),
  visibilidadPorDefecto: visibilidadDocumentoEnum('visibilidad_por_defecto').notNull().default('TRABAJADOR'),
});

export const documentos = pgTable(
  'documentos',
  {
    id: uuid().primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id),
    trabajadorId: uuid('trabajador_id')
      .notNull()
      .references(() => trabajadores.id),
    tipoId: uuid('tipo_id')
      .notNull()
      .references(() => tiposDocumento.id),
    nombreArchivo: text('nombre_archivo').notNull(),
    /** Tipo detectado por los bytes del archivo, no el que declara el navegador. */
    mime: text().notNull(),
    tamano: integer().notNull(),
    /** Ubicación interna en el almacén. Nunca es una URL pública. */
    claveAlmacen: text('clave_almacen').notNull(),
    /** Huella del archivo original, para demostrar que no se alteró. */
    sha256: text().notNull(),
    venceEl: date('vence_el'),
    visibilidad: visibilidadDocumentoEnum().notNull(),
    notas: text(),
    subidoPor: uuid('subido_por').references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    /** Borrado lógico: el archivo se conserva por los plazos legales de retención. */
    eliminadoEn: timestamp('eliminado_en', { withTimezone: true }),
  },
  (t) => [index('documentos_trabajador_idx').on(t.trabajadorId), index('documentos_vence_idx').on(t.venceEl)],
);

/** Documentos obligatorios por cargo (HU-17). `cargo = '*'` aplica a toda la empresa. */
export const documentosRequeridos = pgTable(
  'documentos_requeridos',
  {
    id: uuid().primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id),
    cargo: text().notNull(),
    tipoId: uuid('tipo_id')
      .notNull()
      .references(() => tiposDocumento.id),
  },
  (t) => [uniqueIndex('requeridos_uq').on(t.empresaId, t.cargo, t.tipoId)],
);

// ---------------------------------------------------------------------------
// Certificados verificables (E5)
// ---------------------------------------------------------------------------

export const certificados = pgTable('certificados', {
  id: uuid().primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id),
  trabajadorId: uuid('trabajador_id')
    .notNull()
    .references(() => trabajadores.id),
  /** Código aleatorio de verificación. Imposible de adivinar: 60 bits de azar. */
  codigo: text().notNull().unique(),
  tipo: text().notNull(),
  /** Copia exacta de lo impreso: si la ficha cambia después, el certificado sigue diciendo lo que dijo. */
  datos: jsonb().$type<Record<string, string>>().notNull(),
  emitidoPor: uuid('emitido_por').references(() => usuarios.id),
  emitidoEn: timestamp('emitido_en', { withTimezone: true }).notNull().defaultNow(),
  revocadoEn: timestamp('revocado_en', { withTimezone: true }),
  motivoRevocacion: text('motivo_revocacion'),
});

// ---------------------------------------------------------------------------
// Solicitudes del titular de datos (HU-06 y HU-20, Ley 21.719)
// ---------------------------------------------------------------------------

export const tipoSolicitudTitularEnum = pgEnum('tipo_solicitud_titular', ['ACCESO', 'RECTIFICACION']);
export const estadoSolicitudTitularEnum = pgEnum('estado_solicitud_titular', ['ABIERTA', 'RESUELTA', 'RECHAZADA']);

export const solicitudesTitular = pgTable('solicitudes_titular', {
  id: uuid().primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id),
  trabajadorId: uuid('trabajador_id')
    .notNull()
    .references(() => trabajadores.id),
  tipo: tipoSolicitudTitularEnum().notNull(),
  detalle: text().notNull(),
  estado: estadoSolicitudTitularEnum().notNull().default('ABIERTA'),
  respuesta: text(),
  resueltaPor: uuid('resuelta_por').references(() => usuarios.id),
  resueltaEn: timestamp('resuelta_en', { withTimezone: true }),
  creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
});

export type Empresa = typeof empresas.$inferSelect;
export type Sede = typeof sedes.$inferSelect;
export type Trabajador = typeof trabajadores.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Afp = typeof afps.$inferSelect;
export type InstitucionSalud = typeof institucionesSalud.$inferSelect;
export type IndicadoresMensuales = typeof indicadoresMensuales.$inferSelect;
export type TipoAusencia = typeof tiposAusencia.$inferSelect;
export type SolicitudAusencia = typeof solicitudesAusencia.$inferSelect;
export type Documento = typeof documentos.$inferSelect;
