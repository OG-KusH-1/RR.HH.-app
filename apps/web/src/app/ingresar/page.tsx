import { DosHoras } from "@/components/dos-horas";
import { FormularioIngreso } from "./formulario";

export default function IngresarPage() {
  return (
    <main className="min-h-dvh grid lg:grid-cols-[5fr_7fr]">
      <section className="bg-moana-800 text-white px-6 py-6 lg:px-14 lg:py-14 flex flex-col justify-between gap-6">
        <p className="text-lg font-semibold">
          Tangata <span className="font-normal text-moana-200">de Te Moana</span>
        </p>
        <div className="hidden lg:block">
          <DosHoras />
        </div>
        <div className="lg:hidden">
          <DosHoras compacto />
        </div>
        <p className="hidden lg:block text-moana-200 max-w-[36ch]">
          Un solo portal para las cuatro sedes, en la isla y en el continente.
        </p>
      </section>

      <section className="flex items-start lg:items-center px-6 py-10 lg:px-20">
        <div className="w-full max-w-[26rem]">
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight">Ingresa a tu portal</h1>
          <p className="mt-3 text-basalto-soft">
            Usa tu RUT y la contraseña que creaste con la invitación de Personas.
          </p>
          <FormularioIngreso />
        </div>
      </section>
    </main>
  );
}
