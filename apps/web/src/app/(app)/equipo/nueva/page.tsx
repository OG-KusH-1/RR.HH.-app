"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { EditorFicha } from "@/components/editor-ficha";
import { api } from "@/lib/api";

export default function NuevaFichaPage() {
  const router = useRouter();
  const { datos, error } = useDatos(api.opcionesFicha);
  return (
    <div className="max-w-3xl">
      <Link href="/equipo" className="text-moana-800 underline underline-offset-4">Volver</Link>
      <h1 className="mt-6 text-2xl lg:text-3xl font-bold">Nueva ficha</h1>
      <p className="mt-2 text-basalto-soft">
        Al guardar se crea su usuario en el portal. Luego, desde la ficha, genera la invitación para que cree su contraseña. ¿Son muchas personas?{" "}
        <Link href="/equipo/importar" className="text-moana-800 underline underline-offset-4">Cárgalas desde una planilla</Link>.
      </p>
      <div className="mt-8">{error ? <Aviso texto={error} /> : datos ? <EditorFicha opciones={datos} alGuardar={(id) => router.push(`/equipo/${id}`)} /> : <Cargando />}</div>
    </div>
  );
}
