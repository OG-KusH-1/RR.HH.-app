"use client";
/**
 * Activación del segundo factor: QR para la aplicación autenticadora y confirmación con un código.
 * El secreto también se muestra en texto, para quien no puede escanear (por ejemplo, desde el
 * mismo celular donde está la aplicación).
 */
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

export function ActivarSegundoFactor({ alActivar }: { alActivar: () => void }) {
  const [qr, setQr] = useState<{ qr: string; secreto: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function generar() {
    setError(null);
    setOcupado(true);
    try {
      setQr(await api.iniciar2fa());
    } catch {
      setError("No se pudo generar el código QR.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      await api.confirmar2fa(codigo);
      alActivar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar.");
    } finally {
      setOcupado(false);
    }
  }

  if (!qr) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-2 pl-5 text-basalto-soft">
          <li>Instala en tu celular Google Authenticator, Microsoft Authenticator o similar.</li>
          <li>Genera el código QR y escanéalo con esa aplicación.</li>
          <li>Escribe el código de 6 dígitos que aparece para confirmar.</li>
        </ol>
        <button onClick={generar} disabled={ocupado} className="rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white disabled:opacity-50">
          Generar código QR
        </button>
        {error && <p role="alert" className="text-toromiro">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="space-y-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen de datos generada por la API, no hay nada que optimizar */}
      <img src={qr.qr} alt="Código QR para la aplicación autenticadora" width={220} height={220} className="rounded-lg bg-white p-2" />
      <p className="text-sm text-basalto-soft">
        ¿No puedes escanear? Ingresa esta clave a mano: <span className="font-semibold tabular break-all text-basalto">{qr.secreto}</span>
      </p>
      <div>
        <label htmlFor="codigo-2fa" className="block font-semibold">Código de 6 dígitos</label>
        <input
          id="codigo-2fa"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          className="mt-2 w-40 rounded-lg border-2 border-moana-200 bg-white px-4 py-3 text-lg tracking-[0.3em] tabular"
        />
      </div>
      {error && <p role="alert" className="text-toromiro">{error}</p>}
      <button disabled={ocupado || codigo.length !== 6} className="rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white disabled:opacity-50">
        Confirmar y activar
      </button>
    </form>
  );
}
