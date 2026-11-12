"use client";
/**
 * Archivo mensual de novedades para el contador (HU-22): lo que cambió en el mes, listo para
 * descargar en CSV y enviar. Reemplaza el mensaje de fin de mes "¿quién tuvo licencia?".
 */
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api } from "@/lib/api";
import { nombrePeriodo } from "@/lib/formato";

function mesAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function NovedadesPage() {
  const [mes, setMes] = useState(mesAnterior);
  const { datos, error } = useDatos(() => api.novedades(mes), [mes]);
  const columnas: [keyof NonNullable<typeof datos>["filas"][number], string][] = [
    ["vacaciones", "Vacaciones"],
    ["permisoConGoce", "Permiso con goce"],
    ["permisoSinGoce", "Permiso sin goce"],
    ["permisoLegal", "Permiso legal"],
    ["licenciaDiasCorridos", "Licencia (corridos)"],
    ["horasSobreJornada", "Horas sobre jornada"],
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Novedades del mes</h1>
          <p className="mt-2 max-w-[60ch] text-basalto-soft">Para el contador: ingresos, salidas, vacaciones y permisos en días hábiles, licencias en días corridos y horas sobre la jornada según los turnos publicados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="month" aria-label="Mes" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-lg border border-moana-200 bg-white px-3 py-2" />
          <a href={`/api/novedades?mes=${mes}&formato=csv`} className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white">Descargar CSV</a>
        </div>
      </header>
      {error && <Aviso texto={error} />}
      {!datos && !error && <Cargando />}
      {datos && datos.filas.length === 0 && <p className="text-basalto-soft">Sin novedades en {nombrePeriodo(mes)}.</p>}
      {datos && datos.filas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left">
            <thead className="text-sm text-basalto-soft">
              <tr>
                <th className="py-2 pr-3 font-normal">Persona</th>
                <th className="py-2 pr-3 font-normal">Ingreso o salida</th>
                {columnas.map(([, t]) => <th key={t} className="py-2 pr-3 text-right font-normal">{t}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-moana-200 border-y border-moana-200">
              {datos.filas.map((f) => (
                <tr key={f.rut}>
                  <td className="py-3 pr-3"><span className="font-semibold">{f.nombre}</span><span className="block text-sm text-basalto-soft">{f.sede}</span></td>
                  <td className="py-3 pr-3 text-sm">{f.ingreso && `Ingresó el ${f.ingreso}`}{f.salida && `Salió el ${f.salida}`}</td>
                  {columnas.map(([k]) => <td key={k} className="py-3 pr-3 text-right tabular">{Number(f[k]) ? Number(f[k]).toLocaleString("es-CL") : <span className="text-basalto-soft/50">0</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-basalto-soft">Las horas sobre jornada son una estimación desde los turnos, no un registro de asistencia. El control de asistencia válido ante la Dirección del Trabajo requiere un sistema certificado.</p>
    </div>
  );
}
