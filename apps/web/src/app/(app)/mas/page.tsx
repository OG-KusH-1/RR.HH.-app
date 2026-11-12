"use client";
/** Menú completo para el celular: la barra inferior solo muestra los destinos más usados. */
import Link from "next/link";
import { BotonSalirMovil, useDestinosVisibles } from "@/components/navegacion";
import { useUsuario } from "@/components/sesion";

export default function MasPage() {
  const usuario = useUsuario();
  const visibles = useDestinosVisibles();
  const grupos = [...new Set(visibles.map((d) => d.grupo))];
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">Menú</h1>
      <p className="mt-2 text-basalto-soft">
        {usuario.nombres} {usuario.apellidos.split(" ")[0]}, {usuario.cargo}
      </p>
      {grupos.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="text-sm text-basalto-soft">{g}</h2>
          <ul className="mt-2 divide-y divide-moana-200 border-y border-moana-200">
            {visibles
              .filter((d) => d.grupo === g)
              .map((d) => (
                <li key={d.href}>
                  <Link href={d.href} className="flex items-center gap-3 py-3.5 text-lg">
                    {d.icono}
                    {d.texto}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <div className="mt-10">
        <BotonSalirMovil />
      </div>
    </div>
  );
}
