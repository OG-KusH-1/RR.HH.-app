"use client";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { Dotacion } from "@/components/dotacion";
import { api } from "@/lib/api";

export default function EmpresaPage() {
  const { datos, error } = useDatos(api.resumen);
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl lg:text-3xl font-bold">Sedes</h1>
      <p className="mt-2 text-basalto-soft">Personas activas en cada sede de Te Moana.</p>
      <div className="mt-10">{error ? <Aviso texto={error} /> : datos ? <Dotacion sedes={datos} /> : <Cargando />}</div>
    </div>
  );
}
