export function formatearRut(rut: string): string {
  const [cuerpo, dv] = rut.split("-");
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

/** Formatea mientras se escribe: "124032881" → "12.403.288-1". */
export function formatearRutParcial(entrada: string): string {
  const limpio = entrada.replace(/[^\dkK]/g, "").toUpperCase().slice(0, 9);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${limpio.slice(-1)}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2019-03-14" → "14 de marzo de 2019" sin pasar por zonas horarias. */
export function formatearFecha(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function antiguedad(fecha: string, hoy = new Date()): string {
  const [a, m, d] = fecha.split("-").map(Number);
  let anios = hoy.getFullYear() - a;
  let meses = hoy.getMonth() + 1 - m;
  if (hoy.getDate() < d) meses--;
  if (meses < 0) {
    anios--;
    meses += 12;
  }
  const partes = [];
  if (anios > 0) partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  return partes.length ? partes.join(" y ") : "Menos de un mes";
}

export const CONTRATO: Record<string, string> = {
  INDEFINIDO: "Indefinido",
  PLAZO_FIJO: "Plazo fijo",
  OBRA_FAENA: "Por obra o faena",
};

export const ROL: Record<string, string> = {
  TRABAJADOR: "Trabajador",
  JEFATURA: "Jefatura",
  PERSONAS: "Personas",
  GERENCIA: "Gerencia",
  ADMIN: "Administración del sistema",
};

export function horaEn(zona: string, fecha: Date): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(fecha);
}

export function saludo(zona: string, fecha: Date): string {
  const h = Number(new Intl.DateTimeFormat("es-CL", { timeZone: zona, hour: "numeric", hourCycle: "h23" }).format(fecha));
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Diferencia en horas entre dos zonas en un instante (cambia con el horario de verano). */
export function diferenciaHoras(zonaA: string, zonaB: string, fecha: Date): number {
  const offset = (zona: string) => {
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "shortOffset" }).formatToParts(fecha);
    const texto = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = texto.match(/GMT([+-]\d+)(?::(\d+))?/);
    return m ? Number(m[1]) + (Number(m[2] ?? 0) / 60) * Math.sign(Number(m[1])) : 0;
  };
  return offset(zonaB) - offset(zonaA);
}
