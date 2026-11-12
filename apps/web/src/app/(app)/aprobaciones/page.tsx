"use client";
/**
 * Bandeja de la jefatura (y de Personas y Gerencia como respaldo).
 * La API ya filtra por equipo: aquí solo se ordena y presenta.
 */
import Link from "next/link";
import { ListaSolicitudes } from "@/components/ausencias";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api } from "@/lib/api";
import { dias } from "@/lib/formato";

export default function AprobacionesPage() {
  const usuario = useUsuario();
  const ambito = usuario.rol === "JEFATURA" ? "equipo" : "todas";
  const { datos: solicitudes, error } = useDatos(() => api.solicitudes(ambito));
  const { datos: saldos } = useDatos(api.saldosEquipo);
  const pendientes = solicitudes?.filter((s) => s.estado === "PENDIENTE") ?? [];
  const resueltas = solicitudes?.filter((s) => s.estado !== "PENDIENTE").slice(0, 15) ?? [];

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold">Aprobaciones</h1>
        <p className="mt-2 text-basalto-soft">
          {usuario.rol === "JEFATURA" ? "Solicitudes de tu equipo." : "Solicitudes de toda la empresa. Resuelve las de quienes no tienen jefatura o cuando la jefatura no está."}{" "}
          <Link href="/calendario" className="text-moana-800 underline underline-offset-4">
            Ver calendario
          </Link>
        </p>
      </header>

      {error && <Aviso texto={error} />}

      <section aria-labelledby="t-pendientes">
        <h2 id="t-pendientes" className="text-xl font-bold">
          Por resolver <span className="tabular text-basalto-soft">({pendientes.length})</span>
        </h2>
        <div className="mt-5">{solicitudes ? <ListaSolicitudes solicitudes={pendientes} mostrarNombre vacio="No hay solicitudes pendientes." /> : <Cargando />}</div>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="t-resueltas">
          <h2 id="t-resueltas" className="text-xl font-bold">
            Resueltas hace poco
          </h2>
          <div className="mt-5">{solicitudes && <ListaSolicitudes solicitudes={resueltas} mostrarNombre vacio="Sin solicitudes resueltas." />}</div>
        </section>

        <section aria-labelledby="t-saldos">
          <h2 id="t-saldos" className="text-xl font-bold">
            Saldos de vacaciones
          </h2>
          {saldos ? (
            <table className="mt-5 w-full text-left">
              <thead className="text-sm text-basalto-soft">
                <tr>
                  <th className="py-2 font-normal">Persona</th>
                  <th className="py-2 font-normal text-right">Disponibles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-moana-200 border-y border-moana-200">
                {saldos.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3">
                      <Link href={`/equipo/${s.id}`} className="hover:underline">
                        {s.nombres} {s.apellidos.split(" ")[0]}
                      </Link>
                      {ambito === "todas" && <span className="block text-sm text-basalto-soft">{s.sede}</span>}
                    </td>
                    <td className="py-3 text-right tabular">
                      {dias(s.disponible)}
                      {s.excedeAcumulacion && <span className="block text-sm text-toromiro">Acumula más de 2 períodos</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Cargando />
          )}
        </section>
      </div>
    </div>
  );
}
