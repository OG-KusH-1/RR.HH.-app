"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { api, type Rol } from "@/lib/api";
import { useUsuario } from "./sesion";

interface Destino {
  href: string;
  texto: string;
  icono: ReactNode;
  roles?: Rol[];
}

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const destinos: Destino[] = [
  {
    href: "/",
    texto: "Inicio",
    icono: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path {...trazo} d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
      </svg>
    ),
  },
  {
    href: "/mi-ficha",
    texto: "Mi ficha",
    icono: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <circle {...trazo} cx="12" cy="8" r="4" />
        <path {...trazo} d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
  {
    href: "/equipo",
    texto: "Mi equipo",
    roles: ["JEFATURA", "PERSONAS", "GERENCIA", "ADMIN"],
    icono: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <circle {...trazo} cx="9" cy="9" r="3.2" />
        <circle {...trazo} cx="17" cy="10" r="2.5" />
        <path {...trazo} d="M3 19c1-3.2 3.3-5 6-5s5 1.8 6 5M15 15.5c2.6-.4 4.6 1 5.5 3.5" />
      </svg>
    ),
  },
  {
    href: "/empresa",
    texto: "Sedes",
    roles: ["PERSONAS", "GERENCIA", "ADMIN"],
    icono: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path {...trazo} d="M3 20h18M5 20V9l5-3v14M10 20V4l9 4v12" />
      </svg>
    ),
  },
];

export function Navegacion() {
  const usuario = useUsuario();
  const ruta = usePathname();
  const router = useRouter();
  const visibles = destinos
    .filter((d) => !d.roles || d.roles.includes(usuario.rol))
    // Jefaturas ven a su equipo; Personas y Gerencia, a toda la empresa.
    .map((d) => (d.href === "/equipo" && usuario.rol !== "JEFATURA" ? { ...d, texto: "Trabajadores" } : d));

  async function salir() {
    await api.salir().catch(() => undefined);
    router.replace("/ingresar");
  }

  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

  return (
    <>
      {/* Escritorio: riel lateral */}
      <nav aria-label="Principal" className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-moana-900 text-white px-5 py-8">
        <p className="px-3 text-lg font-semibold leading-tight">
          Tangata
          <span className="block text-base font-normal text-moana-200">Portal de Te Moana</span>
        </p>
        <ul className="mt-10 space-y-1">
          {visibles.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                aria-current={activo(d.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 ${activo(d.href) ? "bg-moana-800 text-white" : "text-moana-200 hover:text-white"}`}
              >
                {d.icono}
                {d.texto}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-moana-800 pt-5 px-3">
          <p className="font-semibold">
            {usuario.nombres} {usuario.apellidos.split(" ")[0]}
          </p>
          <p className="text-sm text-moana-200">{usuario.cargo}</p>
          <button onClick={salir} className="mt-4 text-sm text-moana-200 underline underline-offset-4 hover:text-white">
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Celular: barra inferior, al alcance del pulgar */}
      <nav aria-label="Principal" className="lg:hidden fixed inset-x-0 bottom-0 z-10 border-t border-moana-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="flex">
          {visibles.map((d) => (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={activo(d.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-sm ${activo(d.href) ? "text-moana-800 font-semibold" : "text-basalto-soft"}`}
              >
                {d.icono}
                {d.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function BotonSalirMovil() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await api.salir().catch(() => undefined);
        router.replace("/ingresar");
      }}
      className="lg:hidden text-sm text-basalto-soft underline underline-offset-4"
    >
      Cerrar sesión
    </button>
  );
}
