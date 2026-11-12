"use client";
/**
 * Bloque de vacaciones dentro de la ficha de otra persona.
 * - Jefatura, Personas y Gerencia ven el saldo y cómo se calcula.
 * - Solo Personas ajusta el saldo, registra años con empleadores anteriores (HU-11)
 *   e informa ausencias a nombre de la persona (licencias que llegan en papel).
 * Toda acción queda en la auditoría y avisa a la persona afectada.
 */
import { useState, type FormEvent } from "react";
import { api, ApiError, type Saldo } from "@/lib/api";
import { FormularioSolicitud, ResumenSaldo } from "./ausencias";
import { Cargando, useDatos } from "./datos";

type Panel = null | "ajuste" | "anios" | "registrar";

export function VacacionesFicha({ trabajadorId, esPersonas }: { trabajadorId: string; esPersonas: boolean }) {
  const [version, setVersion] = useState(0);
  const { datos: saldo, error } = useDatos(() => api.saldoDe(trabajadorId), [trabajadorId, version]);
  const { datos: tipos } = useDatos(() => (esPersonas ? api.tiposAusencia() : Promise.resolve([])));
  const [panel, setPanel] = useState<Panel>(null);

  if (error) return null;
  return (
    <section aria-labelledby="t-vac" className="mt-12">
      <h2 id="t-vac" className="text-xl font-bold">
        Vacaciones
      </h2>
      <div className="mt-5">{saldo ? <ResumenSaldo s={saldo} titulo="Saldo" /> : <Cargando />}</div>
      {esPersonas && saldo && (
        <>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <button onClick={() => setPanel(panel === "registrar" ? null : "registrar")} className="text-moana-800 underline underline-offset-4">
              Registrar ausencia
            </button>
            <button onClick={() => setPanel(panel === "ajuste" ? null : "ajuste")} className="text-moana-800 underline underline-offset-4">
              Ajustar saldo
            </button>
            <button onClick={() => setPanel(panel === "anios" ? null : "anios")} className="text-moana-800 underline underline-offset-4">
              Años con empleadores anteriores ({saldo.trabajador.aniosPrevios})
            </button>
          </div>
          <div className="mt-5">
            {panel === "registrar" && tipos && (
              <FormularioSolicitud
                tipos={tipos}
                trabajadorId={trabajadorId}
                alEnviar={() => {
                  setPanel(null);
                  setVersion((v) => v + 1);
                }}
              />
            )}
            {panel === "ajuste" && <FormAjuste trabajadorId={trabajadorId} alGuardar={() => { setPanel(null); setVersion((v) => v + 1); }} />}
            {panel === "anios" && <FormAnios trabajadorId={trabajadorId} saldo={saldo} alGuardar={() => { setPanel(null); setVersion((v) => v + 1); }} />}
          </div>
        </>
      )}
    </section>
  );
}

function useEnvio(alGuardar: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(fn: () => Promise<unknown>) {
    setError(null);
    setEnviando(true);
    try {
      await fn();
      alGuardar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }
  return { error, enviando, enviar };
}

function FormAjuste({ trabajadorId, alGuardar }: { trabajadorId: string; alGuardar: () => void }) {
  const [dias, setDias] = useState("");
  const [motivo, setMotivo] = useState("");
  const { error, enviando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        enviar(() => api.ajustarSaldo(trabajadorId, Number(dias.replace(",", ".")), motivo));
      }}
      className="space-y-4 rounded-xl border border-moana-200 bg-white p-5"
    >
      <p className="text-basalto-soft">Usa un número positivo para sumar días (por ejemplo, un adelanto pactado) o negativo para restar. El ajuste no borra nada: queda como un movimiento más con su motivo.</p>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr] items-end">
        <div>
          <label htmlFor="aj-dias" className="block font-semibold">Días</label>
          <input id="aj-dias" required inputMode="decimal" value={dias} onChange={(e) => setDias(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 px-3 py-2.5" />
        </div>
        <div>
          <label htmlFor="aj-motivo" className="block font-semibold">Motivo</label>
          <input id="aj-motivo" required minLength={10} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 px-3 py-2.5" />
        </div>
      </div>
      {error && <p role="alert" className="text-toromiro">{error}</p>}
      <button disabled={enviando} className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Guardar ajuste</button>
    </form>
  );
}

function FormAnios({ trabajadorId, saldo, alGuardar }: { trabajadorId: string; saldo: Saldo; alGuardar: () => void }) {
  const [anios, setAnios] = useState(String(saldo.trabajador.aniosPrevios));
  const [respaldo, setRespaldo] = useState("");
  const { error, enviando, enviar } = useEnvio(alGuardar);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        enviar(() => api.aniosPrevios(trabajadorId, Number(anios.replace(",", ".")), respaldo));
      }}
      className="space-y-4 rounded-xl border border-moana-200 bg-white p-5"
    >
      <p className="text-basalto-soft">Cuentan para el feriado progresivo: con 10 años trabajados se suma un día por cada 3 años nuevos. La ley permite hacer valer hasta 10 años con empleadores anteriores; el sistema aplica ese tope.</p>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr] items-end">
        <div>
          <label htmlFor="an-anios" className="block font-semibold">Años</label>
          <input id="an-anios" required inputMode="decimal" value={anios} onChange={(e) => setAnios(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 px-3 py-2.5" />
        </div>
        <div>
          <label htmlFor="an-resp" className="block font-semibold">Documento de respaldo</label>
          <input id="an-resp" required minLength={5} placeholder="Certificado de cotizaciones AFP, 2004 a 2014" value={respaldo} onChange={(e) => setRespaldo(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 px-3 py-2.5" />
        </div>
      </div>
      {error && <p role="alert" className="text-toromiro">{error}</p>}
      <button disabled={enviando} className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Guardar</button>
    </form>
  );
}
