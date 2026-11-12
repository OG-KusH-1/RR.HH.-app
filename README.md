# Tangata RR.HH.

Plataforma de gestión de personas para pymes con varias sedes. Caso de estudio: **Comercial Te Moana SpA**, una distribuidora de abarrotes y licores de Rapa Nui con 52 trabajadores repartidos entre la isla y Santiago.

> **Aviso:** Comercial Te Moana SpA es una empresa ficticia, modelada a partir de la realidad de una distribuidora isleña. Las cifras internas de la empresa son supuestos declarados en cada documento. Los datos legales y de mercado tienen su fuente citada.

*Tangata* significa "persona" en rapa nui.

## Estado del proyecto

| Fase | Estado |
|---|---|
| 1. Descubrimiento y caso de negocio | Completa |
| 2. Arquitectura y backlog | Completa |
| 3. MVP (21 historias) | Completo |
| 4. Fase 2 sin integraciones externas: turnos y novedades | Completa |
| 5. Integraciones: correo, WhatsApp, almacenamiento S3, asistente de IA, Previred | Pendiente |
| 6. Piloto en una sede | Pendiente |

## El problema en una frase

Una persona administra a mano (Excel, WhatsApp, carpetas y libros de papel) las vacaciones, turnos, documentos y certificados de 52 trabajadores en 4 sedes separadas por 3.700 km y 2 horas de diferencia horaria.

## La solución

Un portal web donde cada trabajador resuelve solo sus trámites frecuentes, las jefaturas aprueban desde el celular, y RR.HH. deja de ser una mesa de ayuda para dedicarse a las personas.

| Módulo | Qué hace |
|---|---|
| Acceso | Ingreso con RUT, invitación de un solo uso, segundo factor obligatorio para roles amplios |
| Fichas | Crear, editar, desvincular y cargar desde planilla, con auditoría campo a campo |
| Vacaciones y ausencias | Saldo legal calculado (progresivo incluido), solicitud con vista previa, aprobación con conflictos del equipo, licencias con datos reservados, calendario |
| Documentos | Carpeta digital cifrada, enlaces de descarga de 5 minutos, avisos de vencimiento, carpetas incompletas |
| Certificados | Antigüedad en PDF con QR y verificación pública |
| Turnos | Grilla semanal con reglas del Código del Trabajo, publicación y cambios de turno |
| Remuneraciones | Liquidación de referencia con indicadores que se actualizan solos y Personas confirma |
| Reportes | Panel de gerencia, novedades del mes para el contador en CSV |
| Privacidad | Auditoría consultable, copia de datos propios, solicitudes de rectificación |
| Avisos | Campana dentro del portal (correo y WhatsApp en la fase de integraciones) |

Lo que **no** hace, por diseño: no reemplaza la liquidación oficial del contador (todavía), no reemplaza el registro legal de asistencia y no toma decisiones sobre personas. Las razones están en los [ADR](docs/adr/).

## Documentación

| Documento | Para quién |
|---|---|
| [01. Descubrimiento](docs/01-descubrimiento.md) | Entender la empresa y sus dolores |
| [02. Procesos actuales y futuros](docs/02-procesos.md) | Ver qué se automatiza y qué sigue siendo humano |
| [03. Caso de negocio y costos](docs/03-caso-de-negocio-y-costos.md) | Gerencia: cuánto cuesta y cuánto ahorra |
| [04. Alcance y requisitos](docs/04-alcance-y-requisitos.md) | Qué entra y qué queda fuera |
| [05. Arquitectura](docs/05-arquitectura.md) | Equipo técnico |
| [06. Backlog](docs/06-backlog.md) | Historias de usuario con criterios de aceptación |
| [07. Plan del MVP](docs/07-plan-mvp.md) | Sprints, piloto, métricas y riesgos |
| [08. Marco legal](docs/08-marco-legal.md) | Cumplimiento en Chile |
| [09. Propuesta comercial](docs/09-propuesta-comercial.md) | El documento que se entrega al cliente |
| [10. Liquidaciones](docs/10-liquidaciones.md) | Cálculo de referencia, fuentes de datos y fórmulas |
| [11. Plan con Antigravity](docs/11-plan-antigravity.md) | Qué tareas delegar a Gemini y cómo revisarlas |
| [12. Vacaciones, documentos, seguridad y turnos](docs/12-vacaciones-y-documentos.md) | Reglas legales, casos calculados a mano y diseño de seguridad |
| [AGENTS.md](AGENTS.md) | Reglas para agentes de IA y personas nuevas |
| [Decisiones de arquitectura (ADR)](docs/adr/) | Por qué se eligió cada cosa |

## Stack

TypeScript de punta a punta: Next.js (frontend), NestJS (API), PostgreSQL con Drizzle, desplegado en AWS con Terraform y GitHub Actions. Justificación en el [ADR-0001](docs/adr/0001-stack-typescript.md).

## Cómo ejecutarlo

Requisitos: Node 22, pnpm 10 y Docker (o un PostgreSQL local).

```bash
pnpm install
docker compose up -d db                 # PostgreSQL en el puerto 5432
cp apps/api/.env.example apps/api/.env
# Completa CLAVE_CIFRADO y SECRETO_ENLACES con: openssl rand -base64 32
# En tu computador puedes poner SEGUNDO_FACTOR_OBLIGATORIO=false para probar sin celular.
pnpm db:migrate                         # crea las tablas
pnpm db:seed                            # carga la empresa de demostración
pnpm dev                                # API en :4000 y portal en :3000
```

Abre http://localhost:3000 e ingresa con un usuario de demostración. La contraseña de todos es `Tangata2026!`.

| Rol | RUT | Persona |
|---|---|---|
| Gerencia | 12.400.137-4 | Rodrigo Pakarati, gerente general |
| Personas | 12.400.274-5 | Marcela Tuki, encargada de personas |
| Jefatura | 12.403.151-6 | Josefina Teave, jefa del minimarket |
| Trabajador | 12.403.288-1 | Camila Hotus, cajera |

Recorrido sugerido: Camila pide vacaciones → Josefina ve que Fernanda ya estará ausente y decide → Marcela revisa vencimientos y carpetas incompletas → Rodrigo abre el panel. Josefina también puede copiar la semana anterior en "Armar turnos" y publicarla.

Cada uno ve cosas distintas: prueba con los cuatro.

## Cómo se trabaja en este repositorio

Ver [CONTRIBUTING.md](CONTRIBUTING.md): ramas, formato de commits y definición de terminado.

## Autor

Proyecto de portafolio de [OG-KusH-1](https://github.com/OG-KusH-1), estudiante de Ingeniería en Informática.
