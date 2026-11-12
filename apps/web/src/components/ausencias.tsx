"use client";
/**
 * Piezas de vacaciones y ausencias reutilizadas por las páginas Vacaciones, Aprobaciones y la ficha.
 *
 * El formulario pide a la API una vista previa cada vez que cambian las fechas: así los días
 * hábiles, feriados y saldo se calculan con las mismas reglas que al guardar, y la persona ve
 * el problema antes de enviar (HU-09). La interfaz nunca calcula días por su cuenta.
 */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type DatosSolicitud, type Previsualizacion, type Saldo, type SolicitudLista, type TipoAusencia } from "@/lib/api";
import { dias, ESTADO_SOLICITUD, formatearFecha, rangoFechas } from "@/lib/formato";

export function EstadoChip({ estado }: { estado: string }) {
  const e = ESTADO_SOLICITUD[estado];
  return <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${e.clase}`}>{e.texto}</span>;
}

const MOVIMIENTO: Record<string, string> = {
  TOMADO_ANTERIOR: "Tomados antes de Tangata",
  TOMADO: "Vacaciones tomadas",
  REVERSA: "Devolución por cancelación",
  AJUSTE: "Ajuste de Personas",
};

/** Saldo con su explicación: devengado menos movimientos (HU-08). */
export function ResumenSaldo({ s, titulo = "Tu saldo" }: { s: Saldo; titulo?: string }) {
  const [verDetalle, setVerDetalle] = useState(false);
  return (
    <section aria-labelledby="t-saldo" className="rounded-2xl bg-moana-800 p-6 lg:p-8 text-white">
      <h2 id="t-saldo" className="text-lg text-moana-200">
        {titulo}
      </h2>
      <p className="mt-1 text-3xl lg:text-display font-bold tabular leading-none">{dias(s.disponible)}</p>
      <p className="mt-3 text-moana-200">
        disponibles para pedir
        {s.diasEnSolicitudesPendientes > 0 && <>, {dias(s.diasEnSolicitudesPendientes)} en solicitudes pendientes</>}
      </p>
      {s.cumpleAnioEl && (
        <p className="mt-4 rounded-lg bg-moana-900 px-4 py-3">
          Cumples tu primer año el {formatearFecha(s.cumpleAnioEl)}. Desde ese día puedes usar lo acumulado ({dias(s.devengado)} a la fecha).
        </p>
      )}
      {s.excedeAcumulacion && (
        <p className="mt-4 rounded-lg bg-liquen-soft px-4 py-3 text-basalto">
          Hay más de dos períodos acumulados. La ley permite acumular hasta dos: conviene planificar vacaciones pronto.
        </p>
      )}
      <button onClick={() => setVerDetalle((v) => !v)} aria-expanded={verDetalle} className="mt-6 text-moana-200 underline underline-offset-4 hover:text-white">
        {verDetalle ? "Ocultar cómo se calcula" : "Ver cómo se calcula"}
      </button>
      {verDetalle && (
        <div className="mt-4 rounded-xl bg-white p-5 text-basalto">
          <dl className="divide-y divide-moana-200">
            <FilaSaldo etiqueta={`Ganados en ${s.mesesServicio} meses de servicio`} valor={`+${dias(s.devengado)}`} />
            {s.movimientosDetalle.map((m) => (
              <FilaSaldo key={m.id} etiqueta={`${MOVIMIENTO[m.tipo]}: ${m.motivo}`} valor={`${m.dias > 0 ? "+" : ""}${dias(m.dias)}`} />
            ))}
            <FilaSaldo etiqueta="Saldo" valor={dias(s.saldo)} fuerte />
          </dl>
          <p className="mt-4 text-sm text-basalto-soft">
            Se ganan {dias(s.derechoAnual)} hábiles por año ({s.derechoAnual > 15 ? `15 legales + ${s.diasProgresivosAnuales} de feriado progresivo` : "feriado legal"}), a razón de un doceavo por mes completo. Sábados, domingos y feriados no se descuentan.
          </p>
        </div>
      )}
    </section>
  );
}

function FilaSaldo({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-2.5 ${fuerte ? "font-bold" : ""}`}>
      <dt>{etiqueta}</dt>
      <dd className="tabular whitespace-nowrap">{valor}</dd>
    </div>
  );
}

