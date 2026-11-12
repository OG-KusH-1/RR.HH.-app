export type Rol = "TRABAJADOR" | "JEFATURA" | "PERSONAS" | "GERENCIA" | "ADMIN";

export interface Usuario {
  id: string;
  trabajadorId: string;
  empresaId: string;
  sedeId: string;
  rol: Rol;
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
}

export interface Trabajador {
  id: string;
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  fechaIngreso: string;
  tipoContrato: "INDEFINIDO" | "PLAZO_FIJO" | "OBRA_FAENA";
  horasSemanales: number;
  sede: string;
  sedeId: string;
  zonaHoraria: string;
  jefaturaId: string | null;
  telefono?: string | null;
  email?: string | null;
  fechaTerminoContrato?: string | null;
  rol?: Rol;
  cuentaActiva?: boolean;
  afpId?: string | null;
  afp?: string | null;
  saludId?: string | null;
  salud?: string | null;
  saludTipo?: "FONASA" | "ISAPRE" | null;
  planIsapreUf?: number | null;
  sueldoBase?: number | null;
  puedeVerRemuneracion?: boolean;
}

export interface OpcionAfp {
  id: string;
  codigo: string;
  nombre: string;
  comision: number | null;
  vigenteDesde: string | null;
  fuente: string | null;
}

export interface OpcionSalud {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "FONASA" | "ISAPRE";
}

export interface Indicadores {
  periodo: string;
  estado: "BORRADOR" | "CONFIRMADO";
  uf: number;
  utm: number;
  ingresoMinimo: number;
  topeImponibleAfpUf: number;
  topeImponibleCesantiaUf: number;
  tasaSis: number;
  tasaEmpleadorReforma: number;
  tasaAccidentes: number;
  fuentes: Record<string, { fuente: string; consultadoEn: string }>;
  confirmadoEn: string | null;
}

export interface Linea {
  codigo: string;
  concepto: string;
  monto: number;
  detalle: string;
}

export interface RespuestaLiquidacion {
  trabajador: { id: string; nombres: string; apellidos: string };
  liquidacion: {
    periodo: string;
    haberes: Linea[];
    descuentos: Linea[];
    aportesEmpleador: Linea[];
    totales: { imponible: number; noImponible: number; tributable: number; descuentos: number; liquido: number; aportesEmpleador: number; costoEmpresa: number };
  };
  limitaciones: string[];
  indicadores: { periodo: string; uf: number; utm: number; confirmadoEn: string | null };
}

export interface ResumenSede {
  sedeId: string;
  sede: string;
  ciudad: string;
  zonaHoraria: string;
  dotacion: number;
}

// ---------------------------------------------------------------- ausencias

export type EstadoSolicitud = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA";

export interface TipoAusencia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  afectaSaldo: boolean;
  sensible: boolean;
  requiereAprobacion: boolean;
  permiteRetroactivo: boolean;
}

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: "TOMADO_ANTERIOR" | "TOMADO" | "REVERSA" | "AJUSTE";
  dias: number;
  motivo: string;
  solicitudId: string | null;
}

export interface Saldo {
  trabajador: { id: string; nombres: string; apellidos: string; fechaIngreso: string; aniosPrevios: number };
  hoy: string;
  mesesServicio: number;
  aniosServicio: number;
  diasProgresivosAnuales: number;
  derechoAnual: number;
  devengado: number;
  movimientos: number;
  saldo: number;
  disponible: number;
  cumpleAnioEl: string | null;
  excedeAcumulacion: boolean;
  diasEnSolicitudesPendientes: number;
  movimientosDetalle: Movimiento[];
}

export interface SolicitudLista {
  id: string;
  trabajadorId: string;
  nombres: string;
  apellidos: string;
  sede: string;
  tipo: string;
  tipoCodigo: string;
  desde: string;
  hasta: string;
  diasHabiles: number;
  estado: EstadoSolicitud;
  creadoEn: string;
}

export interface Coincidencia {
  nombres: string;
  apellidos: string;
  tipo: string;
  desde: string;
  hasta: string;
  estado: EstadoSolicitud;
}

