"use client";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { ListaDocumentos } from "@/components/documentos";
import { api } from "@/lib/api";

export default function MisDocumentosPage() {
  const { datos, error } = useDatos(api.misDocumentos);
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl lg:text-3xl font-bold">Mis documentos</h1>
      <p className="mt-2 text-basalto-soft">Tu contrato, anexos y certificados. Los enlaces de descarga duran 5 minutos.</p>
      <div className="mt-8">{error ? <Aviso texto={error} /> : datos ? <ListaDocumentos carpeta={datos} /> : <Cargando />}</div>
    </div>
  );
}
