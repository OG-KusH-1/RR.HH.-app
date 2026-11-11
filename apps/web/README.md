# @tangata/web

Portal web de Tangata (Next.js 16, React 19, Tailwind 4).

- Las llamadas a `/api/*` se reenvían a la API de NestJS (ver `next.config.ts`), así la cookie de sesión es del mismo origen.
- `src/proxy.ts` redirige a `/ingresar` cuando no hay cookie de sesión. La autorización real ocurre siempre en la API.
- Tipografía: Atkinson Hyperlegible Next, diseñada para máxima legibilidad en pantallas pequeñas.
