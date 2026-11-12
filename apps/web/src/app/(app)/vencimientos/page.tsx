"use client";
/**
 * Lo que vence en los próximos días (HU-16) y las carpetas incompletas (HU-17).
 * Los contratos a plazo fijo se destacan porque requieren una decisión de una persona:
 * el sistema informa, no renueva ni termina contratos.
 */
import Link from "next/link";
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api } from "@/lib/api";
import { fechaCorta } from "@/lib/formato";

function cuando(dias: number) {
  if (dias < 0) return `Venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;
  if (dias === 0) return "Vence hoy";
  return `En ${dias} ${dias === 1 ? "día" : "días"}`;
}

export default function VencimientosPage() {
  const usuario = useUsuario();
  const [dias, setDias] = useState(60);
  const [revision, setRevision] = useState<string | null>(null);
  const { datos, error } = useDatos(() => api.vencimientos(dias), [dias]);
  const veFaltantes = usuario.rol === "PERSONAS" || usuario.rol === "GERENCIA";
  const { datos: faltantes } = useDatos(() => (veFaltantes ? api.faltantes() : Promise.resolve(null)));

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Vencimientos</h1>
          <p className="mt-2 text-basalto-soft">Documentos y contratos que vencen pronto. Personas y la jefatura reciben aviso a los 30, 15 y 5 días.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-basalto-soft">Próximos</span>
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-lg border border-moana-200 bg-white px-3 py-2">
              {[30, 60, 90, 180].map((d) => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </label>
          {usuario.rol === "PERSONAS" && (
            <button
              onClick={async () => {
                const r = await api.revisarVencimientos();
                setRevision(r.avisosCreados ? `Se enviaron ${r.avisosCreados} avisos.` : "No había avisos nuevos que enviar hoy.");
                window.dispatchEvent(new Event("avisos-leidos"));
              }}
              className="text-moana-800 underline underline-offset-4"
            >
              Enviar avisos ahora
            </button>
          )}
        </div>
      </header>
      {revision && <p role="status" className="rounded-lg bg-moana-50 px-4 py-3 text-moana-900">{revision}</p>}
      {error && <Aviso texto={error} />}
      {!datos && !error && <Cargando />}
      {datos && (
        <section aria-label="Vencimientos">
          {datos.items.length === 0 ? (
            <p className="text-basalto-soft">Nada vence en los próximos {dias} días.</p>
          ) : (
            <ul className="divide-y divide-moana-200 border-y border-moana-200">
              {datos.items.map((i) => (
                <li key={i.id} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                  <span className={`tabular font-semibold ${i.diasRestantes < 0 ? "text-toromiro" : i.diasRestantes <= 15 ? "text-basalto" : "text-basalto-soft"}`}>{cuando(i.diasRestantes)}</span>
                  <span>
                    <span className="block font-semibold">
                      {i.que} · {i.nombres} {i.apellidos.split(" ")[0]}
                    </span>
                    <span className="block text-sm text-basalto-soft">
                      {i.sede}, vence el {fechaCorta(i.vence, true)}
                    </span>
                    {i.requiereDecision && <span className="mt-1 inline-block rounded-full bg-liquen-soft px-3 py-0.5 text-sm font-semibold">Requiere decisión: renovar, pasar a indefinido o dejar terminar</span>}
                  </span>
                  {usuario.rol !== "JEFATURA" && (
                    <Link href={`/equipo/${i.trabajadorId}`} className="text-moana-800 underline underline-offset-4">Ver ficha</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {veFaltantes && faltantes && (
        <section aria-labelledby="t-faltantes">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="t-faltantes" className="text-xl font-bold">Carpetas incompletas</h2>
            {usuario.rol === "PERSONAS" && <Link href="/vencimientos/requisitos" className="text-moana-800 underline underline-offset-4">Documentos obligatorios por cargo</Link>}
          </div>
          <p className="mt-2 text-basalto-soft">Un documento vencido cuenta como faltante.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {faltantes.sedes.map((s) => (
              <div key={s.sede} className="rounded-xl bg-white p-4">
                <p className="text-sm text-basalto-soft">{s.sede}</p>
                <p className="mt-1 text-xl font-bold tabular">{s.incompletas} <span className="text-base font-normal text-basalto-soft">de {s.personas}</span></p>
              </div>
            ))}
          </div>
          <ul className="mt-6 divide-y divide-moana-200 border-y border-moana-200">
            {faltantes.personas.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3">
                <Link href={`/equipo/${p.id}`} className="hover:underline">
                  <span className="font-semibold">{p.nombres} {p.apellidos.split(" ")[0]}</span>
                  <span className="text-basalto-soft"> · {p.cargo}, {p.sede}</span>
                </Link>
                <span className="text-sm text-toromiro">Falta: {p.faltan.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
