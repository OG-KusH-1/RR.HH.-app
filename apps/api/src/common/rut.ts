/**
 * Utilidades para el RUT chileno.
 *
 * Formato normalizado que se guarda en la base de datos: "12345678-5"
 * (sin puntos, guion antes del dígito verificador, K en mayúscula).
 */

/** Calcula el dígito verificador con el algoritmo módulo 11. */
export function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/** Devuelve el RUT normalizado, o null si el formato o el dígito verificador no son válidos. */
export function normalizarRut(entrada: string): string | null {
  const limpio = entrada.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (calcularDv(cuerpo) !== dv) return null;
  return `${cuerpo}-${dv}`;
}

/** "12345678-5" → "12.345.678-5", para mostrar. */
export function formatearRut(rut: string): string {
  const [cuerpo, dv] = rut.split('-');
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}
