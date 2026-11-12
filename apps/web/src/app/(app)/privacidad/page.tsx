"use client";
/**
 * Derechos sobre los datos personales (HU-06 y HU-20).
 * - Cada persona descarga al instante una copia de sus datos.
 * - Pide correcciones o acceso detallado; Personas responde por escrito.
 */
import { useState, type FormEvent } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api, ApiError, type SolicitudTitular } from "@/lib/api";
import { fechaCorta } from "@/lib/formato";

const ESTADO: Record<string, string> = { ABIERTA: "Abierta", RESUELTA: "Resuelta", RECHAZADA: "Rechazada" };

export default function PrivacidadPage() {
  const usuario = useUsuario();
  const [version, setVersion] = useState(0);
  const { datos: mias } = useDatos(api.misSolicitudesDatos, [version]);
  const { datos: todas } = useDatos(() => (usuario.rol === "PERSONAS" ? api.todasSolicitudesDatos() : Promise.resolve(null)), [version]);

  async function descargar() {
    const datos = await api.misDatos();
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `mis-datos-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl space-y-12">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold">Privacidad</h1>
        <p className="mt-2 text-basalto-soft">Tus datos personales son tuyos. Puedes ver qué guarda la empresa, quién vio tu ficha y pedir correcciones.</p>
      </header>

      <section aria-labelledby="t-copia">
        <h2 id="t-copia" className="text-xl font-bold">Copia de tus datos</h2>
        <p className="mt-2 text-basalto-soft">Incluye tu ficha, vacaciones, solicitudes, lista de documentos, certificados y quién vio tu ficha. Se descarga al instante.</p>
        <button onClick={descargar} className="mt-4 rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white">Descargar mis datos</button>
      </section>

      <section aria-labelledby="t-pedir">
        <h2 id="t-pedir" className="text-xl font-bold">Pedir una corrección o acceso</h2>
        <NuevaSolicitud alEnviar={() => setVersion((v) => v + 1)} />
        <div className="mt-6">{mias ? <Lista items={mias} vacio="No has hecho solicitudes." /> : <Cargando />}</div>
      </section>

      {todas && (
        <section aria-labelledby="t-todas">
          <h2 id="t-todas" className="text-xl font-bold">Solicitudes de la empresa</h2>
          <p className="mt-2 text-basalto-soft">Responde por escrito. Si es una corrección, actualiza la ficha y explica qué cambiaste.</p>
          <div className="mt-5"><Lista items={todas.filter((t) => t.s.id && !mias?.some((m) => m.s.id === t.s.id))} vacio="No hay solicitudes de otras personas." responder alResponder={() => setVersion((v) => v + 1)} /></div>
        </section>
      )}
    </div>
  );
}

function NuevaSolicitud({ alEnviar }: { alEnviar: () => void }) {
  const [tipo, setTipo] = useState<"RECTIFICACION" | "ACCESO">("RECTIFICACION");
  const [detalle, setDetalle] = useState("");
  const [estado, setEstado] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.solicitarDatos(tipo, detalle);
      setDetalle("");
      setEstado("Solicitud enviada. Personas recibió un aviso.");
      alEnviar();
    } catch (err) {
      setEstado(err instanceof ApiError ? err.message : "No se pudo enviar.");
    }
  }
  return (
    <form onSubmit={enviar} className="mt-4 space-y-4">
      <fieldset className="flex flex-wrap gap-6">
        <legend className="sr-only">Tipo de solicitud</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={tipo === "RECTIFICACION"} onChange={() => setTipo("RECTIFICACION")} /> Corregir un dato</label>
        <label className="flex items-center gap-2"><input type="radio" checked={tipo === "ACCESO"} onChange={() => setTipo("ACCESO")} /> Pedir información adicional</label>
      </fieldset>
      <label htmlFor="p-detalle" className="sr-only">Detalle</label>
      <textarea id="p-detalle" rows={3} required minLength={10} placeholder={tipo === "RECTIFICACION" ? "Mi teléfono correcto es +56 9 …" : "Quiero saber con quién se comparten mis datos…"} value={detalle} onChange={(e) => setDetalle(e.target.value)} className="w-full rounded-lg border border-moana-200 bg-white px-4 py-3" />
      {estado && <p role="status" className="text-moana-800">{estado}</p>}
      <button disabled={detalle.trim().length < 10} className="rounded-lg border border-moana-800 px-5 py-2.5 font-semibold text-moana-800 disabled:opacity-50">Enviar solicitud</button>
    </form>
  );
}

function Lista({ items, vacio, responder, alResponder }: { items: SolicitudTitular[]; vacio: string; responder?: boolean; alResponder?: () => void }) {
  if (items.length === 0) return <p className="text-basalto-soft">{vacio}</p>;
  return (
    <ul className="divide-y divide-moana-200 border-y border-moana-200">
      {items.map(({ s, nombres, apellidos }) => (
        <li key={s.id} className="py-4">
          <p className="flex flex-wrap justify-between gap-2">
            <span className="font-semibold">
              {responder && `${nombres} ${apellidos.split(" ")[0]} · `}
              {s.tipo === "RECTIFICACION" ? "Corrección" : "Acceso"}, {fechaCorta(s.creadaEn.slice(0, 10), true)}
            </span>
            <span className={s.estado === "ABIERTA" ? "font-semibold" : "text-basalto-soft"}>{ESTADO[s.estado]}</span>
          </p>
          <p className="mt-1">{s.detalle}</p>
          {s.respuesta && <p className="mt-2 rounded-lg bg-rano px-4 py-2"><span className="font-semibold">Respuesta:</span> {s.respuesta}</p>}
          {responder && s.estado === "ABIERTA" && <Responder id={s.id} alResponder={alResponder!} />}
        </li>
      ))}
    </ul>
  );
}

function Responder({ id, alResponder }: { id: string; alResponder: () => void }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enviar = async (estado: "RESUELTA" | "RECHAZADA") => {
    try {
      await api.responderDatos(id, estado, texto);
      alResponder();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo responder.");
    }
  };
  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={`r-${id}`} className="sr-only">Respuesta</label>
      <textarea id={`r-${id}`} rows={2} placeholder="Actualicé tu teléfono en la ficha." value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-lg border border-moana-200 bg-white px-3 py-2" />
      {error && <Aviso texto={error} />}
      <div className="flex gap-3">
        <button disabled={texto.trim().length < 10} onClick={() => enviar("RESUELTA")} className="rounded-lg bg-moana-800 px-4 py-2 font-semibold text-white disabled:opacity-50">Marcar resuelta</button>
        <button disabled={texto.trim().length < 10} onClick={() => enviar("RECHAZADA")} className="px-3 py-2 text-toromiro underline underline-offset-4 disabled:opacity-50">Rechazar</button>
      </div>
    </div>
  );
}
