"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Rol } from "@/lib/api";
import { useUsuario } from "./sesion";

interface Destino {
  href: string;
  texto: string;
  icono: ReactNode;
  roles?: Rol[];
}

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Ícono de línea a partir de uno o más trazados SVG. */
function icono(...d: string[]) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      {d.map((x) => (
        <path key={x} {...trazo} d={x} />
      ))}
    </svg>
  );
}

const TODOS: Rol[] = ["TRABAJADOR", "JEFATURA", "PERSONAS", "GERENCIA", "ADMIN"];
const GESTION: Rol[] = ["PERSONAS", "GERENCIA", "ADMIN"];

/**
 * Destinos del menú. `movil` marca los que van en la barra inferior del celular;
 * el resto queda en "Más", porque a 360 px caben cuatro botones cómodos para el pulgar.
 */
export const destinos: (Destino & { movil?: boolean; grupo: string })[] = [
  { href: "/", texto: "Inicio", grupo: "Personal", movil: true, icono: icono("M4 11l8-7 8 7v9h-5v-6H9v6H4z") },
  { href: "/vacaciones", texto: "Vacaciones", grupo: "Personal", movil: true, icono: icono("M4 20h16", "M12 4v16", "M12 4c-4 0-7 2.5-8 6h16c-1-3.5-4-6-8-6z") },
  { href: "/mi-ficha", texto: "Mi ficha", grupo: "Personal", icono: icono("M12 12a4 4 0 100-8 4 4 0 000 8z", "M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6") },
  { href: "/avisos", texto: "Avisos", grupo: "Personal", movil: true, icono: icono("M6 16V11a6 6 0 1112 0v5l1.5 2h-15z", "M10 20.5a2 2 0 004 0") },
  { href: "/aprobaciones", texto: "Aprobaciones", grupo: "Equipo", roles: ["JEFATURA", "PERSONAS", "GERENCIA"], icono: icono("M5 12l4 4 10-10", "M4 20h16") },
  { href: "/calendario", texto: "Calendario", grupo: "Equipo", roles: TODOS, icono: icono("M4 6h16v14H4z", "M4 10h16", "M8 3v4M16 3v4") },
  { href: "/equipo", texto: "Mi equipo", grupo: "Equipo", roles: ["JEFATURA", ...GESTION], icono: icono("M9 12.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z", "M3 19c1-3.2 3.3-5 6-5s5 1.8 6 5M15 15.5c2.6-.4 4.6 1 5.5 3.5", "M17 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z") },
  { href: "/indicadores", texto: "Indicadores", grupo: "Empresa", roles: GESTION, icono: icono("M4 19h16M7 16V10M12 16V5M17 16v-4") },
  { href: "/empresa", texto: "Sedes", grupo: "Empresa", roles: GESTION, icono: icono("M3 20h18M5 20V9l5-3v14M10 20V4l9 4v12") },
];

/** Cantidad de avisos sin leer. Se refresca cada minuto y cuando la página de avisos marca alguno. */
function useNoLeidos() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let vigente = true;
    const cargar = () => api.avisosNoLeidos().then((r) => vigente && setTotal(r.total)).catch(() => undefined);
    cargar();
    const intervalo = setInterval(cargar, 60_000);
    window.addEventListener("avisos-leidos", cargar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener("avisos-leidos", cargar);
    };
  }, []);
  return total;
}

function Insignia({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-auto min-w-6 rounded-full bg-liquen px-1.5 text-center text-sm font-bold text-basalto tabular" aria-label={`${n} sin leer`}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

export function useDestinosVisibles() {
  const usuario = useUsuario();
  return destinos
    .filter((d) => !d.roles || d.roles.includes(usuario.rol))
    // Jefaturas ven a su equipo; Personas y Gerencia, a toda la empresa.
    .map((d) => (d.href === "/equipo" && usuario.rol !== "JEFATURA" ? { ...d, texto: "Trabajadores" } : d));
}

export function Navegacion() {
  const usuario = useUsuario();
  const ruta = usePathname();
  const router = useRouter();
  const visibles = useDestinosVisibles();
  const noLeidos = useNoLeidos();
  const grupos = [...new Set(visibles.map((d) => d.grupo))];
  const enBarra = visibles.filter((d) => d.movil);

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
        <div className="mt-8 space-y-6 overflow-y-auto">
          {grupos.map((g) => (
            <div key={g}>
              {grupos.length > 1 && <p className="px-3 text-sm text-moana-200/80">{g}</p>}
              <ul className="mt-1 space-y-0.5">
                {visibles
                  .filter((d) => d.grupo === g)
                  .map((d) => (
                    <li key={d.href}>
                      <Link
                        href={d.href}
                        aria-current={activo(d.href) ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${activo(d.href) ? "bg-moana-800 text-white" : "text-moana-200 hover:text-white"}`}
                      >
                        {d.icono}
                        {d.texto}
                        {d.href === "/avisos" && <Insignia n={noLeidos} />}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-auto border-t border-moana-800 pt-5 px-3 shrink-0">
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
          {[...enBarra, { href: "/mas", texto: "Más", icono: icono("M5 7h14M5 12h14M5 17h14") }].map((d) => (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={activo(d.href) ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-sm ${activo(d.href) ? "text-moana-800 font-semibold" : "text-basalto-soft"}`}
              >
                {d.icono}
                {d.texto}
                {d.href === "/avisos" && noLeidos > 0 && <span className="absolute top-1.5 left-1/2 ml-2 size-2.5 rounded-full bg-liquen" aria-label={`${noLeidos} sin leer`} />}
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
