"use client";
import Link from "next/link";
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api } from "@/lib/api";
import { haceCuanto } from "@/lib/formato";

export default function AvisosPage() {
  const [version, setVersion] = useState(0);
  const { datos, error } = useDatos(api.avisos, [version]);
  const hayNoLeidos = datos?.some((a) => !a.leidaEn);

  return (
    <div className="max-w-2xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold">Avisos</h1>
        {hayNoLeidos && (
          <button
            onClick={async () => {
              await api.leerTodos();
              setVersion((v) => v + 1);
              window.dispatchEvent(new Event("avisos-leidos"));
            }}
            className="text-moana-800 underline underline-offset-4"
          >
            Marcar todos como leídos
          </button>
        )}
      </header>
      <div className="mt-8">
        {error && <Aviso texto={error} />}
        {!datos && !error && <Cargando />}
        {datos && datos.length === 0 && <p className="text-basalto-soft">No tienes avisos. Aquí llegarán las respuestas a tus solicitudes y los vencimientos.</p>}
        {datos && datos.length > 0 && (
          <ul className="divide-y divide-moana-200 border-y border-moana-200">
            {datos.map((a) => {
              const contenido = (
                <>
                  <span className="flex items-start gap-3">
                    {!a.leidaEn && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-liquen" aria-label="No leído" />}
                    <span>
                      <span className={`block ${a.leidaEn ? "" : "font-semibold"}`}>{a.titulo}</span>
                      <span className="block text-basalto-soft">{a.mensaje}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-basalto-soft">{haceCuanto(a.creadaEn)}</span>
                </>
              );
              const clase = "flex justify-between gap-4 py-4";
              const marcar = () => {
                if (!a.leidaEn) api.leerAviso(a.id).then(() => window.dispatchEvent(new Event("avisos-leidos")));
              };
              return (
                <li key={a.id}>
                  {a.enlace ? (
                    <Link href={a.enlace} onClick={marcar} className={`${clase} hover:bg-white/60`}>
                      {contenido}
                    </Link>
                  ) : (
                    <div className={clase}>{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
