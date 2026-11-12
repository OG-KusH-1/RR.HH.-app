"use client";
/**
 * Carpeta de documentos: lista, descarga y (para Personas) subida.
 *
 * La descarga pide primero un enlace firmado a la API y luego lo abre: el enlace vence en
 * 5 minutos y solo funciona con la sesión de quien lo pidió (HU-15). Nunca se guarda una URL
 * permanente en la página.
 */
import { useState, type FormEvent } from "react";
import { api, ApiError, type CarpetaDocumentos, type TipoDocumento, type Visibilidad } from "@/lib/api";
import { fechaCorta } from "@/lib/formato";

const VISIBILIDAD: Record<Visibilidad, string> = {
  TRABAJADOR: "La persona y Gerencia",
  INTERNO: "Solo Personas y Gerencia",
  RESERVADO: "Solo Personas (dato sensible)",
};

function tamano(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1000)} KB`;
}

export function ListaDocumentos({ carpeta, alCambiar, mostrarVisibilidad }: { carpeta: CarpetaDocumentos; alCambiar?: () => void; mostrarVisibilidad?: boolean }) {
  const [error, setError] = useState<string | null>(null);

  async function abrir(id: string) {
    setError(null);
    try {
      const { url } = await api.enlaceDocumento(id);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo abrir el documento.");
    }
  }

  async function eliminar(id: string, nombre: string) {
    const motivo = window.prompt(`¿Por qué eliminas "${nombre}"? Quedará registrado.`);
    if (!motivo || motivo.trim().length < 5) return;
    try {
      await api.eliminarDocumento(id, motivo);
      alCambiar?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo eliminar.");
    }
  }

  if (carpeta.documentos.length === 0) return <p className="text-basalto-soft">No hay documentos en esta carpeta.</p>;
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{error}</p>}
      <ul className="divide-y divide-moana-200 border-y border-moana-200">
        {carpeta.documentos.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
            <span>
              <span className="block font-semibold">{d.tipo}</span>
              <span className="block text-sm text-basalto-soft">
                {d.nombreArchivo} · {tamano(d.tamano)} · subido el {fechaCorta(d.creadoEn.slice(0, 10), true)}
              </span>
              {d.venceEl && <span className="block text-sm">Vence el {fechaCorta(d.venceEl, true)}</span>}
              {mostrarVisibilidad && <span className="block text-sm text-basalto-soft">Lo ve: {VISIBILIDAD[d.visibilidad]}</span>}
            </span>
            <span className="flex gap-4">
              <button onClick={() => abrir(d.id)} className="rounded-lg border border-moana-800 px-4 py-2 font-semibold text-moana-800 hover:bg-moana-50">
                Abrir
              </button>
              {carpeta.puedeSubir && (
                <button onClick={() => eliminar(d.id, d.nombreArchivo)} className="text-toromiro underline underline-offset-4">
                  Eliminar
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Lee el archivo en el navegador y lo envía en base64. Se valida el tamaño antes de leerlo. */
export function SubirDocumento({ trabajadorId, tipos, alSubir }: { trabajadorId: string; tipos: TipoDocumento[]; alSubir: () => void }) {
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vence, setVence] = useState("");
  const [visibilidad, setVisibilidad] = useState<Visibilidad | "">("");
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const tipo = tipos.find((t) => t.id === tipoId);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    if (archivo.size > 10 * 1024 * 1024) return setError("El archivo supera los 10 MB.");
    setError(null);
    setSubiendo(true);
    try {
      const base64 = await new Promise<string>((ok, mal) => {
        const lector = new FileReader();
        lector.onload = () => ok(String(lector.result).split(",")[1] ?? "");
        lector.onerror = () => mal(lector.error);
        lector.readAsDataURL(archivo);
      });
      await api.subirDocumento({ trabajadorId, tipoId, nombreArchivo: archivo.name, contenidoBase64: base64, venceEl: vence || null, visibilidad: visibilidad || undefined });
      setArchivo(null);
      setVence("");
      (e.target as HTMLFormElement).reset();
      alSubir();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-xl border border-moana-200 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2 items-end">
        <div>
          <label htmlFor="doc-tipo" className="block font-semibold">Tipo</label>
          <select id="doc-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="doc-vis" className="block font-semibold">Quién lo ve</label>
          <select id="doc-vis" value={visibilidad || tipo?.visibilidadPorDefecto} onChange={(e) => setVisibilidad(e.target.value as Visibilidad)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
            {(Object.keys(VISIBILIDAD) as Visibilidad[]).map((v) => (
              <option key={v} value={v}>{VISIBILIDAD[v]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="doc-archivo" className="block font-semibold">Archivo <span className="font-normal text-basalto-soft">(PDF, PNG o JPG, hasta 10 MB)</span></label>
          <input id="doc-archivo" type="file" required accept="application/pdf,image/png,image/jpeg" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="mt-2 w-full" />
        </div>
        <div>
          <label htmlFor="doc-vence" className="block font-semibold">Vence {tipo?.conVencimiento ? "" : <span className="font-normal text-basalto-soft">(opcional)</span>}</label>
          <input id="doc-vence" type="date" required={tipo?.conVencimiento} value={vence} onChange={(e) => setVence(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 px-3 py-2.5" />
        </div>
      </div>
      <p className="text-sm text-basalto-soft">El archivo se guarda cifrado y no tiene dirección pública. Cada descarga queda registrada.</p>
      {error && <p role="alert" className="text-toromiro">{error}</p>}
      <button disabled={!archivo || subiendo} className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
        {subiendo ? "Subiendo…" : "Subir documento"}
      </button>
    </form>
  );
}
