"use client";
/**
 * Formulario de ficha para crear y editar (HU-05). Lo usan Personas (todos los campos) y
 * Administración del sistema (solo el rol). Las reglas reales (RUT único, plazo fijo con fecha de
 * término, quién asigna qué rol) están en la API; aquí solo se guía para no llegar al error.
 */
import { useState, type FormEvent } from "react";
import { api, ApiError, type DatosFicha, type OpcionesFicha, type Rol, type Trabajador } from "@/lib/api";
import { formatearRutParcial, ROL } from "@/lib/formato";
import { useUsuario } from "./sesion";

export function EditorFicha({ opciones, inicial, alGuardar, alCancelar }: { opciones: OpcionesFicha; inicial?: Trabajador & { rol?: Rol }; alGuardar: (id: string) => void; alCancelar?: () => void }) {
  const usuario = useUsuario();
  const soloRol = usuario.rol === "ADMIN";
  const [d, setD] = useState<DatosFicha>({
    rut: inicial ? formatearRutParcial(inicial.rut) : "",
    nombres: inicial?.nombres ?? "",
    apellidos: inicial?.apellidos ?? "",
    cargo: inicial?.cargo ?? "",
    sedeId: inicial?.sedeId ?? opciones.sedes[0]?.id ?? "",
    jefaturaId: inicial?.jefaturaId ?? null,
    fechaIngreso: inicial?.fechaIngreso ?? "",
    tipoContrato: inicial?.tipoContrato ?? "INDEFINIDO",
    fechaTerminoContrato: inicial?.fechaTerminoContrato ?? null,
    horasSemanales: inicial?.horasSemanales ?? 42,
    telefono: inicial?.telefono ?? "",
    email: inicial?.email ?? "",
    rol: inicial?.rol,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = <K extends keyof DatosFicha>(k: K, v: DatosFicha[K]) => setD((x) => ({ ...x, [k]: v }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const datos: DatosFicha = { ...d, telefono: d.telefono || null, email: d.email || null, fechaTerminoContrato: d.tipoContrato === "INDEFINIDO" ? null : d.fechaTerminoContrato };
    try {
      if (inicial) {
        await api.editarFicha(inicial.id, soloRol ? { rol: d.rol } : datos);
        alGuardar(inicial.id);
      } else {
        const t = await api.crearFicha(datos);
        alGuardar(t.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const campo = "mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5 disabled:bg-rano";
  const rolesAsignables: Rol[] = usuario.rol === "ADMIN" ? ["TRABAJADOR", "JEFATURA", "PERSONAS", "GERENCIA", "ADMIN"] : ["TRABAJADOR", "JEFATURA", "PERSONAS", "GERENCIA"];
  const esPropia = inicial?.id === usuario.trabajadorId;

  return (
    <form onSubmit={guardar} className="space-y-5 rounded-xl border border-moana-200 bg-white p-5 lg:p-6">
      <fieldset disabled={soloRol} className="grid gap-4 sm:grid-cols-2 items-end">
        <div>
          <label htmlFor="f-rut" className="block font-semibold">RUT</label>
          <input id="f-rut" required value={d.rut} onChange={(e) => cambiar("rut", formatearRutParcial(e.target.value))} className={`${campo} tabular`} />
        </div>
        <div>
          <label htmlFor="f-cargo" className="block font-semibold">Cargo</label>
          <input id="f-cargo" required value={d.cargo} onChange={(e) => cambiar("cargo", e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="f-nombres" className="block font-semibold">Nombres</label>
          <input id="f-nombres" required value={d.nombres} onChange={(e) => cambiar("nombres", e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="f-apellidos" className="block font-semibold">Apellidos</label>
          <input id="f-apellidos" required value={d.apellidos} onChange={(e) => cambiar("apellidos", e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="f-sede" className="block font-semibold">Sede</label>
          <select id="f-sede" value={d.sedeId} onChange={(e) => cambiar("sedeId", e.target.value)} className={campo}>
            {opciones.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-jefe" className="block font-semibold">Jefatura directa</label>
          <select id="f-jefe" value={d.jefaturaId ?? ""} onChange={(e) => cambiar("jefaturaId", e.target.value || null)} className={campo}>
            <option value="">Sin jefatura</option>
            {opciones.jefaturas.filter((j) => j.id !== inicial?.id).map((j) => <option key={j.id} value={j.id}>{j.nombres} {j.apellidos.split(" ")[0]}, {j.cargo}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-ingreso" className="block font-semibold">Fecha de ingreso</label>
          <input id="f-ingreso" type="date" required value={d.fechaIngreso} onChange={(e) => cambiar("fechaIngreso", e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="f-horas" className="block font-semibold">Horas semanales <span className="font-normal text-basalto-soft">(máximo 42)</span></label>
          <input id="f-horas" type="number" min={1} max={42} required value={d.horasSemanales} onChange={(e) => cambiar("horasSemanales", Number(e.target.value))} className={campo} />
        </div>
        <div>
          <label htmlFor="f-contrato" className="block font-semibold">Contrato</label>
          <select id="f-contrato" value={d.tipoContrato} onChange={(e) => cambiar("tipoContrato", e.target.value as DatosFicha["tipoContrato"])} className={campo}>
            <option value="INDEFINIDO">Indefinido</option>
            <option value="PLAZO_FIJO">Plazo fijo</option>
            <option value="OBRA_FAENA">Por obra o faena</option>
          </select>
        </div>
        {d.tipoContrato !== "INDEFINIDO" && (
          <div>
            <label htmlFor="f-termino" className="block font-semibold">Fecha de término</label>
            <input id="f-termino" type="date" required={d.tipoContrato === "PLAZO_FIJO"} value={d.fechaTerminoContrato ?? ""} onChange={(e) => cambiar("fechaTerminoContrato", e.target.value || null)} className={campo} />
          </div>
        )}
        <div>
          <label htmlFor="f-tel" className="block font-semibold">Teléfono <span className="font-normal text-basalto-soft">(opcional)</span></label>
          <input id="f-tel" value={d.telefono ?? ""} onChange={(e) => cambiar("telefono", e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="f-email" className="block font-semibold">Correo personal <span className="font-normal text-basalto-soft">(opcional)</span></label>
          <input id="f-email" type="email" value={d.email ?? ""} onChange={(e) => cambiar("email", e.target.value)} className={campo} />
        </div>
      </fieldset>
      {!esPropia && (
        <div className="max-w-xs">
          <label htmlFor="f-rol" className="block font-semibold">Rol en el portal</label>
          <select id="f-rol" value={d.rol ?? "TRABAJADOR"} onChange={(e) => cambiar("rol", e.target.value as Rol)} className={campo}>
            {rolesAsignables.map((r) => <option key={r} value={r}>{ROL[r]}</option>)}
          </select>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{error}</p>}
      <div className="flex gap-3">
        <button disabled={guardando} className="rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : inicial ? "Guardar cambios" : "Crear ficha"}</button>
        {alCancelar && <button type="button" onClick={alCancelar} className="px-4 py-3 text-basalto-soft underline underline-offset-4">Cancelar</button>}
      </div>
    </form>
  );
}
