import { obtenerJson, parsearNumeroChileno, type FuenteIndicadores, type ValorIndicador } from './fuente-indicadores.js';

const BASE = 'https://api.cmfchile.cl/api-sbifv3/recursos_api';

interface RespuestaCmf {
  UFs?: { Valor: string; Fecha: string }[];
  UTMs?: { Valor: string; Fecha: string }[];
}

/**
 * Comisión para el Mercado Financiero (CMF): fuente oficial de UF y UTM.
 * Requiere una API key gratuita (variable CMF_API_KEY), que se solicita en el sitio de la CMF.
 */
export class CmfFuente implements FuenteIndicadores {
  readonly nombre = 'CMF (api.cmfchile.cl)';

  constructor(
    private readonly apiKey: string,
    private readonly obtener: (url: string) => Promise<unknown> = obtenerJson,
  ) {}

  async uf(fecha: string): Promise<ValorIndicador> {
    const [a, m, d] = fecha.split('-');
    const r = (await this.obtener(`${BASE}/uf/${a}/${m}/dias/${d}?apikey=${this.apiKey}&formato=json`)) as RespuestaCmf;
    const item = r.UFs?.[0];
    if (!item) throw new Error(`La CMF no devolvió UF para ${fecha}`);
    return { valor: parsearNumeroChileno(item.Valor), fecha: item.Fecha, fuente: this.nombre };
  }

  async utm(periodo: string): Promise<ValorIndicador> {
    const [a, m] = periodo.split('-');
    const r = (await this.obtener(`${BASE}/utm/${a}/${m}?apikey=${this.apiKey}&formato=json`)) as RespuestaCmf;
    const item = r.UTMs?.[0];
    if (!item) throw new Error(`La CMF no devolvió UTM para ${periodo}`);
    return { valor: parsearNumeroChileno(item.Valor), fecha: item.Fecha, fuente: this.nombre };
  }
}