export interface SolicitudDetalle {
  id: string;
  desde: string;
  hasta: string;
  diasHabiles: number;
  estado: EstadoSolicitud;
  comentario: string | null;
  detalleReservado?: string | null;
  tieneDetalleReservado: boolean;
  motivoRechazo: string | null;
  resueltaEn: string | null;
  resueltaPorNombre: string | null;
  creadoEn: string;
  tipo: { codigo: string; nombre: string; afectaSaldo: boolean; sensible: boolean }
  trabajador: { id: string; nombres: string; apellidos: string; sede: string }
  puedeResolver: boolean;
  puedeCancelar: boolean;
  saldoDisponible: number | null;
  coincidencias: Coincidencia[];
  tamanoEquipo: number;
}

export interface Previsualizacion {
  diasHabiles: number;
  diasCorridos: number;
  problemas: string[];
  disponible: number;
  tipo: { codigo: string; nombre: string; afectaSaldo: boolean }
}

export interface AusenciaCalendario {
  id: string;
  trabajadorId: string;
  nombres: string;
  apellidos: string;
  sede: string;
  tipo: string;
  tipoCodigo: string;
  desde: string;
  hasta: string;
  estado: EstadoSolicitud;
}

export interface Calendario {
  mes: string;
  desde: string;
  hasta: string;
  ausencias: AusenciaCalendario[];
  feriados: { fecha: string; nombre: string; irrenunciable: boolean }[];
  sedes: { id: string; nombre: string; zonaHoraria: string }[];
  hoy: string;
}

export interface SaldoEquipo {
  id: string;
  nombres: string;
  apellidos: string;
  sede: string;
  saldo: number;
  disponible: number;
  derechoAnual: number;
  excedeAcumulacion: boolean;
}

export interface AvisoApp {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leidaEn: string | null;
  creadaEn: string;
}

export interface DatosSolicitud {
  tipoCodigo: string;
  desde: string;
  hasta: string;
  comentario?: string;
  detalleReservado?: string;
  trabajadorId?: string;
}

// ---------------------------------------------------------------- documentos

export type Visibilidad = "TRABAJADOR" | "INTERNO" | "RESERVADO";

export interface TipoDocumento {
  id: string;
  codigo: string;
  nombre: string;
  conVencimiento: boolean;
  visibilidadPorDefecto: Visibilidad;
}

export interface DocumentoItem {
  id: string;
  nombreArchivo: string;
  mime: string;
  tamano: number;
  venceEl: string | null;
  visibilidad: Visibilidad;
  notas: string | null;
  creadoEn: string;
  tipo: string;
  tipoCodigo: string;
}

export interface CarpetaDocumentos {
  trabajador: { id: string; nombres: string; apellidos: string };
  documentos: DocumentoItem[];
  puedeSubir: boolean;
}

export interface Vencimiento {
  clase: "DOCUMENTO" | "CONTRATO";
  id: string;
  trabajadorId: string;
  nombres: string;
  apellidos: string;
  sede: string;
  que: string;
  vence: string;
  diasRestantes: number;
  requiereDecision: boolean;
}

export interface ReporteFaltantes {
  sedes: { sede: string; personas: number; incompletas: number }[];
  personas: { id: string; nombres: string; apellidos: string; cargo: string; sede: string; faltan: string[] }[];
  totalRequisitos: number;
  totalPersonas: number;
}

export interface Requisito {
  id: string;
  cargo: string;
  tipoId: string;
  tipo: string;
}

export interface DatosSubida {
  trabajadorId: string;
  tipoId: string;
  nombreArchivo: string;
  contenidoBase64: string;
  venceEl?: string | null;
  visibilidad?: Visibilidad;
  notas?: string;
}

// ---------------------------------------------------------------- certificados y panel

export interface Certificado {
  id: string;
  codigo: string;
  tipo: string;
  emitidoEn: string;
  revocadoEn: string | null;
}

export type Verificacion =
  | { valido: false }
  | { valido: true; revocado: boolean; codigo: string; tipo: string; empresa: string; nombre: string; rut: string; cargo: string; fechaIngreso: string; tipoContrato: string; emitido: string };

