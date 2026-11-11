# @tangata/api

API de Tangata (NestJS 12, Drizzle ORM, PostgreSQL).

| Módulo | Qué hace |
|---|---|
| `auth` | Ingreso con RUT, sesiones en PostgreSQL, bloqueo tras 5 intentos |
| `employees` | Fichas de trabajadores con visibilidad por rol |
| `audit` | Registro de quién vio o cambió qué |
| `db` | Esquema, relaciones y datos de demostración |

```bash
pnpm db:generate   # crea una migración a partir de cambios en src/db/schema.ts
pnpm db:migrate    # aplica migraciones pendientes
pnpm db:seed       # carga Comercial Te Moana con 52 trabajadores
pnpm test          # pruebas unitarias
```
