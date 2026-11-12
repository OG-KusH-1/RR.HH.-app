import { obtenerJson, type FuenteIndicadores, type ValorIndicador } from './fuente-indicadores.js';

interface RespuestaMindicador {
  serie?: { fecha: string; valor: number }[];
}

/**
 * mindicador.cl: API pública sin clave que replica datos del Banco Central y del SII.
 * No es una fuente oficial; se usa como respaldo cuando la CMF no está configurada o falla.
 */
export class MindicadorFuente implements FuenteIndicadores {
  readonly nombre = 'mindicador.cl (respaldo)';

  constructor(private readonly obtener: (url: string) => Promise<unknown> = obtenerJson) {}

  private async consultar(indicador: 'uf' | 'utm', fecha: string): Promise<ValorIndicador> {
    const [a, m, d] = fecha.split('-');
    const r = (await this.obtener(`https://mindicador.cl/api/${indicador}/${d}-${m}-${a}`)) as RespuestaMindicador;
    const item = r.serie?.[0];
    if (!item) throw new Error(`mindicador.cl no devolvió ${indicador.toUpperCase()} para ${fecha}`);
    return { valor: item.valor, fecha: item.fecha.slice(0, 10), fuente: this.nombre };
  }

  uf(fecha: string) {
    return this.consultar('uf', fecha);
  }

  utm(periodo: string) {
    return this.consultar('utm', `${periodo}-01`);
  }
}