export interface Panel {
  periodo: string;
  hoy: string;
  totales: { dotacion: number; ausentesHoy: number; diasAusenciaMes: number; vacacionesAcumuladas: number };
  porSede: { sedeId: string; sede: string; dotacion: number; indefinidos: number; plazoFijo: number; ausentesHoy: number; diasAusenciaMes: number; vacacionesAcumuladas: number }[];
  ausenciasPorTipo: { tipo: string; dias: number }[];
  alertas: {
    solicitudesPendientes: number;
    pendientesAtrasadas: number;
    vencimientos30Dias: number;
    vencidos: number;
    contratosPorDecidir: number;
    carpetasIncompletas: number;
    acumulanMasDeDosPeriodos: number;
    solicitudesDatosAbiertas: number;
  };
}

// ---------------------------------------------------------------- cuenta, fichas y privacidad

export interface EstadoSegundoFactor {
  activo: boolean;
  obligatorio: boolean;
}

export interface DatosFicha {
  rut: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  sedeId: string;
  jefaturaId?: string | null;
  fechaIngreso: string;
  tipoContrato: "INDEFINIDO" | "PLAZO_FIJO" | "OBRA_FAENA";
  fechaTerminoContrato?: string | null;
  horasSemanales: number;
  telefono?: string | null;
  email?: string | null;
  rol?: Rol;
}

export interface OpcionesFicha {
  sedes: { id: string; nombre: string }[];
  jefaturas: { id: string; nombres: string; apellidos: string; cargo: string; rol: Rol }[];
}

export interface ResultadoImportacion {
  cargados: number;
  validas: number;
  errores: { fila: number; mensaje: string }[];
  vista: { fila: number; rut: string; nombre: string; cargo: string; sede: string; tipoContrato: string; saldoVacaciones: number | null }[];
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
  ip: string | null;
  actorNombres: string | null;
  actorApellidos: string | null;
  actorRol: Rol | null;
}

export interface SolicitudTitular {
  s: { id: string; tipo: "ACCESO" | "RECTIFICACION"; detalle: string; estado: "ABIERTA" | "RESUELTA" | "RECHAZADA"; respuesta: string | null; creadaEn: string; resueltaEn: string | null };
  nombres: string;
  apellidos: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function solicitar<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${ruta}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mensaje = cuerpo.mensaje ?? cuerpo.message?.mensaje ?? cuerpo.message ?? "No se pudo completar la solicitud.";
    throw new ApiError(res.status, Array.isArray(mensaje) ? mensaje.join(" ") : mensaje);
  }
  return cuerpo as T;
}

