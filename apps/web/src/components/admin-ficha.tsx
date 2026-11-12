"use client";
/**
 * Acciones administrativas sobre una ficha: editar, invitar a crear contraseña,
 * desvincular y restablecer el segundo factor. Cada una se habilita según el rol;
 * la API vuelve a revisar todo.
 */
import { useState, type FormEvent } from "react";
import { api, ApiError, type Trabajador } from "@/lib/api";
import { useDatos } from "./datos";
import { EditorFicha } from "./editor-ficha";
import { useUsuario } from "./sesion";

type Panel = null | "editar" | "invitar" | "desvincular";

export function AdminFicha({ t, alCambiar }: { t: Trabajador; alCambiar: () => void }) {
  const usuario = useUsuario();
  const esPersonas = usuario.rol === "PERSONAS";
  const esAdmin = usuario.rol === "ADMIN";
  const [panel, setPanel] = useState<Panel>(null);
  const { datos: opciones } = useDatos(() => (esPersonas || esAdmin ? api.opcionesFicha() : Promise.resolve(null)));
  const [aviso, setAviso] = useState<string | null>(null);
  if (!esPersonas && !esAdmin) return null;

  return (
    <section aria-labelledby="t-admin" className="mt-10 rounded-xl border border-moana-200 p-5">
      <h2 id="t-admin" className="font-bold">Administrar ficha</h2>
      <p className="mt-1 text-sm text-basalto-soft">
        {t.cuentaActiva ? "Tiene cuenta activa en el portal." : "Aún no crea su contraseña: envíale una invitación."}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <button onClick={() => setPanel(panel === "editar" ? null : "editar")} className="text-moana-800 underline underline-offset-4">{esAdmin ? "Cambiar rol" : "Editar datos"}</button>
        {esPersonas && <button onClick={() => setPanel(panel === "invitar" ? null : "invitar")} className="text-moana-800 underline underline-offset-4">{t.cuentaActiva ? "Nuevo código de acceso" : "Invitar al portal"}</button>}
        {esPersonas && t.id !== usuario.trabajadorId && <button onClick={() => setPanel(panel === "desvincular" ? null : "desvincular")} className="text-toromiro underline underline-offset-4">Desvincular</button>}
        {esAdmin && t.id !== usuario.trabajadorId && (
          <button
            onClick={async () => {
              if (!window.confirm("Se borrará su segundo factor y se cerrarán sus sesiones. ¿Continuar?")) return;
              await api.restablecer2fa(t.id);
              setAviso("Segundo factor restablecido. La persona deberá activarlo de nuevo al ingresar.");
            }}
            className="text-moana-800 underline underline-offset-4"
          >
            Restablecer segundo factor
          </button>
        )}
      </div>
      {aviso && <p role="status" className="mt-4 text-moana-800">{aviso}</p>}
      <div className="mt-5">
        {panel === "editar" && opciones && <EditorFicha opciones={opciones} inicial={t} alGuardar={() => { setPanel(null); alCambiar(); }} alCancelar={() => setPanel(null)} />}
        {panel === "invitar" && <Invitacion trabajadorId={t.id} />}
        {panel === "desvincular" && <Desvincular t={t} alListo={alCambiar} />}
      </div>
    </section>
  );
}

function Invitacion({ trabajadorId }: { trabajadorId: string }) {
  const [inv, setInv] = useState<{ codigo: string; mensaje: string; expiraEn: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  if (!inv) {
    return (
      <div className="space-y-3">
        <p className="text-basalto-soft">Se genera un código de un solo uso, válido por 48 horas. Lo verás una sola vez: entrégalo en persona o cópialo en un mensaje. Un código nuevo anula el anterior.</p>
        <button onClick={async () => setInv(await api.invitar(trabajadorId))} className="rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white">Generar código</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-3xl font-bold tracking-widest tabular">{inv.codigo}</p>
      <p className="rounded-lg bg-rano p-4">{inv.mensaje}</p>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(inv.mensaje);
          setCopiado(true);
        }}
        className="rounded-lg border border-moana-800 px-4 py-2 font-semibold text-moana-800"
      >
        {copiado ? "Mensaje copiado" : "Copiar mensaje"}
      </button>
    </div>
  );
}

function Desvincular({ t, alListo }: { t: Trabajador; alListo: () => void }) {
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<{ saldo: number; nota: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm(`¿Desvincular a ${t.nombres} ${t.apellidos} con fecha ${fecha}? Se cerrará su acceso al portal.`)) return;
    try {
      const r = await api.desvincular(t.id, fecha, motivo);
      setResultado({ saldo: r.saldoVacacionesAlTermino, nota: r.nota });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desvincular.");
    }
  }
  if (resultado) {
    return (
      <div className="space-y-3">
        <p className="font-semibold">Desvinculación registrada.</p>
        <p>Saldo de vacaciones al término: <span className="font-bold tabular">{resultado.saldo.toLocaleString("es-CL")} días hábiles</span>.</p>
        <p className="text-sm text-basalto-soft">{resultado.nota} Infórmalo al contador para el finiquito.</p>
        <button onClick={alListo} className="text-moana-800 underline underline-offset-4">Volver a la ficha</button>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-basalto-soft">La ficha no se borra: queda inactiva con su historial y documentos. El sistema no decide la desvinculación ni calcula el finiquito; solo la registra.</p>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr] items-end">
        <div>
          <label htmlFor="d-fecha" className="block font-semibold">Fecha de término</label>
          <input id="d-fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5" />
        </div>
        <div>
          <label htmlFor="d-motivo" className="block font-semibold">Causal o motivo</label>
          <input id="d-motivo" required minLength={5} placeholder="Art. 159 N°4, vencimiento del plazo convenido" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5" />
        </div>
      </div>
      {error && <p role="alert" className="text-toromiro">{error}</p>}
      <button className="rounded-lg bg-toromiro px-5 py-2.5 font-semibold text-white">Registrar desvinculación</button>
    </form>
  );
}
