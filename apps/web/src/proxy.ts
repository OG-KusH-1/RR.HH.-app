import { NextResponse, type NextRequest } from "next/server";

/**
 * Revisión optimista: sin cookie de sesión, se va directo a /ingresar.
 * La autorización real la hace siempre la API.
 */
export function proxy(request: NextRequest) {
  const tieneSesion = request.cookies.has("__Host-sid");
  // Páginas públicas: ingreso, activación de cuenta con invitación y verificación de certificados.
  const publica = ["/ingresar", "/activar", "/verificar"].some((p) => request.nextUrl.pathname.startsWith(p));

  if (!tieneSesion && !publica) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
