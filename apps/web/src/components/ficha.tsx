import type { Trabajador } from "@/lib/api";
import { antiguedad, CONTRATO, formatearFecha, formatearRut } from "@/lib/formato";

export function Ficha({ t }: { t: Trabajador }) {
  const filas: [string, string][] = [
    ["RUT", formatearRut(t.rut)],
    ["Cargo", t.cargo],
    ["Sede", t.sede],
    ["Fecha de ingreso", formatearFecha(t.fechaIngreso)],
    ["Antigüedad", antiguedad(t.fechaIngreso)],
    ["Contrato", CONTRATO[t.tipoContrato]],
    ["Jornada", `${t.horasSemanales} horas semanales`],
  ];
  if (t.telefono) filas.push(["Teléfono", t.telefono]);
  return (
    <dl className="divide-y divide-moana-200 border-y border-moana-200">
      {filas.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4 py-3.5">
          <dt className="text-basalto-soft">{k}</dt>
          <dd className="font-semibold tabular">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
