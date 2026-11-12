"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api, type Trabajador } from "@/lib/api";
import { antiguedad } from "@/lib/formato";

export default function EquipoPage() {
  const usuario = useUsuario();
  const { datos, error } = useDatos(api.trabajadores);
  const [busqueda, setBusqueda] = useState("");
  const esJefatura = usuario.rol === "JEFATURA";

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (datos ?? [])
      .filter((t) => t.id !== usuario.trabajadorId)
      .filter((t) => !q || `${t.nombres} ${t.apellidos} ${t.cargo} ${t.sede}`.toLowerCase().includes(q));
  }, [datos, busqueda, usuario.trabajadorId]);

  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-bold">{esJefatura ? "Mi equipo" : "Trabajadores"}</h1>
      <p className="mt-2 text-basalto-soft">
        {esJefatura ? "Las personas que te reportan directamente." : "Todas las personas activas de la empresa."}
      </p>

      {usuario.rol === "PERSONAS" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/equipo/nueva" className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white hover:bg-moana-900">Nueva ficha</Link>
          <Link href="/equipo/importar" className="rounded-lg border border-moana-800 px-5 py-2.5 font-semibold text-moana-800 hover:bg-moana-50">Cargar desde planilla</Link>
        </div>
      )}

      <label htmlFor="buscar" className="sr-only">
        Buscar por nombre, cargo o sede
      </label>
      <input
        id="buscar"
        type="search"
        placeholder="Buscar por nombre, cargo o sede"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="mt-8 w-full max-w-md rounded-lg border-2 border-moana-200 bg-white px-4 py-3 focus:border-moana-800 focus:outline-none"
      />

      <div className="mt-6">
        {error && <Aviso texto={error} />}
        {!datos && !error && <Cargando />}
        {datos && filtrados.length === 0 && (
          <p className="text-basalto-soft">{busqueda ? `Nadie coincide con "${busqueda}". Prueba con otro nombre o cargo.` : "Aún no tienes personas a cargo."}</p>
        )}
        {filtrados.length > 0 &&
          agrupar(filtrados, esJefatura).map(([sede, personas]) => (
            <section key={sede} className="mb-10">
              {!esJefatura && (
                <h2 className="mb-2 flex items-baseline justify-between font-bold">
                  {sede}
                  <span className="text-sm font-normal text-basalto-soft tabular">{personas.length}</span>
                </h2>
              )}
              <ul className="divide-y divide-moana-200 border-y border-moana-200">
                {personas.map((t) => (
                  <li key={t.id}>
                    <Link href={`/equipo/${t.id}`} className="-mx-3 grid grid-cols-1 gap-1 rounded-lg px-3 py-4 hover:bg-white/60 sm:grid-cols-[1fr_1fr_9rem] sm:items-center sm:gap-6">
                      <span className="font-semibold">
                        {t.nombres} {t.apellidos}
                      </span>
                      <span className="text-basalto-soft">{t.cargo}</span>
                      <span className="text-sm text-basalto-soft sm:text-right">{antiguedad(t.fechaIngreso)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        {datos && filtrados.length > 0 && <p className="text-sm text-basalto-soft tabular">{filtrados.length} personas en total</p>}
      </div>
    </div>
  );
}

function agrupar(lista: Trabajador[], todoJunto: boolean): [string, Trabajador[]][] {
  if (todoJunto) return [["equipo", lista]];
  const grupos = new Map<string, Trabajador[]>();
  for (const t of lista) grupos.set(t.sede, [...(grupos.get(t.sede) ?? []), t]);
  return [...grupos.entries()];
}
