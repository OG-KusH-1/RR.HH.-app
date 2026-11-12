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
    const mensaje = cuerpo.mensaje ?? cuerpo.message ?? "No se pudo completar la solicitud.";
    throw new ApiError(res.status, Array.isArray(mensaje) ? mensaje.join(" ") : mensaje);
  }
  return cuerpo as T;
}

export const api = {
  ingresar: (rut: string, clave: string) =>
    solicitar<{ usuario: Usuario }>("/auth/ingresar", { method: "POST", body: JSON.stringify({ rut, clave }) }),
  salir: () => solicitar<void>("/auth/salir", { method: "POST" }),
  yo: () => solicitar<{ usuario: Usuario }>("/auth/yo"),
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
};
