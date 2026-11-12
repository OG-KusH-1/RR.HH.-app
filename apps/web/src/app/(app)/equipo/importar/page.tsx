"use client";
/**
 * Carga inicial desde planilla (HU-07). Dos pasos: revisar y confirmar.
 * Si una sola fila tiene error no se carga nada; se muestran todas las filas con problema.
 */
import Link from "next/link";
import { useState } from "react";
import { api, ApiError, type ResultadoImportacion } from "@/lib/api";

const PLANTILLA = [
  "rut;nombres;apellidos;cargo;sede;fecha_ingreso;tipo_contrato;horas_semanales;rut_jefatura;telefono;email;fecha_termino_contrato;saldo_vacaciones",
  "11.111.111-1;Ana María;Pérez Soto;Cajera;Minimarket Tahai;01-03-2021;indefinido;42;;+56 9 1111 1111;;;12,5",
  "22.222.222-2;Luis;Rapu Hey;Reponedor;Minimarket Tahai;15-06-2026;plazo fijo;30;11.111.111-1;;;15-12-2026;",
].join("\n");

export default function ImportarPage() {
  const [contenido, setContenido] = useState("");
  const [nombre, setNombre] = useState<string | null>(null);
  const [r, setR] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function procesar(confirmar: boolean) {
    setError(null);
    setOcupado(true);
    try {
      setR(await api.importar(contenido, confirmar));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo procesar la planilla.");
    } finally {
      setOcupado(false);
    }
  }

  const descargarPlantilla = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + PLANTILLA], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "plantilla-trabajadores.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl">
      <Link href="/equipo" className="text-moana-800 underline underline-offset-4">Volver</Link>
      <h1 className="mt-6 text-2xl lg:text-3xl font-bold">Cargar trabajadores desde planilla</h1>
      <p className="mt-2 text-basalto-soft">
        Guarda tu Excel como CSV y súbelo. Primero se revisa todo; si una fila tiene error no se carga nada, para que no quede una carga a medias.{" "}
        <button onClick={descargarPlantilla} className="text-moana-800 underline underline-offset-4">Descargar plantilla</button>
      </p>

      {r?.cargados ? (
        <div className="mt-8 rounded-xl bg-moana-50 p-6">
          <p className="text-xl font-bold">Se cargaron {r.cargados} personas.</p>
          <p className="mt-2">Ahora genera sus invitaciones desde cada ficha para que creen su contraseña.</p>
          <Link href="/equipo" className="mt-4 inline-block rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white">Ver trabajadores</Link>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <label htmlFor="archivo" className="block font-semibold">Archivo CSV</label>
            <input
              id="archivo"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setNombre(f.name);
                setContenido(await f.text());
                setR(null);
              }}
              className="mt-2"
            />
          </div>
          {nombre && (
            <button onClick={() => procesar(false)} disabled={ocupado} className="mt-6 rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white disabled:opacity-50">
              {ocupado ? "Revisando…" : `Revisar ${nombre}`}
            </button>
          )}
          {error && <p role="alert" className="mt-6 rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{error}</p>}

          {r && r.errores.length > 0 && (
            <section className="mt-8" aria-labelledby="t-err">
              <h2 id="t-err" className="text-xl font-bold text-toromiro">{r.errores.length} filas con problemas</h2>
              <p className="mt-1 text-basalto-soft">Corrígelas en tu planilla y vuelve a subirla. No se cargó nada.</p>
              <ul className="mt-4 divide-y divide-moana-200 border-y border-moana-200">
                {r.errores.map((e) => (
                  <li key={`${e.fila}-${e.mensaje}`} className="grid grid-cols-[5rem_1fr] gap-3 py-3">
                    <span className="font-semibold tabular">Fila {e.fila}</span>
                    <span>{e.mensaje}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r && r.errores.length === 0 && r.validas > 0 && (
            <section className="mt-8" aria-labelledby="t-ok">
              <h2 id="t-ok" className="text-xl font-bold">Todo en orden: {r.validas} personas listas para cargar</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-basalto-soft"><tr><th className="py-2 pr-3 font-normal">Fila</th><th className="py-2 pr-3 font-normal">RUT</th><th className="py-2 pr-3 font-normal">Nombre</th><th className="py-2 pr-3 font-normal">Cargo</th><th className="py-2 pr-3 font-normal">Sede</th><th className="py-2 font-normal text-right">Saldo vacaciones</th></tr></thead>
                  <tbody className="divide-y divide-moana-200 border-y border-moana-200">
                    {r.vista.map((v) => (
                      <tr key={v.rut}><td className="py-2 pr-3 tabular">{v.fila}</td><td className="py-2 pr-3 tabular">{v.rut}</td><td className="py-2 pr-3">{v.nombre}</td><td className="py-2 pr-3">{v.cargo}</td><td className="py-2 pr-3">{v.sede}</td><td className="py-2 text-right tabular">{v.saldoVacaciones ?? "Se calcula"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => procesar(true)} disabled={ocupado} className="mt-6 rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white disabled:opacity-50">Confirmar y cargar {r.validas} personas</button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
