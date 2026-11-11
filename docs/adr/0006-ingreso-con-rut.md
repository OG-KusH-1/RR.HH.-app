# ADR-0006. Ingreso con RUT y contraseña

**Estado:** Aceptada. **Fecha:** 2026-11-11.

## Contexto

Solo administración y jefaturas tienen correo corporativo. Cajeros, reponedores y bodegueros no. Un inicio de sesión único con Google o Microsoft dejaría fuera a la mayoría.

## Opciones

| Opción | Problema |
|---|---|
| Inicio de sesión con Google o Microsoft | La mayoría no tiene cuenta corporativa |
| Correo personal y contraseña | Correos mal escritos o en desuso |
| Código por SMS o WhatsApp | Costo por mensaje y dependencia de la señal |
| **RUT y contraseña** | Hay que proteger bien las contraseñas |

## Decisión

Ingreso con RUT y contraseña para todos. Segundo factor obligatorio para los roles con más acceso. La autenticación queda aislada en su propio módulo para agregar más adelante inicio de sesión único mediante OpenID Connect.

## Consecuencias

- Todos pueden entrar con algo que ya conocen.
- La recuperación de contraseña sin correo pasa por la encargada de personas, que genera un código de un solo uso.
- Las contraseñas se guardan con hash Argon2 y hay bloqueo por intentos fallidos.
