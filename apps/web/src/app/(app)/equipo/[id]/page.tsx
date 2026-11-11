"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { Ficha } from "@/components/ficha";
import { api } from "@/lib/api";

export default function FichaTrabajadorPage() {
  const { id } = useParams<{ id: string }>();
  const { datos, error } = useDatos(() => api.trabajador(id), [id]);
  return (
    <div className="max-w-2xl">
      <Link href="/equipo" className="text-moana-800 underline underline-offset-4">
        Volver al listado
      </Link>
      {error && <div className="mt-6"><Aviso texto={error} /></div>}
      {!datos && !error && <div className="mt-6"><Cargando /></div>}
      {datos && (
        <>
          <h1 className="mt-6 text-2xl lg:text-3xl font-bold">
            {datos.nombres} {datos.apellidos}
          </h1>
          <p className="mt-2 text-basalto-soft">Esta consulta queda registrada, como toda vista de una ficha ajena.</p>
          <div className="mt-8">
            <Ficha t={datos} />
          </div>
        </>
      )}
    </div>
  );
}
