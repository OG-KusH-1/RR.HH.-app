"use client";
/**
 * Liquidación de referencia (HU-29). Calcula en la API con los indicadores
 * confirmados del mes y muestra cada línea con su fórmula. No reemplaza la
 * liquidación oficial del contador: sirve para revisar y comparar.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Aviso, Cargando } from "@/components/datos";
import { useUsuario } from "@/components/sesion";
import { api, ApiError, type Linea, type RespuestaLiquidacion } from "@/lib/api";
import { nombrePeriodo, pesos } from "@/lib/formato";

function periodoActual() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date());
  return partes.slice(0, 7);
}

export default function LiquidacionPage() {
  const { id } = useParams<{ id: string }>();
  const usuario = useUsuario();
  const volver = id === usuario.trabajadorId ? "/mi-ficha" : `/equipo/${id}`;
  const [periodo, setPeriodo] = useState(periodoActual);
  const [variables, setVariables] = useState({ diasTrabajados: 30, horasExtra: 0, bonosImponibles: 0, noImponibles: 0 });
  const [datos, setDatos] = useState<RespuestaLiquidacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api
      .liquidacion(id, { periodo, ...variables })
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
      })
      .catch((e) => {
        if (!vigente) return;
        setDatos(null);
        setError(e instanceof ApiError ? e.message : "No se pudo calcular. Vuelve a intentarlo.");
      });
    return () => {
      vigente = false;
    };
  }, [id, periodo, variables]);

  const campo = "mt-1 w-full rounded-lg border-2 border-moana-200 bg-white px-3 py-2 tabular focus:border-moana-800 focus:outline-none";
  const numero = (clave: keyof typeof variables, etiqueta: string, max?: number) => (
    <label className="block text-sm">
      <span className="text-basalto-soft">{etiqueta}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={variables[clave]}
        onChange={(e) => setVariables((v) => ({ ...v, [clave]: Math.max(0, Number(e.target.value) || 0) }))}
        className={campo}
      />
    </label>
  );

  return (
    <div className="max-w-3xl">
      <Link href={volver} className="text-moana-800 underline underline-offset-4">
        Volver a la ficha
      </Link>
      <h1 className="mt-6 text-2xl lg:text-3xl font-bold">
        Liquidación de referencia{datos ? `: ${datos.trabajador.nombres} ${datos.trabajador.apellidos}` : ""}
      </h1>
      <p className="mt-2 text-basalto-soft">Sirve para revisar y comparar con la liquidación del contador. No reemplaza a la oficial.</p>

      <div className="mt-8 grid grid-cols-2 items-end gap-4 sm:grid-cols-5">
        <label className="block text-sm col-span-2 sm:col-span-1">
          <span className="text-basalto-soft">Mes</span>
          <input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} className={campo} />
        </label>
        {numero("diasTrabajados", "Días trabajados", 30)}
        {numero("horasExtra", "Horas extra")}
        {numero("bonosImponibles", "Bonos imponibles")}
        {numero("noImponibles", "Colación y movilización")}
      </div>

      <div className="mt-10">
        {error && <Aviso texto={error} />}
        {!datos && !error && <Cargando texto="Calculando…" />}
        {datos && (
          <>
            <div className="rounded-2xl bg-moana-800 p-6 text-white">
              <p className="text-moana-200">Líquido a pagar en {nombrePeriodo(datos.liquidacion.periodo)}</p>
              <p className="mt-1 text-3xl lg:text-4xl font-bold tabular">{pesos(datos.liquidacion.totales.liquido)}</p>
              <p className="mt-3 text-sm text-moana-200 tabular">
                Costo total para la empresa: {pesos(datos.liquidacion.totales.costoEmpresa)}
              </p>
            </div>

            <Bloque titulo="Haberes" lineas={datos.liquidacion.haberes} total={datos.liquidacion.totales.imponible + datos.liquidacion.totales.noImponible} />
            <Bloque titulo="Descuentos" lineas={datos.liquidacion.descuentos} total={datos.liquidacion.totales.descuentos} />
            <Bloque titulo="Aportes del empleador" nota="La empresa los paga aparte; no se descuentan del sueldo." lineas={datos.liquidacion.aportesEmpleador} total={datos.liquidacion.totales.aportesEmpleador} />

            <section className="mt-10 border-t border-moana-200 pt-6 text-sm text-basalto-soft">
              <p>
                Calculado con los indicadores confirmados de {nombrePeriodo(datos.indicadores.periodo)}: UF {datos.indicadores.uf.toLocaleString("es-CL")} y UTM{" "}
                {pesos(datos.indicadores.utm)}.
              </p>
              <ul className="mt-3 list-disc pl-5 space-y-1">
                {datos.limitaciones.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Bloque({ titulo, lineas, total, nota }: { titulo: string; lineas: Linea[]; total: number; nota?: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{titulo}</h2>
      {nota && <p className="mt-1 text-sm text-basalto-soft">{nota}</p>}
      <ul className="mt-4 divide-y divide-moana-200 border-y border-moana-200">
        {lineas.map((l) => (
          <li key={l.codigo} className="grid grid-cols-[1fr_auto] gap-x-4 py-3">
            <span className="font-semibold">{l.concepto}</span>
            <span className="text-right font-semibold tabular">{pesos(l.monto)}</span>
            <span className="col-span-2 text-sm text-basalto-soft">{l.detalle}</span>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] py-3">
          <span className="font-bold">Total</span>
          <span className="text-right font-bold tabular">{pesos(total)}</span>
        </li>
      </ul>
    </section>
  );
}
