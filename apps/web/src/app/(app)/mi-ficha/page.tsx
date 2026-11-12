"use client";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { Ficha } from "@/components/ficha";
import { Prevision } from "@/components/prevision";
import { useUsuario } from "@/components/sesion";
import { api } from "@/lib/api";

export default function MiFichaPage() {
  const usuario = useUsuario();
  const { datos, error } = useDatos(() => api.trabajador(usuario.trabajadorId));
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl lg:text-3xl font-bold">Mi ficha</h1>
      <p className="mt-2 text-basalto-soft">Si algún dato está mal, avísale a Personas para corregirlo.</p>
      <div className="mt-8">
        {error ? <Aviso texto={error} /> : datos ? (
          <>
            <Ficha t={datos} />
            <Prevision t={datos} editable={false} />
          </>
        ) : (
          <Cargando />
        )}
      </div>
    </div>
  );
}
