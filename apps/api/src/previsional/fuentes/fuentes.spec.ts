/** Las fuentes se prueban con respuestas grabadas: las pruebas no dependen de internet. */
import { CmfFuente } from './cmf.fuente.js';
import { parsearNumeroChileno } from './fuente-indicadores.js';
import { MindicadorFuente } from './mindicador.fuente.js';

describe('Fuentes de indicadores', () => {
  it('interpreta números en formato chileno', () => {
    expect(parsearNumeroChileno('41.274,20')).toBe(41274.2);
    expect(parsearNumeroChileno('72.440')).toBe(72440);
    expect(() => parsearNumeroChileno('abc')).toThrow();
  });

  it('CMF: arma la URL y lee UF y UTM', async () => {
    const urls: string[] = [];
    const cmf = new CmfFuente('CLAVE', async (url) => {
      urls.push(url);
      return url.includes('/uf/') ? { UFs: [{ Valor: '41.274,20', Fecha: '2026-11-05' }] } : { UTMs: [{ Valor: '72.440', Fecha: '2026-11-01' }] };
    });
    expect((await cmf.uf('2026-11-05')).valor).toBe(41274.2);
    expect((await cmf.utm('2026-11')).valor).toBe(72440);
    expect(urls[0]).toContain('/uf/2026/11/dias/05?apikey=CLAVE&formato=json');
    expect(urls[1]).toContain('/utm/2026/11?apikey=CLAVE');
  });

  it('CMF: falla con un mensaje claro si no hay datos', async () => {
    const cmf = new CmfFuente('CLAVE', async () => ({}));
    await expect(cmf.uf('2026-11-05')).rejects.toThrow('La CMF no devolvió UF');
  });

  it('mindicador: usa el formato de fecha DD-MM-AAAA', async () => {
    let url = '';
    const m = new MindicadorFuente(async (u) => {
      url = u;
      return { serie: [{ fecha: '2026-11-01T03:00:00.000Z', valor: 72440 }] };
    });
    const r = await m.utm('2026-11');
    expect(url).toBe('https://mindicador.cl/api/utm/01-11-2026');
    expect(r).toEqual({ valor: 72440, fecha: '2026-11-01', fuente: 'mindicador.cl (respaldo)' });
  });
});
