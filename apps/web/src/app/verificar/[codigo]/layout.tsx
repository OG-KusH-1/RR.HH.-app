import { Suspense } from "react";

/** La página lee el código desde la URL en el cliente; Next exige un límite de Suspense para eso. */
export default function VerificarLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="min-h-dvh p-12 text-basalto-soft">Consultando…</main>}>{children}</Suspense>;
}
