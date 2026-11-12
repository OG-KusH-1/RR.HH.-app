"use client";
/**
 * Verificación pública de certificados. La abre un tercero (banco, inmobiliaria) desde el QR,
 * sin cuenta. Solo muestra lo que ya dice el papel, con el RUT parcialmente oculto.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Verificacion } from "@/lib/api";
import { formatearFecha } from "@/lib/formato";

export default function VerificarPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [r, setR] = useState<Verificacion | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.verificarCertificado(codigo).then(setR).catch(() => setError(true));
  }, [codigo]);

  return (
    <main className="min-h-dvh px-5 py-12 lg:py-20">
      <div className="mx-auto max-w-lg">
        <p className="font-semibold text-moana-800">Verificación de certificados · Tangata</p>
        {error && <p className="mt-8 text-toromiro">No se pudo consultar ahora. Intenta de nuevo en unos minutos.</p>}
        {!r && !error && <p className="mt-8 text-basalto-soft" aria-busy="true">Consultando…</p>}
        {r && !r.valido && (
          <section className="mt-8 rounded-2xl bg-toromiro-soft p-6">
            <h1 className="text-2xl font-bold text-toromiro">No encontramos este certificado</h1>
            <p className="mt-3">Revisa que el código <span className="font-semibold tabular">{codigo.toUpperCase()}</span> esté bien escrito. Si coincide con el papel y no aparece, el documento no fue emitido por este sistema.</p>
          </section>
        )}
        {r && r.valido && (
          <section className={`mt-8 rounded-2xl p-6 lg:p-8 ${r.revocado ? "bg-liquen-soft" : "bg-white"}`}>
            <h1 className="text-2xl font-bold">{r.revocado ? "Certificado revocado" : "Certificado auténtico"}</h1>
            <p className="mt-2 text-basalto-soft">
              {r.revocado ? "La empresa anuló este certificado. Pide uno nuevo a la persona." : `Emitido por ${r.empresa}. Refleja la situación a la fecha de emisión.`}
            </p>
            <dl className="mt-6 divide-y divide-moana-200 border-y border-moana-200">
              {[
                ["Tipo", r.tipo],
                ["Nombre", r.nombre],
                ["RUT", r.rut],
                ["Cargo", r.cargo],
                ["Fecha de ingreso", formatearFecha(r.fechaIngreso)],
                ["Contrato", r.tipoContrato],
                ["Emitido el", formatearFecha(r.emitido)],
                ["Código", r.codigo],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 py-3">
                  <dt className="text-basalto-soft">{k}</dt>
                  <dd className="font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}
