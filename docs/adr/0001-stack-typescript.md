# ADR-0001. TypeScript de punta a punta

**Estado:** Aceptada. **Fecha:** 2026-11-11.

## Contexto

Un solo desarrollador construirá y mantendrá el sistema. Tiene experiencia con React y JavaScript, Spring Boot, y Angular con TypeScript. El producto debe funcionar bien en celulares con conexión lenta y poder crecer a varias empresas.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| React + Spring Boot | Ya conocido; Java muy pedido en empresas grandes | Dos lenguajes; más código repetido entre frontend y backend |
| Angular + NestJS | Mismo estilo en ambos lados | Angular tiene menos oferta laboral y es más pesado para móviles |
| **Next.js + NestJS + PostgreSQL** | Un solo lenguaje; tipos compartidos; React es lo más pedido; NestJS se parece a Spring Boot y Angular | Hay que aprender Next.js y el ORM |

## Decisión

Next.js con React en el frontend, NestJS en la API, PostgreSQL con Drizzle ORM, todo en TypeScript, en un solo repositorio.

## Consecuencias

- Los tipos de datos se definen una vez y se comparten entre frontend y backend.
- NestJS usa módulos, decoradores e inyección de dependencias, igual que Spring Boot y Angular: lo aprendido se reutiliza.
- PostgreSQL cubre datos relacionales y, en la fase 2, búsqueda semántica para el asistente con la extensión pgvector, sin sumar otra base de datos.
- Costo: curva de aprendizaje de Next.js y Drizzle durante el sprint 1.

## Actualización (2026-11-11, sprint 1)

Se reemplazó Prisma por **Drizzle ORM**. Motivos: NestJS 12 ofrece integración oficial con Drizzle (`@nestjs/drizzle`), Drizzle no necesita un paso de generación de cliente y sus consultas se parecen a SQL, lo que ayuda a aprender SQL de verdad. La autenticación usa `@nestjs/authentication` y los permisos `@nestjs/authorization`, ambos oficiales.
