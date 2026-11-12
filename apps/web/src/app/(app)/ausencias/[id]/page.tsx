"use client";
/**
 * Detalle de una solicitud. La jefatura decide aquí viendo quién más falta esos días (HU-10).
 * Los botones aparecen según `puedeResolver` y `puedeCancelar`, que calcula la API:
 * la interfaz no decide permisos.
 */
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EstadoChip } from "@/components/ausencias";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api, ApiError } from "@/lib/api";
import { dias, rangoFechas } from "@/lib/formato";

export default function SolicitudPage() {
  const { id } = useParams<{ id: string }>();
  const enviada = useSearchParams().get("enviada");
  const [version, setVersion] = useState(0);
  const { datos: s, error } = useDatos(() => api.solicitud(id), [id, version]);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<unknown>) {
    setFallo(null);
    setOcupado(true);
    try {
      await fn();
      setRechazando(false);
      setVersion((v) => v + 1);
    } catch (e) {
      setFallo(e instanceof ApiError ? e.message : "No se pudo completar. Revisa tu conexión.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/vacaciones" className="text-moana-800 underline underline-offset-4">
        Volver
      </Link>
      {error && <div className="mt-6"><Aviso texto={error} /></div>}
      {!s && !error && <div className="mt-6"><Cargando /></div>}
      {s && (
        <>
          {enviada && version === 0 && (
            <p role="status" className="mt-6 rounded-lg bg-moana-50 px-4 py-3 text-moana-900">
              {s.estado === "PENDIENTE" ? "Solicitud enviada. Tu jefatura recibió un aviso." : "Ausencia registrada. Personas recibió un aviso."}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold">{s.tipo.nombre}</h1>
            <EstadoChip estado={s.estado} />
          </div>
          <p className="mt-2 text-lg">
            {s.trabajador.nombres} {s.trabajador.apellidos} <span className="text-basalto-soft">· {s.trabajador.sede}</span>
          </p>

          <dl className="mt-8 divide-y divide-moana-200 border-y border-moana-200">
            <Fila k="Fechas" v={rangoFechas(s.desde, s.hasta)} />
            {s.tipo.afectaSaldo && <Fila k="Días hábiles" v={dias(s.diasHabiles)} />}
            {s.saldoDisponible !== null && <Fila k="Saldo disponible hoy" v={dias(s.saldoDisponible)} />}
            {s.comentario && <Fila k="Comentario" v={s.comentario} />}
            {s.detalleReservado && <Fila k="Detalle reservado" v={s.detalleReservado} />}
            {!s.detalleReservado && s.tieneDetalleReservado && <Fila k="Detalle reservado" v="Solo lo ve Personas." />}
            {s.resueltaPorNombre && <Fila k={s.estado === "RECHAZADA" ? "Rechazada por" : "Resuelta por"} v={s.resueltaPorNombre} />}
            {s.motivoRechazo && <Fila k="Motivo" v={s.motivoRechazo} />}
          </dl>

          {(s.puedeResolver || s.estado === "PENDIENTE") && (
            <section aria-labelledby="t-equipo" className="mt-10">
              <h2 id="t-equipo" className="text-xl font-bold">
                Quién más falta esos días
              </h2>
              {s.coincidencias.length === 0 ? (
                <p className="mt-3 text-basalto-soft">Nadie más del equipo tiene ausencias en esas fechas.</p>
              ) : (
                <>
                  <p className="mt-3 text-basalto-soft">
                    {s.coincidencias.length} de {s.tamanoEquipo} personas del equipo estarán ausentes en parte de ese período.
                  </p>
                  <ul className="mt-4 divide-y divide-moana-200 border-y border-moana-200">
                    {s.coincidencias.map((c, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-2 py-3">
                        <span>
                          <span className="font-semibold">
                            {c.nombres} {c.apellidos.split(" ")[0]}
                          </span>
                          <span className="block text-basalto-soft">
                            {c.tipo}, {rangoFechas(c.desde, c.hasta)}
                          </span>
                        </span>
                        <EstadoChip estado={c.estado} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {fallo && <p role="alert" className="mt-6 rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{fallo}</p>}

          {s.puedeResolver && !rechazando && (
            <div className="mt-10 flex flex-wrap gap-3">
              <button disabled={ocupado} onClick={() => accion(() => api.aprobar(s.id))} className="rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white hover:bg-moana-900 disabled:opacity-50">
                Aprobar
              </button>
              <button disabled={ocupado} onClick={() => setRechazando(true)} className="rounded-lg border border-toromiro px-6 py-3 font-semibold text-toromiro hover:bg-toromiro-soft">
                Rechazar
              </button>
            </div>
          )}

          {rechazando && (
            <form
              className="mt-10 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                accion(() => api.rechazar(s.id, motivo));
              }}
            >
              <label htmlFor="motivo" className="block font-semibold">
                Motivo del rechazo <span className="font-normal text-basalto-soft">(lo verá {s.trabajador.nombres})</span>
              </label>
              <textarea id="motivo" required minLength={5} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-lg border border-moana-200 bg-white px-4 py-3" />
              <div className="flex gap-3">
                <button disabled={ocupado} className="rounded-lg bg-toromiro px-6 py-3 font-semibold text-white disabled:opacity-50">
                  Rechazar solicitud
                </button>
                <button type="button" onClick={() => setRechazando(false)} className="px-4 py-3 text-basalto-soft underline underline-offset-4">
                  Volver
                </button>
              </div>
            </form>
          )}

          {s.puedeCancelar && (
            <button disabled={ocupado} onClick={() => accion(() => api.cancelar(s.id))} className="mt-10 text-toromiro underline underline-offset-4">
              Cancelar esta solicitud
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4 py-3.5">
      <dt className="text-basalto-soft">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}
