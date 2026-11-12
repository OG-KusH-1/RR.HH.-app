"use client";
/**
 * Calendario de ausencias del mes (HU-13).
 *
 * En escritorio es una grilla de lunes a domingo; en celular, una lista por día, porque
 * siete columnas no caben a 360 px. Las pendientes se distinguen con borde discontinuo
 * además del color, para no depender solo del color.
 */
import Link from "next/link";
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api, type AusenciaCalendario, type Calendario } from "@/lib/api";
import { nombrePeriodo } from "@/lib/formato";

function mesDe(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  return mesDe(new Date(a, m - 1 + delta, 1));
}

function diasDelMes(cal: Calendario): string[] {
  const fin = Number(cal.hasta.slice(8));
  return Array.from({ length: fin }, (_, i) => `${cal.mes}-${String(i + 1).padStart(2, "0")}`);
}

function ausentesEl(cal: Calendario, fecha: string): AusenciaCalendario[] {
  return cal.ausencias.filter((a) => a.desde <= fecha && a.hasta >= fecha);
}

const SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export default function CalendarioPage() {
  const usuario = useUsuario();
  const [mes, setMes] = useState(() => mesDe(new Date()));
  const [sedeId, setSedeId] = useState("");
  const { datos: cal, error } = useDatos(() => api.calendario(mes, sedeId || undefined), [mes, sedeId]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Calendario</h1>
          <p className="mt-2 text-basalto-soft">
            {usuario.rol === "TRABAJADOR" ? "Tus ausencias del mes." : usuario.rol === "JEFATURA" ? "Ausencias aprobadas y pendientes de tu equipo." : "Ausencias de la empresa."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {cal && cal.sedes.length > 0 && (
            <select aria-label="Sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="rounded-lg border border-moana-200 bg-white px-3 py-2.5">
              <option value="">Todas las sedes</option>
              {cal.sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setMes((m) => moverMes(m, -1))} aria-label="Mes anterior" className="rounded-lg px-3 py-2 hover:bg-white">
              ‹
            </button>
            <p className="min-w-44 text-center text-lg font-semibold">{nombrePeriodo(mes).replace(/^./, (c) => c.toUpperCase())}</p>
            <button onClick={() => setMes((m) => moverMes(m, 1))} aria-label="Mes siguiente" className="rounded-lg px-3 py-2 hover:bg-white">
              ›
            </button>
          </div>
        </div>
      </header>

      <p className="flex flex-wrap gap-5 text-sm text-basalto-soft">
        <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-sm bg-moana-600" /> Aprobada</span>
        <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-sm border-2 border-dashed border-liquen bg-liquen-soft" /> Pendiente</span>
        <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-sm bg-toromiro-soft" /> Feriado</span>
      </p>

      {error && <Aviso texto={error} />}
      {!cal && !error && <Cargando />}
      {cal && (
        <>
          <Grilla cal={cal} />
          <ListaMovil cal={cal} />
        </>
      )}
    </div>
  );
}

function Chip({ a }: { a: AusenciaCalendario }) {
  const pendiente = a.estado === "PENDIENTE";
  return (
    <Link
      href={`/ausencias/${a.id}`}
      title={`${a.nombres} ${a.apellidos}: ${a.tipo}${pendiente ? " (pendiente)" : ""}`}
      className={`block truncate rounded px-1.5 py-0.5 text-sm ${pendiente ? "border-2 border-dashed border-liquen bg-liquen-soft text-basalto" : "bg-moana-600 text-white"}`}
    >
      {a.nombres} {a.apellidos[0]}.
    </Link>
  );
}

function Grilla({ cal }: { cal: Calendario }) {
  const dias = diasDelMes(cal);
  // Lunes = 0. getUTCDay da domingo = 0.
  const primero = (new Date(`${dias[0]}T00:00:00Z`).getUTCDay() + 6) % 7;
  const celdas: (string | null)[] = [...Array(primero).fill(null), ...dias];
  // Se completa la última semana para que la grilla no quede con un hueco de color.
  while (celdas.length % 7 !== 0) celdas.push(null);
  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-7 gap-px rounded-xl border border-moana-200 bg-moana-200 overflow-hidden">
        {SEMANA.map((d) => (
          <div key={d} className="bg-moana-50 px-2 py-2 text-sm font-semibold text-basalto-soft">
            {d}
          </div>
        ))}
        {celdas.map((f, i) => {
          if (!f) return <div key={`v${i}`} className="bg-rano min-h-28" />;
          const feriado = cal.feriados.find((x) => x.fecha === f);
          const finde = i % 7 >= 5;
          const ausentes = ausentesEl(cal, f);
          return (
            <div key={f} className={`min-h-28 p-1.5 ${feriado ? "bg-toromiro-soft" : finde ? "bg-rano" : "bg-white"}`}>
              <p className={`text-sm tabular ${f === cal.hoy ? "inline-grid size-6 place-items-center rounded-full bg-moana-800 font-bold text-white" : "text-basalto-soft"}`}>{Number(f.slice(8))}</p>
              {feriado && <p className="truncate text-xs text-toromiro" title={feriado.nombre}>{feriado.nombre}</p>}
              <div className="mt-1 space-y-1">
                {ausentes.slice(0, 3).map((a) => (
                  <Chip key={a.id} a={a} />
                ))}
                {ausentes.length > 3 && <p className="text-xs text-basalto-soft">y {ausentes.length - 3} más</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListaMovil({ cal }: { cal: Calendario }) {
  const conAlgo = diasDelMes(cal).filter((f) => ausentesEl(cal, f).length > 0 || cal.feriados.some((x) => x.fecha === f));
  if (conAlgo.length === 0) return <p className="md:hidden text-basalto-soft">No hay ausencias ni feriados este mes.</p>;
  return (
    <ul className="md:hidden divide-y divide-moana-200 border-y border-moana-200">
      {conAlgo.map((f) => {
        const feriado = cal.feriados.find((x) => x.fecha === f);
        const fecha = new Date(`${f}T00:00:00Z`);
        return (
          <li key={f} className="py-3">
            <p className="font-semibold">
              {["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][fecha.getUTCDay()]} {Number(f.slice(8))}
              {feriado && <span className="font-normal text-toromiro">, {feriado.nombre}</span>}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ausentesEl(cal, f).map((a) => (
                <Chip key={a.id} a={a} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
