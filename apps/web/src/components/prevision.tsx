"use client";
/**
 * Bloque "Previsión y salud" de la ficha.
 *
 * - Todos ven la AFP y la institución de salud de la ficha que pueden abrir.
 * - El sueldo solo llega desde la API si el usuario puede verlo (propio, Personas o Gerencia).
 * - Personas puede editar: el selector de AFP muestra la tasa total vigente (10 % + comisión),
 *   tomada de la tabla de tasas con vigencia; nadie la digita a mano.
 */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type OpcionAfp, type OpcionSalud, type Trabajador } from "@/lib/api";
import { pesos, porcentaje } from "@/lib/formato";

const COTIZACION_OBLIGATORIA = 10;

export function Prevision({ t, editable, alGuardar }: { t: Trabajador; editable: boolean; alGuardar?: () => void }) {
  const [editando, setEditando] = useState(false);

  return (
    <section aria-labelledby="t-prevision" className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="t-prevision" className="text-xl font-bold">
          Previsión y salud
        </h2>
        {editable && !editando && (
          <button onClick={() => setEditando(true)} className="text-moana-800 underline underline-offset-4">
            Editar
          </button>
        )}
      </div>

      {editando ? (
        <EditorPrevision
          t={t}
          alCerrar={(guardado) => {
            setEditando(false);
            if (guardado) alGuardar?.();
          }}
        />
      ) : (
        <dl className="mt-4 divide-y divide-moana-200 border-y border-moana-200">
          <Fila etiqueta="AFP" valor={t.afp ?? "Sin registrar"} />
          <Fila
            etiqueta="Salud"
            valor={t.salud ? (t.saludTipo === "ISAPRE" && t.planIsapreUf ? `${t.salud}, plan de ${t.planIsapreUf.toLocaleString("es-CL")} UF` : t.salud) : "Sin registrar"}
          />
          {t.sueldoBase !== undefined && <Fila etiqueta="Sueldo base" valor={t.sueldoBase ? pesos(t.sueldoBase) : "Sin registrar"} />}
        </dl>
      )}

      {t.puedeVerRemuneracion && !editando && (
        <Link href={`/remuneraciones/${t.id}`} className="mt-6 inline-block rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white hover:bg-moana-900">
          Ver liquidación de referencia
        </Link>
      )}
    </section>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4 py-3.5">
      <dt className="text-basalto-soft">{etiqueta}</dt>
      <dd className="font-semibold tabular">{valor}</dd>
    </div>
  );
}

function EditorPrevision({ t, alCerrar }: { t: Trabajador; alCerrar: (guardado: boolean) => void }) {
  const [opciones, setOpciones] = useState<{ afps: OpcionAfp[]; salud: OpcionSalud[] } | null>(null);
  const [afpId, setAfpId] = useState(t.afpId ?? "");
  const [saludId, setSaludId] = useState(t.saludId ?? "");
  const [plan, setPlan] = useState(t.planIsapreUf ? String(t.planIsapreUf).replace(".", ",") : "");
  const [sueldo, setSueldo] = useState(t.sueldoBase ? String(t.sueldoBase) : "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.opcionesPrevision().then(setOpciones).catch(() => setError("No se pudieron cargar las AFP e instituciones de salud."));
  }, []);

  const afpElegida = opciones?.afps.find((a) => a.id === afpId);
  const saludElegida = opciones?.salud.find((s) => s.id === saludId);
  const esIsapre = saludElegida?.tipo === "ISAPRE";

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const planUf = esIsapre ? Number(plan.replace(",", ".")) : null;
    if (esIsapre && !(planUf && planUf > 0)) return setError("Indica el plan pactado con la Isapre, en UF.");
    setGuardando(true);
    try {
      await api.actualizarPrevision(t.id, {
        afpId: afpId || null,
        saludId: saludId || null,
        planIsapreUf: planUf,
        sueldoBase: sueldo ? Number(sueldo.replace(/\D/g, "")) : null,
      });
      alCerrar(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar. Intenta de nuevo.");
      setGuardando(false);
    }
  }

  const campo = "mt-2 w-full rounded-lg border-2 border-moana-200 bg-white px-4 py-3 focus:border-moana-800 focus:outline-none";

  return (
    <form onSubmit={guardar} className="mt-4 space-y-6 rounded-2xl bg-white p-5 lg:p-6">
      <div>
        <label htmlFor="afp" className="font-semibold">
          AFP
        </label>
        <select id="afp" value={afpId} onChange={(e) => setAfpId(e.target.value)} className={campo}>
          <option value="">Sin registrar</option>
          {opciones?.afps.map((a) => (
            <option key={a.id} value={a.id} disabled={a.comision === null}>
              {a.nombre}
              {a.comision !== null ? `, ${porcentaje(COTIZACION_OBLIGATORIA + a.comision)}` : ", sin tasa vigente"}
            </option>
          ))}
        </select>
        {afpElegida?.comision != null && (
          <p className="mt-2 text-sm text-basalto-soft">
            10 % para su fondo más {porcentaje(afpElegida.comision)} de comisión, vigente desde {afpElegida.vigenteDesde}.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="salud" className="font-semibold">
          Salud
        </label>
        <select id="salud" value={saludId} onChange={(e) => setSaludId(e.target.value)} className={campo}>
          <option value="">Sin registrar</option>
          {opciones?.salud.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
              {s.tipo === "FONASA" ? ", 7 %" : ""}
            </option>
          ))}
        </select>
      </div>

      {esIsapre && (
        <div>
          <label htmlFor="plan" className="block font-semibold">
            Plan pactado, en UF
          </label>
          <input id="plan" inputMode="decimal" placeholder="3,5" value={plan} onChange={(e) => setPlan(e.target.value)} className={`${campo} max-w-40 tabular`} />
          <p className="mt-2 text-sm text-basalto-soft">Se descuenta el mayor entre el plan y el 7 % legal.</p>
        </div>
      )}

      <div>
        <label htmlFor="sueldo" className="block font-semibold">
          Sueldo base mensual
        </label>
        <input
          id="sueldo"
          inputMode="numeric"
          value={sueldo ? Number(sueldo.replace(/\D/g, "")).toLocaleString("es-CL") : ""}
          onChange={(e) => setSueldo(e.target.value.replace(/\D/g, ""))}
          className={`${campo} max-w-60 tabular`}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={guardando || !opciones} className="rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white hover:bg-moana-900 disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={() => alCerrar(false)} className="rounded-lg px-5 py-3 font-semibold text-moana-800 hover:bg-moana-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}
