"use client";
/**
 * Panel de gerencia (HU-21). Primero lo que pide acción (alertas), después la foto por sede.
 * Las barras son CSS simple: con cinco sedes no hace falta una librería de gráficos.
 */
import Link from "next/link";
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api, type Panel } from "@/lib/api";
import { dias, nombrePeriodo } from "@/lib/formato";

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PanelPage() {
  const [mes, setMes] = useState(mesActual);
  const { datos: p, error } = useDatos(() => api.panel(mes), [mes]);
  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Panel</h1>
          <p className="mt-2 text-basalto-soft">Dotación, ausencias y pendientes de toda la empresa.</p>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-basalto-soft">Mes</span>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-lg border border-moana-200 bg-white px-3 py-2" />
        </label>
      </header>
      {error && <Aviso texto={error} />}
      {!p && !error && <Cargando />}
      {p && <Contenido p={p} />}
    </div>
  );
}

function Contenido({ p }: { p: Panel }) {
  const a = p.alertas;
  const alertas: [number, string, string][] = [
    [a.solicitudesPendientes, `solicitudes por resolver${a.pendientesAtrasadas ? `, ${a.pendientesAtrasadas} con más de 3 días` : ""}`, "/aprobaciones"],
    [a.contratosPorDecidir, "contratos a plazo fijo por decidir", "/vencimientos"],
    [a.vencidos, "documentos vencidos", "/vencimientos"],
    [a.vencimientos30Dias, "vencimientos en los próximos 30 días", "/vencimientos"],
    [a.carpetasIncompletas, "carpetas con documentos faltantes", "/vencimientos"],
    [a.acumulanMasDeDosPeriodos, "personas con más de dos períodos de vacaciones acumulados", "/aprobaciones"],
    [a.solicitudesDatosAbiertas, "solicitudes de datos personales abiertas", "/privacidad"],
  ];
  const activas = alertas.filter(([n]) => n > 0);
  const maxDot = Math.max(...p.porSede.map((s) => s.dotacion), 1);
  const maxTipo = Math.max(...p.ausenciasPorTipo.map((t) => t.dias), 1);

  return (
    <>
      <section aria-labelledby="t-totales" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="t-totales" className="sr-only">Totales</h2>
        <Cifra valor={String(p.totales.dotacion)} etiqueta="personas con contrato vigente" destacada />
        <Cifra valor={String(p.totales.ausentesHoy)} etiqueta="ausentes hoy" />
        <Cifra valor={dias(p.totales.diasAusenciaMes)} etiqueta={`hábiles de ausencia en ${nombrePeriodo(p.periodo)}`} />
        <Cifra valor={dias(Math.round(p.totales.vacacionesAcumuladas))} etiqueta="de vacaciones acumuladas" />
      </section>

      <section aria-labelledby="t-alertas">
        <h2 id="t-alertas" className="text-xl font-bold">Requiere atención</h2>
        {activas.length === 0 ? (
          <p className="mt-4 text-basalto-soft">Nada pendiente. Todo al día.</p>
        ) : (
          <ul className="mt-4 divide-y divide-moana-200 border-y border-moana-200">
            {activas.map(([n, texto, href]) => (
              <li key={texto}>
                <Link href={href} className="flex items-baseline gap-4 py-3.5 hover:bg-white/60">
                  <span className="w-12 text-right text-xl font-bold tabular">{n}</span>
                  <span>{texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="t-sedes">
          <h2 id="t-sedes" className="text-xl font-bold">Por sede</h2>
          <table className="mt-4 w-full text-left">
            <thead className="text-sm text-basalto-soft">
              <tr>
                <th className="py-2 font-normal">Sede</th>
                <th className="py-2 font-normal">Dotación</th>
                <th className="py-2 font-normal text-right">Ausentes hoy</th>
                <th className="py-2 font-normal text-right">Vacaciones acumuladas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-moana-200 border-y border-moana-200">
              {p.porSede.map((s) => (
                <tr key={s.sedeId}>
                  <td className="py-3 pr-3 font-semibold">{s.sede}</td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 rounded-full bg-moana-600" style={{ width: `${(s.dotacion / maxDot) * 6}rem` }} aria-hidden="true" />
                      <span className="tabular">{s.dotacion}</span>
                    </span>
                    {s.plazoFijo > 0 && <span className="block text-sm text-basalto-soft">{s.plazoFijo} a plazo fijo</span>}
                  </td>
                  <td className="py-3 text-right tabular">{s.ausentesHoy}</td>
                  <td className="py-3 text-right tabular">{dias(Math.round(s.vacacionesAcumuladas))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="t-tipos">
          <h2 id="t-tipos" className="text-xl font-bold">Ausencias del mes por tipo</h2>
          {p.ausenciasPorTipo.length === 0 ? (
            <p className="mt-4 text-basalto-soft">Sin ausencias aprobadas este mes.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {p.ausenciasPorTipo.map((t) => (
                <li key={t.tipo}>
                  <p className="flex justify-between gap-2">
                    <span>{t.tipo}</span>
                    <span className="tabular font-semibold">{dias(t.dias)}</span>
                  </p>
                  <span className="mt-1 block h-2.5 rounded-full bg-moana-600" style={{ width: `${(t.dias / maxTipo) * 100}%` }} aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-basalto-soft">Días hábiles dentro del mes. No incluye diagnósticos: solo cantidades.</p>
        </section>
      </div>
    </>
  );
}

function Cifra({ valor, etiqueta, destacada }: { valor: string; etiqueta: string; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${destacada ? "bg-moana-800 text-white" : "bg-white"}`}>
      <p className="text-2xl font-bold tabular">{valor}</p>
      <p className={destacada ? "text-moana-200" : "text-basalto-soft"}>{etiqueta}</p>
    </div>
  );
}
