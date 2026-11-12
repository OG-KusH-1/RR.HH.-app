"use client";
/**
 * Mis turnos (HU-24) y cambios de turno (HU-25).
 * Muestra esta semana y la siguiente, ya publicadas. Desde un turno propio se propone un cambio
 * a un compañero del mismo equipo; él acepta y la jefatura aprueba.
 */
import { useState, type FormEvent } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api, ApiError, type MisTurnos, type TurnoSimple } from "@/lib/api";
import { fechaCorta } from "@/lib/formato";

const ESTADO: Record<string, string> = {
  ESPERA_COMPANERO: "Esperando a tu compañero",
  ESPERA_JEFATURA: "Esperando a la jefatura",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado",
};

export default function MisTurnosPage() {
  const [version, setVersion] = useState(0);
  const { datos, error } = useDatos(api.misTurnos, [version]);
  const { datos: cambios } = useDatos(api.cambiosTurno, [version]);
  const [cambiando, setCambiando] = useState<TurnoSimple | null>(null);
  const recargar = () => setVersion((v) => v + 1);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl space-y-12">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold">Mis turnos</h1>
        <p className="mt-2 text-basalto-soft">Esta semana y la siguiente, tal como las publicó tu jefatura.</p>
      </header>
      {error && <Aviso texto={error} />}
      {!datos && !error && <Cargando />}
      {datos && (
        <section aria-label="Turnos">
          {datos.turnos.length === 0 ? (
            <p className="text-basalto-soft">No tienes turnos publicados para estas dos semanas.</p>
          ) : (
            <ul className="divide-y divide-moana-200 border-y border-moana-200">
              {datos.turnos.map((t) => (
                <li key={t.id} className={`flex flex-wrap items-center justify-between gap-3 py-4 ${t.fecha < hoy ? "opacity-60" : ""}`}>
                  <span>
                    <span className="block font-semibold capitalize">{fechaCorta(t.fecha)}</span>
                    <span className="block text-2xl font-bold tabular">{t.inicio} a {t.fin}</span>
                    <span className="block text-sm text-basalto-soft">{(t.horas ?? 0).toLocaleString("es-CL")} horas, {t.colacionMin} min de colación</span>
                  </span>
                  {t.fecha >= hoy && datos.companeros.length > 0 && (
                    <button onClick={() => setCambiando(t)} className="text-moana-800 underline underline-offset-4">Proponer cambio</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {cambiando && <ProponerCambio turno={cambiando} datos={datos} alCerrar={(ok) => { setCambiando(null); if (ok) recargar(); }} />}
        </section>
      )}

      {cambios && cambios.length > 0 && (
        <section aria-labelledby="t-cambios">
          <h2 id="t-cambios" className="text-xl font-bold">Cambios de turno</h2>
          <ul className="mt-4 divide-y divide-moana-200 border-y border-moana-200">
            {cambios.map((c) => (
              <li key={c.id} className="py-4">
                <p>
                  <span className="font-semibold">{c.solicitante}</span> cede su turno del {c.turnoSolicitante ? `${fechaCorta(c.turnoSolicitante.fecha)} (${c.turnoSolicitante.inicio} a ${c.turnoSolicitante.fin})` : "—"} a <span className="font-semibold">{c.companero}</span>
                  {c.turnoCompanero && <> y toma el del {fechaCorta(c.turnoCompanero.fecha)} ({c.turnoCompanero.inicio} a {c.turnoCompanero.fin})</>}.
                </p>
                {c.motivo && <p className="text-basalto-soft">“{c.motivo}”</p>}
                <p className="mt-1 text-sm font-semibold">{ESTADO[c.estado]}</p>
                {c.puedoResponder && (
                  <div className="mt-3 flex gap-3">
                    <button onClick={async () => { await api.responderCambio(c.id, true); recargar(); }} className="rounded-lg bg-moana-800 px-4 py-2 font-semibold text-white">Aceptar</button>
                    <button onClick={async () => { await api.responderCambio(c.id, false); recargar(); }} className="text-toromiro underline underline-offset-4">Rechazar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ProponerCambio({ turno, datos, alCerrar }: { turno: TurnoSimple; datos: MisTurnos; alCerrar: (ok: boolean) => void }) {
  const [companeroId, setCompanero] = useState(datos.companeros[0]?.id ?? "");
  const [turnoCompaneroId, setTurnoCompanero] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const turnosDelCompanero = datos.equipo.filter((t) => t.trabajadorId === companeroId);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.pedirCambio({ turnoId: turno.id, companeroId, turnoCompaneroId: turnoCompaneroId || undefined, motivo: motivo || undefined });
      alCerrar(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar.");
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-4 rounded-xl border border-moana-200 bg-white p-5">
      <h2 className="font-bold">Cambiar mi turno del {fechaCorta(turno.fecha)} ({turno.inicio} a {turno.fin})</h2>
      <label className="block">
        <span className="font-semibold">Con quién</span>
        <select value={companeroId} onChange={(e) => { setCompanero(e.target.value); setTurnoCompanero(""); }} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
          {datos.companeros.map((c) => <option key={c.id} value={c.id}>{c.nombres} {c.apellidos.split(" ")[0]}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="font-semibold">A cambio de</span>
        <select value={turnoCompaneroId} onChange={(e) => setTurnoCompanero(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
          <option value="">Nada: solo le cedo mi turno</option>
          {turnosDelCompanero.map((t) => <option key={t.id} value={t.id}>Su turno del {fechaCorta(t.fecha)}, {t.inicio} a {t.fin}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="font-semibold">Motivo <span className="font-normal text-basalto-soft">(opcional)</span></span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 px-3 py-2.5" />
      </label>
      {error && <p role="alert" className="text-toromiro">{error}</p>}
      <div className="flex gap-3">
        <button className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white">Enviar propuesta</button>
        <button type="button" onClick={() => alCerrar(false)} className="px-3 text-basalto-soft underline underline-offset-4">Cancelar</button>
      </div>
    </form>
  );
}
