"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

/** Carga datos de la API con estados de carga y error. */
export function useDatos<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    cargar()
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e instanceof ApiError && e.status === 404 ? "No encontramos esa ficha o no tienes acceso a ella." : "No se pudieron cargar los datos. Vuelve a cargar la página."));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { datos, error };
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <p className="text-basalto-soft" aria-busy="true">{texto}</p>;
}

export function Aviso({ texto }: { texto: string }) {
  return <p role="alert" className="rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{texto}</p>;
}
