"use client";
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api, ApiError } from "@/lib/api";
import { fechaCorta } from "@/lib/formato";

export default function CertificadosPage() {
  const [version, setVersion] = useState(0);
  const { datos, error } = useDatos(api.misCertificados, [version]);
  const [emitiendo, setEmitiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function emitir() {
    setFallo(null);
    setEmitiendo(true);
    try {
      const c = await api.emitirCertificado();
      setVersion((v) => v + 1);
      window.open(`/api/certificados/${c.id}/pdf`, "_blank", "noopener");
    } catch (e) {
      setFallo(e instanceof ApiError ? e.message : "No se pudo emitir el certificado.");
    } finally {
      setEmitiendo(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl lg:text-3xl font-bold">Certificados</h1>
      <p className="mt-2 text-basalto-soft">
        Tu certificado de antigüedad, listo en segundos. Trae un código y un QR para que el banco o la inmobiliaria compruebe que es auténtico, sin llamar a la empresa.
      </p>
      <button onClick={emitir} disabled={emitiendo} className="mt-8 rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white hover:bg-moana-900 disabled:opacity-50">
        {emitiendo ? "Emitiendo…" : "Emitir certificado de antigüedad"}
      </button>
      {fallo && <p role="alert" className="mt-4 rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{fallo}</p>}

      <section aria-labelledby="t-emitidos" className="mt-12">
        <h2 id="t-emitidos" className="text-xl font-bold">Emitidos</h2>
        <div className="mt-5">
          {error && <Aviso texto={error} />}
          {!datos && !error && <Cargando />}
          {datos && datos.length === 0 && <p className="text-basalto-soft">Aún no has emitido certificados.</p>}
          {datos && datos.length > 0 && (
            <ul className="divide-y divide-moana-200 border-y border-moana-200">
              {datos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span>
                    <span className="block font-semibold">Antigüedad laboral, {fechaCorta(c.emitidoEn.slice(0, 10), true)}</span>
                    <span className="block text-sm text-basalto-soft tabular">Código {c.codigo}{c.revocadoEn ? ", revocado" : ""}</span>
                  </span>
                  <a href={`/api/certificados/${c.id}/pdf`} target="_blank" rel="noopener" className="rounded-lg border border-moana-800 px-4 py-2 font-semibold text-moana-800 hover:bg-moana-50">
                    Abrir PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
