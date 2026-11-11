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
};
