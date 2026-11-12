"use client";
import Link from "next/link";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { Dotacion } from "@/components/dotacion";
import { BotonSalirMovil } from "@/components/navegacion";
import { useUsuario } from "@/components/sesion";
import { api } from "@/lib/api";
import { dias, horaEn, saludo } from "@/lib/formato";
import { useReloj } from "@/lib/use-reloj";

const accesos: [string, string, string][] = [
  ["/vacaciones", "Pedir vacaciones", "Tu saldo al día y la respuesta de tu jefatura en el celular."],
  ["/documentos", "Mis documentos", "Contrato, anexos y certificados para descargar."],
  ["/certificados", "Certificado de antigüedad", "Listo en segundos, con código de verificación."],
];

export default function InicioPage() {
  const usuario = useUsuario();
  const ahora = useReloj();
  const { datos: equipo, error } = useDatos(api.trabajadores);
  const veResumen = ["PERSONAS", "GERENCIA", "ADMIN"].includes(usuario.rol);
  const { datos: resumen } = useDatos(() => (veResumen ? api.resumen() : Promise.resolve(null)));
  const { datos: saldo } = useDatos(api.miSaldo);
  const { datos: pendientes } = useDatos(() => (usuario.rol === "JEFATURA" ? api.solicitudes("equipo", "PENDIENTE") : Promise.resolve(null)));

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
          {pendientes && (
            <p className="mt-2 text-moana-200">
              {pendientes.length === 0 ? "No hay solicitudes por resolver." : `${pendientes.length} ${pendientes.length === 1 ? "solicitud espera" : "solicitudes esperan"} tu respuesta.`}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {pendientes && pendientes.length > 0 && (
              <Link href="/aprobaciones" className="inline-block rounded-lg bg-liquen px-5 py-3 font-semibold text-basalto hover:bg-liquen-soft">
                Resolver solicitudes
              </Link>
            )}
            <Link href="/equipo" className="inline-block rounded-lg bg-white px-5 py-3 font-semibold text-moana-900 hover:bg-moana-50">
              Ver mi equipo
            </Link>
          </div>
        </section>
      )}

      {veResumen && (
        <p>
          <Link href="/panel" className="rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white hover:bg-moana-900">
            Abrir el panel de la empresa
          </Link>
        </p>
      )}

      {veResumen && (
        <section aria-labelledby="t-dotacion">
          <h2 id="t-dotacion" className="text-xl font-bold">
            Dotación por sede
          </h2>
          <div className="mt-5">{resumen ? <Dotacion sedes={resumen} /> : <Cargando />}</div>
        </section>
      )}

      <section aria-labelledby="t-accesos" className="border-t border-moana-200 pt-8">
        <h2 id="t-accesos" className="text-xl font-bold">
          Lo que puedes hacer aquí
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {accesos.map(([href, titulo, texto]) => (
            <li key={href}>
              <Link href={href} className="block h-full rounded-xl bg-white p-5 hover:ring-2 hover:ring-moana-200">
                <p className="font-semibold">{titulo}</p>
                {href === "/vacaciones" && saldo && <p className="mt-1 text-2xl font-bold tabular">{dias(saldo.disponible)} disponibles</p>}
                <p className="mt-1 text-basalto-soft">{texto}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
