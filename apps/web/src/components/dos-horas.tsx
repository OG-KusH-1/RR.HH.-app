"use client";
import { diferenciaHoras, horaEn } from "@/lib/formato";
import { useReloj } from "@/lib/use-reloj";

/**
 * El elemento propio de Tangata: la empresa vive en dos husos horarios.
 * La isla arriba, el continente abajo, y entre ambos la distancia en horas.
 */
export function DosHoras({ compacto = false }: { compacto?: boolean }) {
  const ahora = useReloj();
  const isla = ahora ? horaEn("Pacific/Easter", ahora) : "--:--";
  const continente = ahora ? horaEn("America/Santiago", ahora) : "--:--";
  const dif = ahora ? diferenciaHoras("Pacific/Easter", "America/Santiago", ahora) : 2;

  if (compacto) {
    return (
      <div className="flex items-baseline gap-6 tabular" aria-label={`Hanga Roa ${isla}, Santiago ${continente}`}>
        <p className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-white">{isla}</span>
          <span className="text-sm text-moana-200">Hanga Roa</span>
        </p>
        <p className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-white">{continente}</span>
          <span className="text-sm text-moana-200">Santiago</span>
        </p>
      </div>
    );
  }

  return (
    <div className="tabular" aria-label={`Hora en Hanga Roa ${isla}, en Santiago ${continente}`}>
      <p className="text-moana-200 text-lg">Hanga Roa</p>
      <p className="text-white font-bold leading-none tracking-tight text-[clamp(4rem,9vw,7.5rem)]">{isla}</p>
      <div className="my-8 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-moana-600" />
        <span className="text-liquen text-base">{Math.abs(dif)} horas y 3.700 km</span>
        <span className="h-px flex-1 bg-moana-600" />
      </div>
      <p className="text-moana-200 text-lg">Santiago</p>
      <p className="text-white/80 font-bold leading-none tracking-tight text-[clamp(4rem,9vw,7.5rem)]">{continente}</p>
    </div>
  );
}