export const api = {
  ingresar: (rut: string, clave: string, codigo?: string) =>
    solicitar<{ usuario?: Usuario; requiereCodigo?: boolean }>("/auth/ingresar", { method: "POST", body: JSON.stringify({ rut, clave, codigo }) }),
  salir: () => solicitar<void>("/auth/salir", { method: "POST" }),
  yo: () => solicitar<{ usuario: Usuario; segundoFactor: EstadoSegundoFactor }>("/auth/yo"),
  trabajadores: () => solicitar<Trabajador[]>("/trabajadores"),
  trabajador: (id: string) => solicitar<Trabajador>(`/trabajadores/${id}`),
  resumen: () => solicitar<ResumenSede[]>("/trabajadores/resumen"),
  opcionesPrevision: () => solicitar<{ afps: OpcionAfp[]; salud: OpcionSalud[] }>("/previsional/opciones"),
  actualizarPrevision: (id: string, datos: { afpId?: string | null; saludId?: string | null; planIsapreUf?: number | null; sueldoBase?: number | null }) =>
    solicitar<{ ok: true }>(`/trabajadores/${id}/prevision`, { method: "PATCH", body: JSON.stringify(datos) }),
  indicadores: () => solicitar<{ periodoActual: string; meses: Indicadores[] }>("/previsional/indicadores"),
  sincronizarIndicadores: (periodo: string) =>
    solicitar<{ indicadores: Indicadores; pendientes: string[] }>(`/previsional/indicadores/${periodo}/sincronizar`, { method: "POST" }),
  corregirIndicadores: (periodo: string, cambios: Partial<Indicadores>) =>
    solicitar<Indicadores>(`/previsional/indicadores/${periodo}`, { method: "PATCH", body: JSON.stringify(cambios) }),
  confirmarIndicadores: (periodo: string) => solicitar<Indicadores>(`/previsional/indicadores/${periodo}/confirmar`, { method: "POST" }),
  liquidacion: (id: string, params: Record<string, string | number>) =>
    solicitar<RespuestaLiquidacion>(`/trabajadores/${id}/liquidacion?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`),
  // Ausencias
  tiposAusencia: () => solicitar<TipoAusencia[]>("/ausencias/tipos"),
  miSaldo: () => solicitar<Saldo>("/ausencias/saldo"),
  saldoDe: (id: string) => solicitar<Saldo>(`/ausencias/saldo/${id}`),
  saldosEquipo: () => solicitar<SaldoEquipo[]>("/ausencias/saldos"),
  previsualizar: (d: DatosSolicitud) => solicitar<Previsualizacion>("/ausencias/previsualizar", { method: "POST", body: JSON.stringify(d) }),
  solicitar: (d: DatosSolicitud) => solicitar<{ id: string }>("/ausencias/solicitudes", { method: "POST", body: JSON.stringify(d) }),
  solicitudes: (ambito: "mias" | "equipo" | "todas", estado?: EstadoSolicitud) =>
    solicitar<SolicitudLista[]>(`/ausencias/solicitudes?ambito=${ambito}${estado ? `&estado=${estado}` : ""}`),
  solicitud: (id: string) => solicitar<SolicitudDetalle>(`/ausencias/solicitudes/${id}`),
  aprobar: (id: string) => solicitar<{ ok: true }>(`/ausencias/solicitudes/${id}/aprobar`, { method: "POST" }),
  rechazar: (id: string, motivo: string) => solicitar<{ ok: true }>(`/ausencias/solicitudes/${id}/rechazar`, { method: "POST", body: JSON.stringify({ motivo }) }),
  cancelar: (id: string) => solicitar<{ ok: true }>(`/ausencias/solicitudes/${id}/cancelar`, { method: "POST" }),
  calendario: (mes: string, sedeId?: string) => solicitar<Calendario>(`/ausencias/calendario?mes=${mes}${sedeId ? `&sedeId=${sedeId}` : ""}`),
  ajustarSaldo: (id: string, dias: number, motivo: string) => solicitar<Saldo>(`/ausencias/saldo/${id}/ajustes`, { method: "POST", body: JSON.stringify({ dias, motivo }) }),
  aniosPrevios: (id: string, anios: number, respaldo: string) => solicitar<Saldo>(`/trabajadores/${id}/anios-previos`, { method: "PATCH", body: JSON.stringify({ anios, respaldo }) }),
  // Avisos
  avisos: () => solicitar<AvisoApp[]>("/avisos"),
  avisosNoLeidos: () => solicitar<{ total: number }>("/avisos/no-leidos"),
  leerAviso: (id: string) => solicitar<void>(`/avisos/${id}/leer`, { method: "POST" }),
  leerTodos: () => solicitar<void>("/avisos/leer-todos", { method: "POST" }),
  // Documentos
  tiposDocumento: () => solicitar<TipoDocumento[]>("/documentos/tipos"),
  misDocumentos: () => solicitar<CarpetaDocumentos>("/documentos/mios"),
  documentosDe: (id: string) => solicitar<CarpetaDocumentos>(`/documentos/trabajador/${id}`),
  subirDocumento: (d: DatosSubida) => solicitar<DocumentoItem>("/documentos", { method: "POST", body: JSON.stringify(d) }),
  enlaceDocumento: (id: string) => solicitar<{ url: string; expiraEnMinutos: number }>(`/documentos/${id}/enlace`, { method: "POST" }),
  eliminarDocumento: (id: string, motivo: string) => solicitar<void>(`/documentos/${id}`, { method: "DELETE", body: JSON.stringify({ motivo }) }),
  vencimientos: (dias = 60) => solicitar<{ hoy: string; dias: number; items: Vencimiento[] }>(`/documentos/vencimientos?dias=${dias}`),
  revisarVencimientos: () => solicitar<{ avisosCreados: number }>("/documentos/vencimientos/revisar", { method: "POST" }),
  faltantes: () => solicitar<ReporteFaltantes>("/documentos/faltantes"),
  requisitos: () => solicitar<Requisito[]>("/documentos/requeridos"),
  agregarRequisito: (cargo: string, tipoId: string) => solicitar<void>("/documentos/requeridos", { method: "POST", body: JSON.stringify({ cargo, tipoId }) }),
  quitarRequisito: (id: string) => solicitar<void>(`/documentos/requeridos/${id}`, { method: "DELETE" }),
  // Certificados y panel
  emitirCertificado: (trabajadorId?: string) => solicitar<Certificado>("/certificados", { method: "POST", body: JSON.stringify({ trabajadorId }) }),
  misCertificados: () => solicitar<Certificado[]>("/certificados/mios"),
  verificarCertificado: (codigo: string) => solicitar<Verificacion>(`/certificados/verificar/${encodeURIComponent(codigo)}`),
  panel: (mes?: string) => solicitar<Panel>(`/panel${mes ? `?mes=${mes}` : ""}`),
  // Cuenta
  activar: (rut: string, codigo: string, clave: string) => solicitar<{ ok: true }>("/auth/activar", { method: "POST", body: JSON.stringify({ rut, codigo, clave }) }),
  cambiarClave: (actual: string, nueva: string) => solicitar<{ ok: true }>("/auth/clave", { method: "POST", body: JSON.stringify({ actual, nueva }) }),
  iniciar2fa: () => solicitar<{ secreto: string; uri: string; qr: string }>("/auth/2fa/iniciar", { method: "POST" }),
  confirmar2fa: (codigo: string) => solicitar<{ ok: true }>("/auth/2fa/confirmar", { method: "POST", body: JSON.stringify({ codigo }) }),
  // Fichas
  opcionesFicha: () => solicitar<OpcionesFicha>("/trabajadores/opciones-ficha"),
  crearFicha: (d: DatosFicha) => solicitar<{ id: string }>("/trabajadores", { method: "POST", body: JSON.stringify(d) }),
  editarFicha: (id: string, d: Partial<DatosFicha>) => solicitar<{ ok: true; camposCambiados: string[] }>(`/trabajadores/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
  desvincular: (id: string, fecha: string, motivo: string) =>
    solicitar<{ ok: true; saldoVacacionesAlTermino: number; nota: string }>(`/trabajadores/${id}/desvincular`, { method: "POST", body: JSON.stringify({ fecha, motivo }) }),
  invitar: (id: string) => solicitar<{ codigo: string; expiraEn: string; enlace: string; mensaje: string }>(`/trabajadores/${id}/invitacion`, { method: "POST" }),
  restablecer2fa: (id: string) => solicitar<void>(`/trabajadores/${id}/restablecer-2fa`, { method: "POST" }),
  importar: (contenido: string, confirmar: boolean) => solicitar<ResultadoImportacion>("/trabajadores/importar", { method: "POST", body: JSON.stringify({ contenido, confirmar }) }),
  // Auditoría y privacidad
  auditoria: (f: Record<string, string>) => solicitar<{ registros: RegistroAuditoria[]; hayMas: boolean; pagina: number; acciones: string[] }>(`/auditoria?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`),
  misDatos: () => solicitar<Record<string, unknown>>("/privacidad/mis-datos"),
  misSolicitudesDatos: () => solicitar<SolicitudTitular[]>("/privacidad/solicitudes"),
  todasSolicitudesDatos: () => solicitar<SolicitudTitular[]>("/privacidad/solicitudes/todas"),
  solicitarDatos: (tipo: "ACCESO" | "RECTIFICACION", detalle: string) => solicitar<{ id: string }>("/privacidad/solicitudes", { method: "POST", body: JSON.stringify({ tipo, detalle }) }),
  responderDatos: (id: string, estado: "RESUELTA" | "RECHAZADA", respuesta: string) => solicitar<void>(`/privacidad/solicitudes/${id}/responder`, { method: "POST", body: JSON.stringify({ estado, respuesta }) }),
};
