"use client";
/** Configuración de documentos obligatorios por cargo (HU-17). "*" significa toda la empresa. */
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api, ApiError } from "@/lib/api";

export default function RequisitosPage() {
  const [version, setVersion] = useState(0);
  const { datos, error } = useDatos(api.requisitos, [version]);
  const { datos: tipos } = useDatos(api.tiposDocumento);
  const { datos: personas } = useDatos(api.trabajadores);
  const cargos = [...new Set(personas?.map((p) => p.cargo) ?? [])].sort();
  const [cargo, setCargo] = useState("*");
  const [tipoId, setTipoId] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.agregarRequisito(cargo, tipoId || tipos![0].id);
      setVersion((v) => v + 1);
    } catch (err) {
      setFallo(err instanceof ApiError ? err.message : "No se pudo guardar.");
    }
  }

  const grupos = [...new Set(datos?.map((r) => r.cargo) ?? [])];
  return (
    <div className="max-w-2xl">
      <Link href="/vencimientos" className="text-moana-800 underline underline-offset-4">Volver</Link>
      <h1 className="mt-6 text-2xl lg:text-3xl font-bold">Documentos obligatorios</h1>
      <p className="mt-2 text-basalto-soft">Lo que debe tener cada carpeta según el cargo. Alimenta el reporte de carpetas incompletas.</p>
      {error && <div className="mt-6"><Aviso texto={error} /></div>}
      {!datos && !error && <div className="mt-6"><Cargando /></div>}
      {datos && (
        <div className="mt-8 space-y-6">
          {grupos.map((g) => (
            <section key={g}>
              <h2 className="font-bold">{g === "*" ? "Toda la empresa" : g}</h2>
              <ul className="mt-2 divide-y divide-moana-200 border-y border-moana-200">
                {datos.filter((r) => r.cargo === g).map((r) => (
                  <li key={r.id} className="flex justify-between py-2.5">
                    {r.tipo}
                    <button onClick={() => api.quitarRequisito(r.id).then(() => setVersion((v) => v + 1))} className="text-sm text-toromiro underline underline-offset-4">Quitar</button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {tipos && (
        <form onSubmit={agregar} className="mt-10 grid gap-4 rounded-xl border border-moana-200 bg-white p-5 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label htmlFor="r-cargo" className="block font-semibold">Cargo</label>
            <select id="r-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
              <option value="*">Toda la empresa</option>
              {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="r-tipo" className="block font-semibold">Documento</label>
            <select id="r-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <button className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white">Agregar</button>
          {fallo && <p role="alert" className="text-toromiro sm:col-span-3">{fallo}</p>}
        </form>
      )}
    </div>
  );
}
