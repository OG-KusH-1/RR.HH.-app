"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useDatos } from "@/components/datos";
import { ActivarSegundoFactor } from "@/components/segundo-factor";
import { useUsuario } from "@/components/sesion";
import { api, ApiError } from "@/lib/api";
import { formatearRut, ROL } from "@/lib/formato";

export default function CuentaPage() {
  const usuario = useUsuario();
  const [version, setVersion] = useState(0);
  const { datos: yo } = useDatos(api.yo, [version]);
  const [configurando, setConfigurando] = useState(false);

  return (
    <div className="max-w-2xl space-y-12">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold">Mi cuenta</h1>
        <p className="mt-2 text-basalto-soft">
          {formatearRut(usuario.rut)} · {ROL[usuario.rol]}
        </p>
      </header>

      <section aria-labelledby="t-clave">
        <h2 id="t-clave" className="text-xl font-bold">Cambiar contraseña</h2>
        <CambiarClave />
      </section>

      <section aria-labelledby="t-2fa">
        <h2 id="t-2fa" className="text-xl font-bold">Segundo factor</h2>
        {yo?.segundoFactor.activo ? (
          <p className="mt-3 text-basalto-soft">Activo. Al ingresar se te pedirá el código de tu aplicación autenticadora. Si cambias de celular, pide a Administración del sistema que lo restablezca.</p>
        ) : configurando ? (
          <div className="mt-4"><ActivarSegundoFactor alActivar={() => { setConfigurando(false); setVersion((v) => v + 1); }} /></div>
        ) : (
          <>
            <p className="mt-3 text-basalto-soft">Agrega un código del celular al ingresar. {yo?.segundoFactor.obligatorio ? "Tu rol lo requiere." : "Es opcional para tu rol, pero recomendado."}</p>
            <button onClick={() => setConfigurando(true)} className="mt-4 rounded-lg border border-moana-800 px-5 py-2.5 font-semibold text-moana-800">Activar segundo factor</button>
          </>
        )}
      </section>

      <section aria-labelledby="t-priv">
        <h2 id="t-priv" className="text-xl font-bold">Tus datos personales</h2>
        <p className="mt-3 text-basalto-soft">Descarga una copia de todo lo que la empresa guarda sobre ti o pide corregir algo.</p>
        <Link href="/privacidad" className="mt-4 inline-block text-moana-800 underline underline-offset-4">Ir a privacidad</Link>
      </section>
    </div>
  );
}

function CambiarClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.cambiarClave(actual, nueva);
      setEstado({ ok: true, texto: "Contraseña actualizada." });
      setActual("");
      setNueva("");
    } catch (err) {
      setEstado({ ok: false, texto: err instanceof ApiError ? err.message : "No se pudo cambiar." });
    }
  }
  const campo = "mt-2 w-full rounded-lg border border-moana-200 bg-white px-4 py-3";
  return (
    <form onSubmit={enviar} className="mt-4 grid gap-4 sm:grid-cols-2 items-end">
      <div>
        <label htmlFor="c-actual" className="block font-semibold">Contraseña actual</label>
        <input id="c-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} className={campo} />
      </div>
      <div>
        <label htmlFor="c-nueva" className="block font-semibold">Nueva <span className="font-normal text-basalto-soft">(10 o más caracteres)</span></label>
        <input id="c-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} className={campo} />
      </div>
      {estado && <p role="status" className={`sm:col-span-2 ${estado.ok ? "text-moana-800" : "text-toromiro"}`}>{estado.texto}</p>}
      <button disabled={!actual || nueva.length < 10} className="w-fit rounded-lg bg-moana-800 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Cambiar contraseña</button>
    </form>
  );
}
