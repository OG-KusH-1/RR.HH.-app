# Reglas para agentes y personas que programan en Tangata

Este archivo lo leen las herramientas de IA (Claude, Gemini en Antigravity, Copilot) y cualquier persona nueva en el proyecto. Si una regla choca con lo que te pidieron, pregunta antes de romperla.

## Contexto en tres líneas

- Portal de RR.HH. para pymes con varias sedes. Cliente piloto ficticio: Comercial Te Moana SpA (Rapa Nui y Santiago).
- Monorepo pnpm: `apps/api` (NestJS 12, Drizzle, PostgreSQL) y `apps/web` (Next.js 16, React 19, Tailwind 4). Todo en TypeScript.
- La documentación de negocio y arquitectura está en `docs/`. Lee `docs/05-arquitectura.md` y los ADR antes de cambiar algo estructural.

## Reglas que no se negocian

1. **Permisos en la API, siempre.** La interfaz puede ocultar botones, pero la API decide. Toda ruta nueva lleva `@Can(...)` o revisa la política en el servicio. Denegar por defecto.
2. **Nada de parámetros legales en el código.** UF, UTM, topes, tasas AFP, SIS y tramos de impuesto viven en la base de datos con fecha de vigencia y fuente. Solo `apps/api/src/previsional/liquidacion/parametros-legales.ts` guarda reglas fijas por ley, cada una con la norma citada.
3. **Datos personales.** Toda vista de una ficha ajena, liquidación o documento se registra con `AuditoriaService`. Los sueldos nunca van al detalle de auditoría ni a los logs. Las jefaturas no ven sueldos.
4. **Secretos fuera del repositorio.** Variables en `.env` (ignorado) y `.env.example` sin valores reales.
5. **Sin decisiones automáticas sobre personas.** El sistema informa; contratar, despedir, sancionar o aprobar lo hace una persona.
6. **Archivos siempre cifrados.** Todo archivo pasa por `cifrar()` antes del almacén y se descarga solo con enlace firmado de corta vida. Nunca URLs públicas.
7. **Libros, no saldos editables.** Vacaciones y avisos automáticos se registran como movimientos o con clave única; un error se corrige con otro movimiento, nunca editando el anterior.

## Mapa de módulos de la API

| Carpeta | Responsabilidad |
|---|---|
| `auth/` | Ingreso, sesiones, invitaciones, segundo factor (TOTP) |
| `employees/` | Fichas, alcance por rol, carga desde planilla |
| `ausencias/` | Saldo de vacaciones, solicitudes, calendario, feriados |
| `documentos/` | Carpeta cifrada, enlaces firmados, vencimientos, faltantes |
| `certificados/` | Certificados con código y verificación pública |
| `turnos/` | Turnos semanales, cambios, archivo de novedades |
| `previsional/` | Indicadores, AFP y salud, liquidación de referencia |
| `privacidad/` | Consulta de auditoría y derechos del titular |
| `panel/` | Resumen para gerencia |
| `avisos/` | Avisos dentro del portal; único punto para notificar |
| `audit/` | Registro de auditoría, solo inserción |

## Estilo de código

- Nombres de dominio en español (`trabajador`, `liquidacion`), palabras técnicas en inglés cuando son estándar (`controller`, `service`).
- Funciones de cálculo puras y aisladas de la base de datos, como `calcularLiquidacion`.
- Validación de entrada con Zod en el controlador (`@Body({ schema })`).
- Importaciones relativas con extensión `.js` en la API (ESM).
- En la web: componentes cliente con `"use client"`, datos vía `src/lib/api.ts`, textos en español de Chile, en voz activa y sin disculpas en los errores.

## Comentarios: para quien mantenga el código después

Se comenta el **porqué**, no el qué. Obligatorio en:

- **Cabecera de cada archivo con lógica de negocio**: qué resuelve, qué queda fuera y dónde está la documentación.
- **Reglas legales o de negocio**: la norma o la decisión que las origina (artículo, ley, ADR).
- **Decisiones no obvias**: por qué se devuelve 404 en vez de 403, por qué un redondeo va antes que otro.
- **Límites conocidos**: lo que el código no hace todavía y la historia de usuario que lo cubrirá.

No se comenta lo que el código ya dice (`// suma uno`).

## Pruebas

- `pnpm --filter @tangata/api test` debe pasar antes de cada commit.
- Toda regla de cálculo o de permisos nueva lleva prueba. Los casos de liquidación se calculan a mano primero y se documentan en `docs/10-liquidaciones.md`.
- Las fuentes externas se prueban con respuestas grabadas, nunca contra internet.

## Flujo de trabajo

- Una rama por tarea: `feat/hu-12-permisos`, `gemini/<tarea>` para trabajo delegado a Gemini.
- Commits con Conventional Commits en español: `feat(previsional): ...`.
- Todo cambio entra por pull request con la checklist de `CONTRIBUTING.md`.
- No modificar migraciones ya aplicadas: se genera una nueva con `pnpm --filter @tangata/api db:generate`.

## Comandos útiles

```bash
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
pnpm --filter @tangata/api test
pnpm --filter @tangata/web lint
```
