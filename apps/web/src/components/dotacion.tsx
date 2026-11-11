import type { ResumenSede } from "@/lib/api";

/** Dotación por sede, agrupada por isla y continente: la división real de la empresa. */
export function Dotacion({ sedes }: { sedes: ResumenSede[] }) {
  const max = Math.max(...sedes.map((s) => s.dotacion), 1);
  const total = sedes.reduce((a, s) => a + s.dotacion, 0);
  const grupos = [
    { nombre: "En la isla", sedes: sedes.filter((s) => s.zonaHoraria === "Pacific/Easter") },
    { nombre: "En el continente", sedes: sedes.filter((s) => s.zonaHoraria !== "Pacific/Easter") },
  ];
  return (
    <div>
      <p className="text-basalto-soft">
        <span className="text-2xl font-bold text-basalto tabular">{total}</span> personas en {sedes.length} sedes
      </p>
      <div className="mt-6 space-y-8">
        {grupos.map((g) => (
          <section key={g.nombre}>
            <h3 className="font-semibold text-basalto-soft">{g.nombre}</h3>
            <ul className="mt-3 space-y-3">
              {g.sedes.map((s) => (
                <li key={s.sedeId} className="grid grid-cols-[minmax(9rem,12rem)_1fr_2.5rem] items-center gap-4">
                  <span>{s.sede}</span>
                  <span className="h-3 rounded-full bg-moana-50" aria-hidden="true">
                    <span className="block h-full rounded-full bg-moana-800" style={{ width: `${(s.dotacion / max) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular">{s.dotacion}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
