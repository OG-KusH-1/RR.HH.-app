"use client";
import Link from "next/link";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { Dotacion } from "@/components/dotacion";
import { BotonSalirMovil } from "@/components/navegacion";
import { useUsuario } from "@/components/sesion";
import { api } from "@/lib/api";
import { horaEn, saludo } from "@/lib/formato";
import { useReloj } from "@/lib/use-reloj";

const proximos = [
  ["Pedir vacaciones", "Verás tu saldo y tu jefatura aprobará desde su celular."],
  ["Tus documentos", "Contrato y anexos para descargar cuando los necesites."],
  ["Certificado de antigüedad", "Listo en segundos, con código de verificación."],
];

export default function InicioPage() {
  const usuario = useUsuario();
  const ahora = useReloj();
  const { datos: equipo, error } = useDatos(api.trabajadores);
  const veResumen = ["PERSONAS", "GERENCIA", "ADMIN"].includes(usuario.rol);
  const { datos: resumen } = useDatos(() => (veResumen ? api.resumen() : Promise.resolve(null)));

  const propio = equipo?.find((t) => t.id === usuario.trabajadorId);
  const zona = propio?.zonaHoraria ?? "America/Santiago";
  const aCargo = equipo?.filter((t) => t.jefaturaId === usuario.trabajadorId).length ?? 0;

  return (
    <div className="space-y-14">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight">
            {ahora ? saludo(zona, ahora) : "Hola"}, {usuario.nombres}
          </h1>
          {propio && (
            <p className="mt-2 text-lg text-basalto-soft">
              {usuario.cargo} en {propio.sede}. En tu sede son las <span className="tabular">{ahora ? horaEn(zona, ahora) : "--:--"}</span>.
            </p>
          )}
        </div>
        <BotonSalirMovil />
      </header>

      {error && <Aviso texto={error} />}

      {usuario.rol === "JEFATURA" && equipo && (
        <section aria-labelledby="t-equipo" className="rounded-2xl bg-moana-800 p-6 lg:p-8 text-white">
          <h2 id="t-equipo" className="text-lg text-moana-200">
            Tu equipo
          </h2>
          <p className="mt-1 text-3xl font-bold tabular">{aCargo} personas</p>
          <Link href="/equipo" className="mt-6 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-moana-900 hover:bg-moana-50">
            Ver mi equipo
          </Link>
        </section>
      )}

      {veResumen && (
        <section aria-labelledby="t-dotacion">
          <h2 id="t-dotacion" className="text-xl font-bold">
            Dotación por sede
          </h2>
          <div className="mt-5">{resumen ? <Dotacion sedes={resumen} /> : <Cargando />}</div>
        </section>
      )}

      <section aria-labelledby="t-pronto" className="border-t border-moana-200 pt-8">
        <h2 id="t-pronto" className="text-xl font-bold">
          Llega en las próximas semanas
        </h2>
        <ul className="mt-5 grid gap-6 sm:grid-cols-3">
          {proximos.map(([titulo, texto]) => (
            <li key={titulo}>
              <p className="font-semibold">{titulo}</p>
              <p className="mt-1 text-basalto-soft">{texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
