"use client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, type Usuario } from "@/lib/api";

const SesionContext = createContext<Usuario | null>(null);

export function useUsuario(): Usuario {
  const u = useContext(SesionContext);
  if (!u) throw new Error("useUsuario fuera de ProveedorSesion");
  return u;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .yo()
      .then(({ usuario }) => setUsuario(usuario))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/ingresar");
        else setError(true);
      });
  }, [router]);

  if (error) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold">No hay conexión con el servidor</h1>
          <p className="mt-2 text-basalto-soft">Revisa tu internet y vuelve a cargar la página.</p>
          <button onClick={() => location.reload()} className="mt-6 rounded-lg bg-moana-800 px-5 py-3 font-semibold text-white">
            Volver a cargar
          </button>
        </div>
      </main>
    );
  }

  if (!usuario) {
    return (
      <main className="min-h-dvh grid place-items-center" aria-busy="true">
        <p className="text-basalto-soft">Cargando tu portal…</p>
      </main>
    );
  }

  return <SesionContext.Provider value={usuario}>{children}</SesionContext.Provider>;
}
