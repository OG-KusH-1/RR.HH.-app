"use client";
/**
 * Armado de turnos semanal (HU-23) para la jefatura y Personas.
 *
 * Grilla persona × día. Cada celda abre un editor pequeño; al guardar, la API revisa la semana
 * completa de esa persona y responde errores (no guarda) o alertas (guarda y avisa).
 * En celular la grilla se desplaza en horizontal con la columna de nombres fija.
 */
import { useState, type FormEvent } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api, ApiError, type CambioTurno, type SemanaTurnos } from "@/lib/api";
import { fechaCorta } from "@/lib/formato";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}
function moverSemana(lunes: string, semanas: number) {
  const d = new Date(`${lunes}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + semanas * 7);
  return d.toISOString().slice(0, 10);
}

interface Edicion {
  trabajadorId: string;
  nombre: string;
  fecha: string;
  turnoId?: string;
  inicio: string;
  fin: string;
  colacionMin: number;
}

export default function ArmarTurnosPage() {
  const usuario = useUsuario();
  const [fecha, setFecha] = useState(hoy);
  const [sedeId, setSedeId] = useState("");
  const [version, setVersion] = useState(0);
  const { datos: s, error } = useDatos(() => api.semanaTurnos(fecha, sedeId || undefined), [fecha, sedeId, version]);
  const { datos: cambios } = useDatos(api.cambiosTurno, [version]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const recargar = () => setVersion((v) => v + 1);
  const porAprobar = cambios?.filter((c) => c.puedoAprobar) ?? [];

  async function accion(fn: () => Promise<string>) {
    try {
      setMensaje(await fn());
      recargar();
    } catch (e) {
      setMensaje(e instanceof ApiError ? e.message : "No se pudo completar.");
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Armar turnos</h1>
          <p className="mt-2 text-basalto-soft">{usuario.rol === "JEFATURA" ? "Tu equipo, semana a semana." : "Elige la sede y arma la semana."} Las alertas citan la norma; los errores no dejan guardar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {s && s.sedes.length > 0 && (
            <select aria-label="Sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="rounded-lg border border-moana-200 bg-white px-3 py-2.5">
              <option value="">Todas las sedes</option>
              {s.sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          )}
          {s && (
            <div className="flex items-center gap-1">
              <button onClick={() => setFecha(moverSemana(s.lunes, -1))} aria-label="Semana anterior" className="rounded-lg px-3 py-2 hover:bg-white">‹</button>
              <p className="min-w-48 text-center font-semibold">Semana del {fechaCorta(s.lunes)}</p>
              <button onClick={() => setFecha(moverSemana(s.lunes, 1))} aria-label="Semana siguiente" className="rounded-lg px-3 py-2 hover:bg-white">›</button>
            </div>
          )}
        </div>
      </header>

      {porAprobar.length > 0 && <CambiosPorAprobar cambios={porAprobar} alResolver={recargar} />}

      {s && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => accion(async () => { const r = await api.copiarSemana(s.lunes, sedeId || undefined); return `Se copiaron ${r.copiados} turnos de la semana anterior${r.omitidos ? `; ${r.omitidos} se omitieron por ausencias, feriados o turnos ya puestos` : ""}.`; })} className="rounded-lg border border-moana-800 px-4 py-2.5 font-semibold text-moana-800 hover:bg-moana-50">
            Copiar semana anterior
          </button>
          <button disabled={s.sinPublicar === 0} onClick={() => accion(async () => { const r = await api.publicarTurnos(s.lunes, sedeId || undefined); return `Publicados ${r.publicados} turnos. ${r.personas} personas recibieron aviso.`; })} className="rounded-lg bg-moana-800 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
            {s.sinPublicar ? `Publicar ${s.sinPublicar} cambios` : "Todo publicado"}
          </button>
        </div>
      )}
      {mensaje && <p role="status" className="rounded-lg bg-moana-50 px-4 py-3 text-moana-900">{mensaje}</p>}
      {error && <Aviso texto={error} />}
      {!s && !error && <Cargando />}
      {s && <Grilla s={s} alEditar={setEdicion} />}
      {edicion && <EditorTurno e={edicion} alCerrar={(guardado, texto) => { setEdicion(null); if (texto) setMensaje(texto); if (guardado) recargar(); }} />}
    </div>
  );
}

function Grilla({ s, alEditar }: { s: SemanaTurnos; alEditar: (e: Edicion) => void }) {
  if (s.filas.length === 0) return <p className="text-basalto-soft">No hay personas en este equipo o sede.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-moana-200 bg-white">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <thead>
          <tr className="bg-moana-50 text-sm">
            <th className="sticky left-0 z-10 bg-moana-50 px-3 py-2.5 font-semibold">Persona</th>
            {s.dias.map((f) => {
              const feriado = s.feriados.find((x) => x.fecha === f);
              return (
                <th key={f} className={`px-2 py-2.5 font-semibold ${feriado ? "text-toromiro" : ""}`} title={feriado?.nombre}>
                  {fechaCorta(f)}
                  {feriado && <span className="block text-xs font-normal">{feriado.irrenunciable ? "Irrenunciable" : "Feriado"}</span>}
                </th>
              );
            })}
            <th className="px-3 py-2.5 text-right font-semibold">Horas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-moana-200">
          {s.filas.map((fila) => {
            const nombre = `${fila.persona.nombres} ${fila.persona.apellidos.split(" ")[0]}`;
            const alertas = fila.problemas;
            return (
              <tr key={fila.persona.id} className="align-top">
                <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 font-normal">
                  <span className="block font-semibold">{nombre}</span>
                  <span className="block text-sm text-basalto-soft">{fila.persona.cargo}</span>
                  {alertas.map((a, i) => (
                    <span key={i} className={`mt-1 block max-w-56 text-xs ${a.nivel === "error" ? "text-toromiro" : "text-basalto"}`}>
                      {a.fecha ? `${fechaCorta(a.fecha)}: ` : ""}
                      {a.mensaje}
                    </span>
                  ))}
                </th>
                {fila.dias.map((d) => (
                  <td key={d.fecha} className="px-1.5 py-2">
                    {d.ausencia ? (
                      <span className="block rounded bg-rano px-2 py-2 text-center text-sm text-basalto-soft">{d.ausencia}</span>
                    ) : (
                      <button
                        onClick={() => alEditar({ trabajadorId: fila.persona.id, nombre, fecha: d.fecha, turnoId: d.turno?.id, inicio: d.turno?.inicio ?? "08:00", fin: d.turno?.fin ?? "16:30", colacionMin: d.turno?.colacionMin ?? 30 })}
                        aria-label={`${nombre}, ${fechaCorta(d.fecha)}: ${d.turno ? `${d.turno.inicio} a ${d.turno.fin}` : "libre"}. Editar`}
                        className={`block w-full rounded px-2 py-2 text-center text-sm tabular ${d.turno ? (d.turno.publicado ? "bg-moana-600 text-white" : "border-2 border-dashed border-moana-600 bg-moana-50 text-moana-900") : "text-basalto-soft/60 hover:bg-rano"}`}
                      >
                        {d.turno ? <>{d.turno.inicio}<br />{d.turno.fin}</> : "Libre"}
                      </button>
                    )}
                  </td>
                ))}
                <td className={`px-3 py-2 text-right tabular ${fila.horas > fila.persona.horasPactadas ? "font-bold text-toromiro" : ""}`}>
                  {fila.horas.toLocaleString("es-CL")}
                  <span className="block text-xs text-basalto-soft">de {fila.persona.horasPactadas}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-sm text-basalto-soft">Borde discontinuo: cambio sin publicar. La persona no lo ve hasta que publiques.</p>
    </div>
  );
}

function EditorTurno({ e, alCerrar }: { e: Edicion; alCerrar: (guardado: boolean, mensaje?: string) => void }) {
  const [inicio, setInicio] = useState(e.inicio);
  const [fin, setFin] = useState(e.fin);
  const [colacion, setColacion] = useState(e.colacionMin);
  const [error, setError] = useState<string | null>(null);

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    try {
      const r = await api.guardarTurno({ trabajadorId: e.trabajadorId, fecha: e.fecha, inicio, fin, colacionMin: colacion });
      alCerrar(true, r.alertas.length ? `Guardado con alertas: ${r.alertas.map((a) => a.mensaje).join(" ")}` : undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="t-editor" className="fixed inset-0 z-30 grid place-items-center bg-basalto/40 p-4" onClick={() => alCerrar(false)}>
      <form onSubmit={guardar} onClick={(ev) => ev.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6">
        <h2 id="t-editor" className="text-lg font-bold">{e.nombre}, {fechaCorta(e.fecha, true)}</h2>
        <div className="grid grid-cols-3 gap-3 items-end">
          <label className="block"><span className="text-sm font-semibold">Entrada</span><input type="time" required value={inicio} onChange={(x) => setInicio(x.target.value)} className="mt-1 w-full rounded-lg border border-moana-200 px-2 py-2" /></label>
          <label className="block"><span className="text-sm font-semibold">Salida</span><input type="time" required value={fin} onChange={(x) => setFin(x.target.value)} className="mt-1 w-full rounded-lg border border-moana-200 px-2 py-2" /></label>
          <label className="block"><span className="text-sm font-semibold">Colación</span><input type="number" min={0} max={120} step={15} value={colacion} onChange={(x) => setColacion(Number(x.target.value))} className="mt-1 w-full rounded-lg border border-moana-200 px-2 py-2" /></label>
        </div>
        <p className="text-sm text-basalto-soft">Si la salida es antes que la entrada, el turno cruza la medianoche. La colación en minutos no cuenta como jornada.</p>
        {error && <p role="alert" className="text-toromiro">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white">Guardar</button>
          {e.turnoId && (
            <button type="button" onClick={async () => { await api.eliminarTurno(e.turnoId!); alCerrar(true, "Turno quitado. Si estaba publicado, la persona recibió aviso."); }} className="px-3 py-2.5 text-toromiro underline underline-offset-4">
              Dejar libre
            </button>
          )}
          <button type="button" onClick={() => alCerrar(false)} className="px-3 py-2.5 text-basalto-soft underline underline-offset-4">Cancelar</button>
        </div>
      </form>
    </div>
  );
}

function CambiosPorAprobar({ cambios, alResolver }: { cambios: CambioTurno[]; alResolver: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const resolver = async (id: string, acepta: boolean) => {
    try {
      await api.resolverCambio(id, acepta);
      alResolver();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo resolver.");
    }
  };
  return (
    <section aria-labelledby="t-cambios" className="rounded-xl bg-liquen-soft p-5">
      <h2 id="t-cambios" className="font-bold">Cambios de turno por aprobar</h2>
      {error && <p role="alert" className="mt-2 text-toromiro">{error}</p>}
      <ul className="mt-3 space-y-3">
        {cambios.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {c.solicitante} cede su turno del {c.turnoSolicitante && `${fechaCorta(c.turnoSolicitante.fecha)} (${c.turnoSolicitante.inicio} a ${c.turnoSolicitante.fin})`} a {c.companero}
              {c.turnoCompanero && `, y toma el del ${fechaCorta(c.turnoCompanero.fecha)}`}. Ambos están de acuerdo.
            </span>
            <span className="flex gap-3">
              <button onClick={() => resolver(c.id, true)} className="rounded-lg bg-moana-800 px-4 py-2 font-semibold text-white">Aprobar</button>
              <button onClick={() => resolver(c.id, false)} className="text-toromiro underline underline-offset-4">Rechazar</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
