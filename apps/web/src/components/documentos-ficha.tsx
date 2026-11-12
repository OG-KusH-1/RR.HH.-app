"use client";
/**
 * Bloque de documentos dentro de la ficha de otra persona.
 * Si la API responde 404 (por ejemplo, para una jefatura) el bloque no se muestra:
 * la jefatura no debe saber qué documentos existen.
 */
import { useState } from "react";
import { api } from "@/lib/api";
import { Cargando, useDatos } from "./datos";
import { ListaDocumentos, SubirDocumento } from "./documentos";

export function DocumentosFicha({ trabajadorId }: { trabajadorId: string }) {
  const [version, setVersion] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const { datos, error } = useDatos(() => api.documentosDe(trabajadorId), [trabajadorId, version]);
  const { datos: tipos } = useDatos(() => (datos?.puedeSubir ? api.tiposDocumento() : Promise.resolve([])), [datos?.puedeSubir]);
  if (error) return null;
  return (
    <section aria-labelledby="t-docs" className="mt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="t-docs" className="text-xl font-bold">Documentos</h2>
        {datos?.puedeSubir && (
          <button onClick={() => setSubiendo((s) => !s)} className="text-moana-800 underline underline-offset-4">
            {subiendo ? "Cerrar" : "Subir documento"}
          </button>
        )}
      </div>
      {subiendo && tipos && (
        <div className="mt-5">
          <SubirDocumento trabajadorId={trabajadorId} tipos={tipos} alSubir={() => { setSubiendo(false); setVersion((v) => v + 1); }} />
        </div>
      )}
      <div className="mt-5">{datos ? <ListaDocumentos carpeta={datos} mostrarVisibilidad alCambiar={() => setVersion((v) => v + 1)} /> : <Cargando />}</div>
    </section>
  );
}