/** Formulario de solicitud con vista previa en vivo. `trabajadorId` lo usa Personas para registrar a nombre de otra persona. */
export function FormularioSolicitud({ tipos, trabajadorId, alEnviar }: { tipos: TipoAusencia[]; trabajadorId?: string; alEnviar: (id: string) => void }) {
  // Vacaciones primero: es lo que se pide la gran mayoría de las veces (la lista viene ordenada por nombre).
  const [tipoCodigo, setTipo] = useState(tipos.find((t) => t.codigo === "VACACIONES")?.codigo ?? tipos[0]?.codigo ?? "VACACIONES");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [comentario, setComentario] = useState("");
  const [reservado, setReservado] = useState("");
  const [vista, setVista] = useState<Previsualizacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const tipo = tipos.find((t) => t.codigo === tipoCodigo);

  const datos: DatosSolicitud = { tipoCodigo, desde, hasta: hasta || desde, comentario: comentario || undefined, detalleReservado: reservado || undefined, trabajadorId };
  const listo = Boolean(desde);

  useEffect(() => {
    if (!listo) return;
    let vigente = true;
    // Espera breve para no consultar en cada tecla al escribir la fecha a mano.
    const t = setTimeout(() => {
      api.previsualizar(datos).then((v) => vigente && setVista(v)).catch(() => vigente && setVista(null));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCodigo, desde, hasta, trabajadorId, listo]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const s = await api.solicitar(datos);
      alEnviar(s.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar. Revisa tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  const problemas = listo ? (vista?.problemas ?? []) : [];

  return (
    <form onSubmit={enviar} className="space-y-5">
      <div>
        <label htmlFor="tipo" className="block font-semibold">
          Qué necesitas
        </label>
        <select id="tipo" value={tipoCodigo} onChange={(e) => setTipo(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-4 py-3">
          {[...tipos].sort((a, b) => Number(b.codigo === "VACACIONES") - Number(a.codigo === "VACACIONES")).map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.nombre}
            </option>
          ))}
        </select>
        {tipo && <p className="mt-2 text-sm text-basalto-soft">{tipo.descripcion}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 items-end">
        <div>
          <label htmlFor="desde" className="block font-semibold">
            Desde
          </label>
          <input id="desde" type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-4 py-3" />
        </div>
        <div>
          <label htmlFor="hasta" className="block font-semibold">
            Hasta, inclusive
          </label>
          <input id="hasta" type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-4 py-3" />
        </div>
      </div>

      {listo && vista && (
        <div aria-live="polite" className="rounded-xl border border-moana-200 bg-white px-5 py-4">
          <p className="text-lg">
            <span className="font-bold tabular">{dias(vista.diasHabiles)} hábiles</span>
            <span className="text-basalto-soft"> de {dias(vista.diasCorridos)} corridos</span>
          </p>
          {vista.tipo.afectaSaldo && (
            <p className="mt-1 text-basalto-soft">
              Te quedarían <span className="tabular font-semibold text-basalto">{dias(Math.max(0, vista.disponible - vista.diasHabiles))}</span> disponibles.
            </p>
          )}
          {problemas.length > 0 && (
            <ul className="mt-3 space-y-1 text-toromiro">
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label htmlFor="comentario" className="block font-semibold">
          Comentario <span className="font-normal text-basalto-soft">(opcional, lo ve tu jefatura)</span>
        </label>
        <textarea id="comentario" rows={2} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-4 py-3" />
      </div>

      {tipo?.sensible && (
        <div>
          <label htmlFor="reservado" className="block font-semibold">
            Folio y detalle <span className="font-normal text-basalto-soft">(solo lo ve Personas)</span>
          </label>
          <textarea id="reservado" rows={2} maxLength={500} value={reservado} onChange={(e) => setReservado(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-4 py-3" />
          <p className="mt-2 text-sm text-basalto-soft">Tu jefatura verá solo que estarás ausente y las fechas.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">
          {error}
        </p>
      )}

      <button type="submit" disabled={!listo || enviando || problemas.length > 0} className="rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white hover:bg-moana-900 disabled:opacity-50">
        {enviando ? "Enviando…" : tipo?.requiereAprobacion === false ? "Informar" : "Enviar solicitud"}
      </button>
    </form>
  );
}

export function ListaSolicitudes({ solicitudes, mostrarNombre = false, vacio }: { solicitudes: SolicitudLista[]; mostrarNombre?: boolean; vacio: string }) {
  if (solicitudes.length === 0) return <p className="text-basalto-soft">{vacio}</p>;
  return (
    <ul className="divide-y divide-moana-200 border-y border-moana-200">
      {solicitudes.map((s) => (
        <li key={s.id}>
          <Link href={`/ausencias/${s.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 hover:bg-white/60">
            <span>
              {mostrarNombre && (
                <span className="block font-semibold">
                  {s.nombres} {s.apellidos.split(" ")[0]} <span className="font-normal text-basalto-soft">· {s.sede}</span>
                </span>
              )}
              <span className={mostrarNombre ? "text-basalto-soft" : "font-semibold"}>{s.tipo}</span>
              <span className="block text-basalto-soft tabular">
                {rangoFechas(s.desde, s.hasta)}
                {s.tipoCodigo === "VACACIONES" && `, ${dias(s.diasHabiles)} hábiles`}
              </span>
            </span>
            <EstadoChip estado={s.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
