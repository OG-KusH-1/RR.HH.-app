import { Navegacion } from "@/components/navegacion";
import { ProveedorSesion } from "@/components/sesion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorSesion>
      <Navegacion />
      <div className="lg:pl-64 pb-24 lg:pb-0">
        <main className="mx-auto max-w-5xl px-5 py-8 lg:px-12 lg:py-14">{children}</main>
      </div>
    </ProveedorSesion>
  );
}
