"use client";
/**
 * Indicadores previsionales del mes.
 *
 * Personas sincroniza (UF y UTM desde las fuentes externas), revisa contra la
 * tabla de Previred, corrige lo que no tiene API (SIS, tasas de la reforma) y
 * confirma. Gerencia solo consulta. Un mes confirmado queda fijo.
 */
import { useEffect, useState } from "react";
import { Aviso, Cargando } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api, ApiError, type Indicadores } from "@/lib/api";
import { nombrePeriodo, pesos, porcentaje } from "@/lib/formato";

type Campo = { clave: keyof Indicadores; etiqueta: string; formato: (v: number) => string; fuente: string };

const CAMPOS: Campo[] = [
  { clave: "uf", etiqueta: "UF", formato: (v) => `$${v.toLocaleString("es-CL", { minimumFractionDigits: 2 })}`, fuente: "uf" },
  { clave: "utm", etiqueta: "UTM", formato: pesos, fuente: "utm" },
  { clave: "ingresoMinimo", etiqueta: "Ingreso mínimo", formato: pesos, fuente: "ingresoMinimo" },
  { clave: "topeImponibleAfpUf", etiqueta: "Tope imponible AFP y salud", formato: (v) => `${v.toLocaleString("es-CL")} UF`, fuente: "topes" },
  { clave: "topeImponibleCesantiaUf", etiqueta: "Tope imponible cesantía", formato: (v) => `${v.toLocaleString("es-CL")} UF`, fuente: "topes" },
  { clave: "tasaSis", etiqueta: "Seguro de invalidez y sobrevivencia", formato: porcentaje, fuente: "tasaSis" },
  { clave: "tasaEmpleadorReforma", etiqueta: "Cotización empleador, reforma de pensiones", formato: porcentaje, fuente: "tasaEmpleadorReforma" },
  { clave: "tasaAccidentes", etiqueta: "Seguro de accidentes del trabajo", formato: porcentaje, fuente: "tasaAccidentes" },
];

export default function IndicadoresPage() {
  const usuario = useUsuario();
  const puedeGestionar = usuario.rol === "PERSONAS" || usuario.rol === "ADMIN";
  const [meses, setMeses] = useState<Indicadores[] | null>(null);
  const [actual, setActual] = useState<string>("");
  const [elegido, setElegido] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Cambiar `version` vuelve a pedir la lista (después de sincronizar, corregir o confirmar).
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    api
      .indicadores()
      .then((r) => {
        if (!vigente) return;
        setMeses(r.meses);
        setActual(r.periodoActual);
        setElegido((e) => e || r.meses[0]?.periodo || r.periodoActual);
      })
      .catch(() => vigente && setError("No se pudieron cargar los indicadores."));
    return () => {
      vigente = false;
    };
  }, [version]);

  const mes = meses?.find((m) => m.periodo === elegido);

  async function accion(fn: () => Promise<string>) {
    setOcupado(true);
    setAviso(null);
    setError(null);
    try {
      setAviso(await fn());
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  }

  const sincronizar = (periodo: string) =>
    accion(async () => {
      const r = await api.sincronizarIndicadores(periodo);
      setElegido(periodo);
      return r.pendientes.length
        ? `No se pudo consultar ${r.pendientes.join(" ni ")}: se mantuvo el valor anterior. Revísalo antes de confirmar.`
        : "UF y UTM actualizadas desde las fuentes externas.";
    });

  const corregir = (clave: keyof Indicadores, etiqueta: string, valorActual: number) => {
    const texto = window.prompt(`Nuevo valor para ${etiqueta}`, String(valorActual).replace(".", ","));
    if (texto === null) return;
    const valor = Number(texto.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor)) return setError("Ese valor no es un número.");
    void accion(async () => {
      await api.corregirIndicadores(elegido, { [clave]: valor });
      return `${etiqueta} actualizado.`;
    });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl lg:text-3xl font-bold">Indicadores previsionales</h1>
      <p className="mt-2 text-basalto-soft">
        Los valores con que se calculan las liquidaciones de cada mes. UF y UTM se consultan solos; el resto se revisa contra la tabla de Previred.
      </p>

      {error && <div className="mt-6"><Aviso texto={error} /></div>}
      {aviso && <p role="status" className="mt-6 rounded-lg bg-moana-50 px-4 py-3 text-moana-900">{aviso}</p>}
      {!meses && !error && <div className="mt-8"><Cargando /></div>}

      {meses && (
        <>
          <div className="mt-8 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="text-sm text-basalto-soft">Mes</span>
              <select value={elegido} onChange={(e) => setElegido(e.target.value)} className="mt-1 block rounded-lg border-2 border-moana-200 bg-white px-3 py-2 focus:border-moana-800 focus:outline-none">
                {meses.map((m) => (
                  <option key={m.periodo} value={m.periodo}>
                    {nombrePeriodo(m.periodo)}
                  </option>
                ))}
              </select>
            </label>
            {puedeGestionar && !meses.some((m) => m.periodo === actual) && (
              <button disabled={ocupado} onClick={() => sincronizar(actual)} className="rounded-lg bg-moana-800 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
                Preparar {nombrePeriodo(actual)}
              </button>
            )}
          </div>

          {mes && (
            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className={`rounded-full px-3 py-1 text-sm font-semibold ${mes.estado === "CONFIRMADO" ? "bg-moana-50 text-moana-900" : "bg-liquen-soft text-basalto"}`}>
                  {mes.estado === "CONFIRMADO" ? "Confirmado: listo para liquidaciones" : "Borrador: falta revisar y confirmar"}
                </p>
                {puedeGestionar && mes.estado === "BORRADOR" && (
                  <div className="flex gap-3">
                    <button disabled={ocupado} onClick={() => sincronizar(mes.periodo)} className="rounded-lg px-4 py-2.5 font-semibold text-moana-800 hover:bg-moana-50 disabled:opacity-60">
                      Actualizar UF y UTM
                    </button>
                    <button
                      disabled={ocupado}
                      onClick={() => {
                        if (window.confirm(`Al confirmar, los indicadores de ${nombrePeriodo(mes.periodo)} quedan fijos. ¿Los revisaste contra Previred?`)) {
                          void accion(async () => {
                            await api.confirmarIndicadores(mes.periodo);
                            return `Indicadores de ${nombrePeriodo(mes.periodo)} confirmados.`;
                          });
                        }
                      }}
                      className="rounded-lg bg-moana-800 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                  </div>
                )}
              </div>

              <ul className="mt-6 divide-y divide-moana-200 border-y border-moana-200">
                {CAMPOS.map((c) => (
                  <li key={c.clave} className="grid grid-cols-[1fr_auto] gap-x-4 py-3.5">
                    <span>{c.etiqueta}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="font-semibold tabular">{c.formato(mes[c.clave] as number)}</span>
                      {puedeGestionar && mes.estado === "BORRADOR" && (
                        <button onClick={() => corregir(c.clave, c.etiqueta, mes[c.clave] as number)} className="text-sm text-moana-800 underline underline-offset-4">
                          Corregir
                        </button>
                      )}
                    </span>
                    <span className="col-span-2 mt-1 text-sm text-basalto-soft">{mes.fuentes[c.fuente]?.fuente ?? "Sin fuente registrada"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
