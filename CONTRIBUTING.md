# Forma de trabajo

## Ramas

- `main`: siempre desplegable. No se sube código directo.
- `feat/hu-09-solicitar-vacaciones`: una rama por historia.
- `fix/...`, `docs/...`, `chore/...` para lo demás.

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/es/):

```
feat(vacaciones): calcular días hábiles sin contar sábados
fix(auth): bloquear cuenta tras 5 intentos
docs(adr): agregar decisión sobre zonas horarias
```

## Pull requests

1. Enlazar la historia (por ejemplo, `Cierra HU-09`).
2. Explicar qué cambia y cómo probarlo.
3. Las pruebas automáticas deben pasar.
4. Revisar la lista de "definición de terminado" del [backlog](docs/06-backlog.md).

## Secretos

Ninguna clave, token o contraseña va en el repositorio. Se usan variables de entorno locales (archivo `.env`, ignorado por git) y un gestor de secretos en la nube.
