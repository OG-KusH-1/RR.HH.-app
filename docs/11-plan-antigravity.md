# 11. Plan de trabajo con Gemini en Antigravity

Objetivo: delegar en Gemini (Antigravity) tareas acotadas y verificables, y dejar a Claude la arquitectura, la lógica de negocio sensible y la revisión. Así se reparten los créditos de ambas herramientas.

## Reparto de trabajo

| Tipo de tarea | Quién | Por qué |
|---|---|---|
| Arquitectura, ADR, reglas legales, permisos, cálculo de sueldos | Claude | Un error aquí cuesta caro y requiere razonar el contexto completo |
| Revisión de pull requests de Gemini | Claude o tú | Un segundo par de ojos sobre todo lo delegado |
| Pruebas, pantallas que siguen un patrón existente, Docker, documentación, datos de prueba | Gemini | Tareas con especificación clara y resultado fácil de comprobar |
| Investigación de datos públicos (tasas del mes, cambios legales) | Gemini con búsqueda, y tú verificas | Siempre contra la fuente oficial |

## Cómo prepararlo una vez

1. Abre el repositorio en Antigravity.
2. Copia el contenido de `AGENTS.md` en las reglas del espacio de trabajo de Antigravity, para que Gemini siga las mismas convenciones.
3. Usa el modo en que el agente propone un plan y tú lo apruebas antes de ejecutar. Revisa el plan: si toca archivos fuera de los listados en la tarea, recházalo.
4. Cada tarea en su propia rama `gemini/<id>` y con su pull request.

## Plantilla de instrucción

Copia esto en Antigravity y completa los campos de cada tarea:

```text
Lee AGENTS.md y respeta todas sus reglas.
Tarea: <id y título>
Contexto: <qué existe hoy y dónde>
Archivos que puedes tocar: <lista>
Archivos que NO puedes tocar: apps/api/src/previsional/liquidacion/**, apps/api/src/auth/**, migraciones existentes.
Criterios de aceptación:
- <criterio verificable 1>
- <criterio verificable 2>
- pnpm --filter @tangata/api test y pnpm --filter @tangata/web lint pasan.
Entrega: rama gemini/<id>, commits en Conventional Commits en español, y un resumen de qué cambiaste y cómo lo probaste.
```

## Tareas listas para delegar

| ID | Tarea | Archivos | Criterios de aceptación | Dificultad |
|---|---|---|---|---|
| T1 | Pruebas de extremo a extremo de la API: ingreso, bloqueo y permisos por rol | `apps/api/test/**` | Prueban con supertest contra una base de datos de prueba: un trabajador no ve fichas ajenas (404), una jefatura no ve sueldos ni liquidaciones, la cuenta se bloquea tras 5 intentos | Media |
| T2 | Dockerfile de producción para API y web | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml` | Imágenes multi-etapa, usuario no root, `docker compose up` levanta todo con la base de datos | Baja |
| T3 | Adaptador que lea las comisiones AFP de la página de la Superintendencia de Pensiones | `apps/api/src/previsional/fuentes/spensiones.fuente.ts` y su prueba | Devuelve las 7 AFP con su comisión; la prueba usa un HTML grabado; si el formato cambia, falla con un error claro. No escribe en la base de datos: solo propone | Media |
| T4 | Esqueletos de carga en lugar del texto "Cargando…" | `apps/web/src/components/datos.tsx` y páginas | Respetan la paleta del tema y `prefers-reduced-motion` | Baja |
| T5 | Revisión de accesibilidad con axe en las pantallas principales | `apps/web/**` | Sin errores graves de axe en ingreso, inicio, ficha, liquidación e indicadores | Baja |
| T6 | Pruebas de extremo a extremo de vacaciones, documentos y turnos | `apps/api/test/**` | Una jefatura no aprueba lo propio ni ve el detalle de una licencia; un enlace de descarga ajeno da 403; un turno sobre vacaciones da 400 | Media |
| T7 | Exportar la dotación a CSV | `apps/api/src/employees/**`, botón en la página Sedes | Respeta los mismos permisos que el listado; incluye fecha de generación | Baja |
| T8 | Documentar en la carpeta de cada módulo un README con sus responsabilidades y dependencias | `apps/api/src/*/README.md` | Uno por módulo, menos de 40 líneas cada uno | Baja |

| T9 | Pantallas de "vacío" y estados de error con ilustración simple | `apps/web/src/app/(app)/**` | Mismo tono de los textos actuales; sin librerías nuevas | Baja |
| T10 | Exportar a CSV el reporte de carpetas incompletas | `apps/api/src/documentos/**`, botón en Vencimientos | Mismos permisos que el reporte; BOM UTF-8 para Excel | Baja |

La vista de auditoría (antigua T6) ya está hecha.

## Cimientos de los proyectos 2 y 3

Gemini también puede armar la estructura inicial de los otros dos proyectos del portafolio, con el mismo stack para reutilizar lo aprendido. Solo estructura: la lógica de negocio se diseña después.

1. Crea en GitHub los repositorios vacíos (por ejemplo `pos-minimarket` y `reservas-pymes`).
2. Ábrelos en Antigravity y usa la plantilla de cimientos: monorepo pnpm con NestJS 12 + Drizzle + PostgreSQL y Next.js 16 + Tailwind 4, docker-compose, GitHub Actions, `GET /api/health`, AGENTS.md con estas mismas reglas, README y ADR-0001. Todo en la rama `gemini/cimientos`.
3. Proyecto 2 (inventario y caja): la web es una PWA preparada para funcionar sin conexión, porque la internet de la isla falla. Tablas base: productos, sedes, stock por sede, usuarios.
4. Proyecto 3 (reservas): multiempresa desde el inicio (`empresa_id` en cada tabla). Tablas base: empresas, servicios, profesionales, horarios, reservas. Sin WhatsApp ni pagos todavía.
5. Antes de unir a `main`, revisión con Claude o por ti, con la misma lista de "Cómo revisar".

## Qué no delegar

- Cambios en `liquidacion/calculo.ts`, permisos (`*.policy.ts`, `alcance.ts`, `reglas-*.ts`), autenticación, `cifrado.ts` o `totp.ts`.
- Nuevas migraciones que modifiquen tablas existentes.
- Decisiones de alcance o de arquitectura.

## Cómo revisar lo que entrega Gemini

1. Lee el resumen y el diff completo; no aceptes cambios en archivos fuera de la lista.
2. Corre las pruebas y abre la pantalla afectada.
3. Busca permisos faltantes: toda ruta nueva debe tener `@Can`.
4. Si dudas, pídele a Claude que revise el pull request.
