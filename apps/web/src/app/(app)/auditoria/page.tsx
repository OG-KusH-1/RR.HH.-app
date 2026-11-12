"use client";
/**
 * Registro de auditoría (HU-19). Solo lectura. Consultarlo también queda registrado.
 * Los detalles se muestran como pares clave-valor: nunca contienen sueldos (regla de AGENTS.md).
 */
import { useState } from "react";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api } from "@/lib/api";
import { ROL } from "@/lib/formato";

const ACCION: Record<string, string> = {
  INGRESO: "Ingresó al portal",
  INGRESO_FALLIDO: "Intento de ingreso fallido",
  SALIDA: "Cerró sesión",
  VER_FICHA: "Vio una ficha ajena",
  EDITAR_FICHA: "Editó una ficha",
  CREAR_FICHA: "Creó una ficha",
  DESVINCULAR: "Registró una desvinculación",
  SUBIR_DOCUMENTO: "Subió un documento",
  DESCARGAR_DOCUMENTO: "Descargó un documento",
  ELIMINAR_DOCUMENTO: "Eliminó un documento",
  APROBAR_AUSENCIA: "Aprobó una ausencia",
  RECHAZAR_AUSENCIA: "Rechazó una ausencia",
  SOLICITAR_AUSENCIA: "Solicitó una ausencia",
  CANCELAR_AUSENCIA: "Canceló una ausencia",
  VER_DETALLE_RESERVADO: "Vio el detalle de una licencia",
  AJUSTAR_SALDO_VACACIONES: "Ajustó un saldo de vacaciones",
  EMITIR_CERTIFICADO: "Emitió un certificado",
  VERIFICAR_CERTIFICADO: "Un tercero verificó un certificado",
  VER_LIQUIDACION: "Vio una liquidación",
  CONSULTAR_AUDITORIA: "Consultó la auditoría",
  DESCARGAR_MIS_DATOS: "Descargó sus datos personales",
  CREAR_INVITACION: "Generó una invitación",
  ACTIVAR_CUENTA: "Activó su cuenta",
  ACTIVAR_2FA: "Activó el segundo factor",
  IMPORTAR_PLANILLA: "Importó una planilla",
};

export default function AuditoriaPage() {
  const { datos: personas } = useDatos(api.trabajadores);
  const [filtro, setFiltro] = useState({ trabajadorId: "", desde: "", hasta: "", accion: "" });
  const [pagina, setPagina] = useState(1);
  const { datos, error } = useDatos(() => api.auditoria({ ...filtro, pagina: String(pagina) }), [filtro, pagina]);
  const cambiar = (k: keyof typeof filtro, v: string) => {
    setFiltro((f) => ({ ...f, [k]: v }));
    setPagina(1);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold">Auditoría</h1>
        <p className="mt-2 text-basalto-soft">Quién vio o cambió datos personales, y cuándo. El registro no se puede editar ni borrar. Esta consulta también queda registrada.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <label className="block">
          <span className="font-semibold">Persona</span>
          <select value={filtro.trabajadorId} onChange={(e) => cambiar("trabajadorId", e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
            <option value="">Todas</option>
            {personas?.map((p) => <option key={p.id} value={p.id}>{p.apellidos}, {p.nombres}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Acción</span>
          <select value={filtro.accion} onChange={(e) => cambiar("accion", e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5">
            <option value="">Todas</option>
            {datos?.acciones.map((a) => <option key={a} value={a}>{ACCION[a] ?? a}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Desde</span>
          <input type="date" value={filtro.desde} onChange={(e) => cambiar("desde", e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5" />
        </label>
        <label className="block">
          <span className="font-semibold">Hasta</span>
          <input type="date" value={filtro.hasta} onChange={(e) => cambiar("hasta", e.target.value)} className="mt-2 w-full rounded-lg border border-moana-200 bg-white px-3 py-2.5" />
        </label>
      </div>

      {error && <Aviso texto={error} />}
      {!datos && !error && <Cargando />}
      {datos && (
        <>
          <ul className="divide-y divide-moana-200 border-y border-moana-200">
            {datos.registros.map((r) => (
              <li key={r.id} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr]">
                <span className="text-sm text-basalto-soft tabular">{new Date(r.fecha).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}</span>
                <span>
                  <span className="font-semibold">{r.actorNombres ? `${r.actorNombres} ${r.actorApellidos?.split(" ")[0]}` : "Sin sesión"}</span>
                  {r.actorRol && <span className="text-basalto-soft"> ({ROL[r.actorRol]})</span>}
                  <span> · {ACCION[r.accion] ?? r.accion}</span>
                  {r.detalle && Object.keys(r.detalle).length > 0 && (
                    <span className="block text-sm text-basalto-soft break-all">
                      {Object.entries(r.detalle).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {datos.registros.length === 0 && <p className="text-basalto-soft">No hay registros con esos filtros.</p>}
          <div className="flex gap-4">
            {pagina > 1 && <button onClick={() => setPagina((p) => p - 1)} className="text-moana-800 underline underline-offset-4">Más recientes</button>}
            {datos.hayMas && <button onClick={() => setPagina((p) => p + 1)} className="text-moana-800 underline underline-offset-4">Más antiguos</button>}
          </div>
        </>
      )}
    </div>
  );
}
