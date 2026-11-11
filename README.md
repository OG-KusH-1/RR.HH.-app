# Tangata RR.HH.

Plataforma de gestión de personas para pymes con varias sedes. Caso de estudio: **Comercial Te Moana SpA**, una distribuidora de abarrotes y licores de Rapa Nui con 52 trabajadores repartidos entre la isla y Santiago.

> **Aviso:** Comercial Te Moana SpA es una empresa ficticia, modelada a partir de la realidad de una distribuidora isleña. Las cifras internas de la empresa son supuestos declarados en cada documento. Los datos legales y de mercado tienen su fuente citada.

*Tangata* significa "persona" en rapa nui.

## Estado del proyecto

| Fase | Estado |
|---|---|
| 1. Descubrimiento y caso de negocio | Completa |
| 2. Arquitectura y backlog | Completa |
| 3. MVP (8 semanas, 4 sprints) | Por iniciar |
| 4. Piloto en una sede | Pendiente |

## El problema en una frase

Una persona administra a mano (Excel, WhatsApp, carpetas y libros de papel) las vacaciones, turnos, documentos y certificados de 52 trabajadores en 4 sedes separadas por 3.700 km y 2 horas de diferencia horaria.

## La solución

Un portal web donde cada trabajador resuelve solo sus trámites frecuentes, las jefaturas aprueban desde el celular, y RR.HH. deja de ser una mesa de ayuda para dedicarse a las personas.

- Vacaciones y permisos con saldo automático y flujo de aprobación.
- Ficha del trabajador y carpeta digital con alertas de vencimiento.
- Turnos de los minimarkets publicados y con cambios trazables.
- Certificados en autoservicio.
- Reportes para gerencia.
- Fase 2: asistente de IA que responde dudas sobre el reglamento interno.

Lo que **no** hace, por diseño: no calcula remuneraciones, no reemplaza el registro legal de asistencia y no toma decisiones sobre personas. Las razones están en los [ADR](docs/adr/).

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
| [Decisiones de arquitectura (ADR)](docs/adr/) | Por qué se eligió cada cosa |

## Stack

TypeScript de punta a punta: Next.js (frontend), NestJS (API), PostgreSQL con Prisma, desplegado en AWS con Terraform y GitHub Actions. Justificación en el [ADR-0001](docs/adr/0001-stack-typescript.md).

## Cómo se trabaja en este repositorio

Ver [CONTRIBUTING.md](CONTRIBUTING.md): ramas, formato de commits y definición de terminado.

## Autor

Proyecto de portafolio de [OG-KusH-1](https://github.com/OG-KusH-1), estudiante de Ingeniería en Informática.
