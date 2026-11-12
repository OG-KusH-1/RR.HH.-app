"use client";
/**
 * Creación de la primera contraseña con el código de invitación (HU-02). Página pública.
 * El código puede venir en el enlace (?codigo=...) o escribirse a mano.
 */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { formatearRutParcial } from "@/lib/formato";

export default function ActivarPage() {
  const [rut, setRut] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Se lee en el cliente para no exigir un límite de Suspense por una sola variable.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("codigo");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor inicial tomado de la URL una sola vez
    if (c) setCodigo(c.toUpperCase());
  }, []);

  const corta = clave.length > 0 && clave.length < 10;
  const distintas = repetir.length > 0 && repetir !== clave;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.activar(rut, codigo, clave);
      setListo(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Demasiados intentos. Espera un minuto." : err instanceof ApiError ? err.message : "No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  const campo = "mt-2 w-full rounded-lg border-2 border-moana-200 bg-white px-4 py-3 text-lg focus:border-moana-800 focus:outline-none";
  return (
    <main className="min-h-dvh px-6 py-12 lg:py-20">
      <div className="mx-auto max-w-[26rem]">
        <p className="text-lg font-semibold text-moana-800">Tangata de Te Moana</p>
        {listo ? (
          <>
            <h1 className="mt-8 text-2xl font-bold">Tu contraseña quedó creada</h1>
            <p className="mt-3 text-basalto-soft">Ya puedes ingresar con tu RUT y la contraseña que elegiste.</p>
            <Link href="/ingresar" className="mt-8 inline-block rounded-lg bg-moana-800 px-6 py-3 font-semibold text-white">Ir a ingresar</Link>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-2xl lg:text-3xl font-bold">Crea tu contraseña</h1>
            <p className="mt-3 text-basalto-soft">Usa el código que te entregó Personas. Vale una sola vez y por 48 horas.</p>
            <form onSubmit={enviar} className="mt-8 space-y-5">
              <div>
                <label htmlFor="a-rut" className="block font-semibold">RUT</label>
                <input id="a-rut" autoComplete="username" placeholder="12.345.678-5" value={rut} onChange={(e) => setRut(formatearRutParcial(e.target.value))} className={`${campo} tabular`} />
              </div>
              <div>
                <label htmlFor="a-codigo" className="block font-semibold">Código de invitación</label>
                <input id="a-codigo" autoComplete="one-time-code" placeholder="AB2C3-DE4F5" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={`${campo} tracking-widest tabular`} />
              </div>
              <div>
                <label htmlFor="a-clave" className="block font-semibold">Contraseña nueva</label>
                <input id="a-clave" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} aria-describedby="a-ayuda" className={campo} />
                <p id="a-ayuda" className={`mt-2 text-sm ${corta ? "text-toromiro" : "text-basalto-soft"}`}>Al menos 10 caracteres. Una frase corta es más segura y fácil de recordar que una palabra con símbolos.</p>
              </div>
              <div>
                <label htmlFor="a-repetir" className="block font-semibold">Repite la contraseña</label>
                <input id="a-repetir" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className={campo} />
                {distintas && <p className="mt-2 text-sm text-toromiro">Las contraseñas no coinciden.</p>}
              </div>
              {error && <p role="alert" className="rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">{error}</p>}
              <button disabled={enviando || !rut || !codigo || clave.length < 10 || clave !== repetir} className="w-full rounded-lg bg-moana-800 px-4 py-4 text-lg font-semibold text-white disabled:bg-moana-200 disabled:text-moana-800/60">
                {enviando ? "Creando…" : "Crear contraseña"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
