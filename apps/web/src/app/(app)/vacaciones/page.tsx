"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormularioSolicitud, ListaSolicitudes, ResumenSaldo } from "@/components/ausencias";
import { Aviso, Cargando, useDatos } from "@/components/datos";
import { api } from "@/lib/api";

export default function VacacionesPage() {
  const router = useRouter();
  const [pidiendo, setPidiendo] = useState(false);
  const { datos: saldo, error } = useDatos(api.miSaldo);
  const { datos: tipos } = useDatos(api.tiposAusencia);
  const { datos: mias } = useDatos(() => api.solicitudes("mias"));

  return (
    <div className="max-w-2xl space-y-12">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold">Vacaciones y permisos</h1>
        <p className="mt-2 text-basalto-soft">Pide días, informa una licencia y revisa en qué va cada solicitud.</p>
      </header>

      {error && <Aviso texto={error} />}
      {saldo ? <ResumenSaldo s={saldo} /> : !error && <Cargando />}

      <section aria-labelledby="t-nueva">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="t-nueva" className="text-xl font-bold">
            Nueva solicitud
          </h2>
          {pidiendo && (
            <button onClick={() => setPidiendo(false)} className="text-moana-800 underline underline-offset-4">
              Cerrar
            </button>
          )}
        </div>
        <div className="mt-5">
          {pidiendo && tipos ? (
            <FormularioSolicitud tipos={tipos} alEnviar={(id) => router.push(`/ausencias/${id}?enviada=1`)} />
          ) : (
            <button onClick={() => setPidiendo(true)} className="rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white hover:bg-moana-900">
              Pedir días o informar una ausencia
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="t-mias">
        <h2 id="t-mias" className="text-xl font-bold">
          Mis solicitudes
        </h2>
        <div className="mt-5">{mias ? <ListaSolicitudes solicitudes={mias} vacio="Aún no tienes solicitudes." /> : <Cargando />}</div>
      </section>
    </div>
  );
}
