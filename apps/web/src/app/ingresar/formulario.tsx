"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { formatearRutParcial } from "@/lib/formato";

export function FormularioIngreso() {
  const router = useRouter();
  const [rut, setRut] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.ingresar(rut, clave);
      router.replace("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError("El RUT o la contraseña no coinciden. Revisa ambos e intenta de nuevo.");
      else if (err instanceof ApiError && err.status === 423) setError("Tu cuenta quedó bloqueada 15 minutos por varios intentos fallidos. Si olvidaste tu contraseña, pídele una nueva a Personas.");
      else if (err instanceof ApiError && err.status === 429) setError("Demasiados intentos seguidos. Espera un minuto antes de volver a intentar.");
      else setError("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-10 space-y-6" noValidate>
      <div>
        <label htmlFor="rut" className="block font-semibold">
          RUT
        </label>
        <input
          id="rut"
          name="rut"
          inputMode="text"
          autoComplete="username"
          placeholder="12.345.678-5"
          value={rut}
          onChange={(e) => setRut(formatearRutParcial(e.target.value))}
          className="mt-2 w-full rounded-lg border-2 border-moana-200 bg-white px-4 py-3 text-lg tabular placeholder:text-basalto-soft/50 focus:border-moana-800 focus:outline-none"
          required
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="clave" className="block font-semibold">
            Contraseña
          </label>
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            className="text-sm text-moana-800 underline underline-offset-4"
            aria-controls="clave"
          >
            {verClave ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <input
          id="clave"
          name="clave"
          type={verClave ? "text" : "password"}
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="mt-2 w-full rounded-lg border-2 border-moana-200 bg-white px-4 py-3 text-lg focus:border-moana-800 focus:outline-none"
          required
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-toromiro-soft px-4 py-3 text-toromiro">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || !rut || !clave}
        className="w-full rounded-lg bg-moana-800 px-4 py-4 text-lg font-semibold text-white hover:bg-moana-900 disabled:bg-moana-200 disabled:text-moana-800/60"
      >
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>

      <p className="text-sm text-basalto-soft">¿Olvidaste tu contraseña? Pídele a Personas un código nuevo.</p>
    </form>
  );
}
