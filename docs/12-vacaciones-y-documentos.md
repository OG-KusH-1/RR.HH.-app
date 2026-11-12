# 12. Vacaciones, documentos, seguridad y turnos

Diseño de los módulos construidos después del Sprint 1. Cada sección explica qué resuelve, la regla legal o de negocio que aplica, cómo está hecho y qué queda fuera. Las reglas puras tienen pruebas en el archivo `*.spec.ts` de su carpeta.

## Vacaciones y ausencias (HU-08 a HU-13)

Código: `apps/api/src/ausencias/`.

### Reglas legales aplicadas

| Regla | Norma | Dónde |
|---|---|---|
| 15 días hábiles de feriado por año de servicio | Art. 67 CT | `saldo-vacaciones.ts` |
| El sábado es siempre inhábil para el feriado | Art. 69 CT | `calendario-laboral.ts` |
| Un día adicional por cada 3 años sobre 10 trabajados; máximo 10 años con empleadores anteriores | Art. 68 CT | `diasProgresivos()` |
| Acumulación máxima de dos períodos (se avisa, no se borra) | Art. 70 CT | `excedeAcumulacion` |
| Feriados legales en la base de datos, con fuente | Ley 2.977 y modificaciones | tabla `feriados` |

### Cómo se calcula el saldo

El saldo **no se guarda**: se calcula cada vez.

```
saldo = devengado (desde la fecha de ingreso) + suma del libro de movimientos
```

- **Devengado**: 1/12 del derecho anual por cada mes completo de servicio. El derecho anual de cada mes usa los años acumulados a ese mes, así el día progresivo empieza a devengarse cuando se cumple el tramo.
- **Libro de movimientos** (`movimientos_vacaciones`): solo se inserta. Tomado (negativo), devolución por cancelación (positivo), ajuste de Personas (con motivo) y días tomados antes de Tangata.
- **Disponible**: antes del primer año es 0, salvo un ajuste de Personas (adelanto pactado). Las solicitudes pendientes reservan sus días.

Por qué un libro y no un número editable: igual que en contabilidad, cada día del saldo se puede explicar y un error se corrige con otro movimiento, nunca borrando. La pantalla "Ver cómo se calcula" muestra justamente ese libro.

### Casos calculados a mano (también son pruebas)

| Caso | Cálculo | Resultado |
|---|---|---|
| Ingreso 1-mar-2024, corte 12-nov-2026, tomó 25 | 32 meses × 15/12 = 40; 40 − 25 | 15 días |
| 10 años previos, ingreso 1-ene-2020, corte 1-ene-2026 | 35 × 15/12 + 36 × 16/12 + 17/12 | 93,17 días, derecho anual 17 |
| Ingreso 10-may-2026, corte 12-nov-2026 | 6 × 1,25 = 7,5 devengados, pero sin año cumplido | 0 disponibles, cumple el 10-may-2027 |
| Vacaciones del 21 al 31 de diciembre de 2026 | 9 días de lunes a viernes, menos Navidad | 8 días hábiles |

### Flujo y permisos

1. El trabajador elige fechas y ve en vivo días hábiles, saldo resultante y problemas (la API calcula; la interfaz no).
2. Al enviar, la jefatura recibe aviso. Si no tiene jefatura, Personas.
3. La jefatura ve quién más del equipo falta esas fechas y aprueba o rechaza con motivo.
4. Al aprobar se revalida todo con la fila bloqueada (`SELECT … FOR UPDATE`): dos aprobaciones simultáneas no descuentan dos veces.
5. Nadie aprueba lo propio. Personas y Gerencia sirven de respaldo.

Licencias médicas: se informan, no se aprueban. El folio y diagnóstico (`detalle_reservado`) solo lo ven el titular y Personas; la jefatura ve fechas.

### Límites conocidos

- No valida el fraccionamiento (10 días continuos como mínimo); se informa en pantalla.
- Zonas extremas con 20 días base: el parámetro existe (`diasBaseAnuales`) pero no se configura por sede todavía.

## Documentos (HU-14 a HU-17)

Código: `apps/api/src/documentos/`, `apps/api/src/common/cifrado.ts`.

### Seguridad, paso a paso

| Paso | Qué se hace | Por qué |
|---|---|---|
| Tipo de archivo | Se detecta por los primeros bytes (PDF, PNG, JPEG) | Un ejecutable renombrado a .pdf se rechaza |
| Huella | SHA-256 del original | Demuestra que el archivo no cambió |
| Cifrado | AES-256-GCM con clave en `CLAVE_CIFRADO` | Quien acceda al disco o al bucket ve datos ilegibles; GCM detecta alteraciones |
| Ubicación | Clave interna aleatoria, nunca una URL pública | El nombre del archivo no revela datos |
| Descarga | Enlace firmado con HMAC, 5 minutos, atado al usuario y que además exige la sesión | Un enlace copiado a un chat no sirve a otra persona ni más tarde |
| Auditoría | Cada subida, descarga y eliminación | Responder "quién vio el contrato de X" |

Visibilidad por documento: `TRABAJADOR` (la persona y Gerencia), `INTERNO` (Personas y Gerencia), `RESERVADO` (solo Personas). La jefatura nunca ve documentos; sí recibe el aviso de que algo de su equipo vence.

**La clave de cifrado es crítica**: si se pierde, los archivos no se recuperan. Va en el gestor de secretos del hosting y en un respaldo fuera de línea.

### Avisos de vencimiento

Proceso diario a las 07:30 (hora de Chile continental). Umbrales: 30, 15 y 5 días, y al vencer. Se usa el umbral más chico alcanzado: si el servidor estuvo caído un día, igual avisa, sin mandar tres avisos juntos. Cada aviso lleva una clave única en la base de datos, así correr el proceso dos veces no duplica (idempotencia).

Contratos a plazo fijo: el aviso dice "requiere una decisión" y lista las opciones. El sistema no renueva ni termina contratos.

### Documentos faltantes

Tabla `documentos_requeridos` por cargo (`*` = toda la empresa). Un documento vencido cuenta como faltante.

## Certificados verificables (HU-18)

Código: `apps/api/src/certificados/`.

- Código de 12 caracteres con alfabeto Crockford (sin I, L, O, U para dictarlo sin errores): 60 bits de azar.
- QR con el enlace a `/verificar/<código>`, página pública sin cuenta, con límite de 20 consultas por minuto.
- La verificación muestra solo lo que dice el papel, con el RUT parcialmente oculto.
- Se guarda una copia de lo impreso: si la ficha cambia, el certificado sigue diciendo lo mismo. Personas puede revocarlo con motivo.

## Acceso y cuentas (HU-02, HU-04)

Código: `apps/api/src/auth/acceso.service.ts`, `totp.ts`.

- **Invitación**: código de 10 caracteres, válido 48 horas, de un solo uso. Se guarda solo su SHA-256. Activar exige RUT + código. Un código nuevo anula el anterior.
- **Contraseñas**: mínimo 10 caracteres, sin reglas de símbolos (guía NIST SP 800-63B: la longitud protege más).
- **Segundo factor TOTP** (RFC 6238), compatible con Google o Microsoft Authenticator. Implementado con `node:crypto` y probado con los vectores oficiales del RFC. El secreto se guarda cifrado. Obligatorio para Personas, Gerencia y Administración (`SEGUNDO_FACTOR_OBLIGATORIO`): un interceptor bloquea toda la API hasta activarlo.
- El intento con código incorrecto cuenta para el bloqueo de 15 minutos. El ingreso exitoso se registra después del segundo factor, no antes.

## Fichas, auditoría y privacidad (HU-05 a HU-07, HU-19, HU-20)

- Crear una ficha crea su usuario sin contraseña. Editar guarda en auditoría el antes y después de cada campo (nunca sueldos).
- Desvincular no borra: deja la ficha inactiva, cierra sesiones e informa el saldo de vacaciones a la fecha de término (base del feriado proporcional del finiquito, que calcula el contador).
- Roles: Personas asigna roles de negocio; solo Administración asigna ADMIN; nadie cambia su propio rol.
- Carga desde planilla: si una fila falla, no se carga nada. El saldo de la planilla se registra como diferencia con lo devengado.
- Auditoría con filtros; consultarla también queda registrado.
- Copia de los datos propios en JSON, al instante, incluido quién vio la ficha.

## Turnos (HU-23 a HU-25) y novedades (HU-22)

Código: `apps/api/src/turnos/`.

| Regla | Nivel | Norma |
|---|---|---|
| Turno sobre una ausencia aprobada | Error, no guarda | Regla de negocio |
| Turno en feriado irrenunciable | Error | Ley 19.973 (comercio) |
| Más de 10 horas ordinarias en el día | Alerta | Art. 28 CT |
| Más de 6 días en la semana | Alerta | Art. 28 CT |
| Horas sobre la jornada pactada | Alerta (serían horas extra) | Ley 21.561: máximo 42 h desde el 26-04-2026 |
| Menos de 2 domingos libres en el mes | Alerta | Art. 38 N°7 CT (comercio) |

Las horas se guardan como texto `HH:MM` en la hora de la sede. La colación no cuenta como jornada.

El archivo de novedades cuenta las ausencias dentro del mes: hábiles para vacaciones y permisos, corridos para licencias. Las horas sobre jornada se estiman desde turnos publicados: **no es un registro de asistencia**, que ante la Dirección del Trabajo exige un sistema certificado.

### Límites conocidos

- Un turno por persona y día (sin turnos partidos).
- Plantillas: se usa "copiar semana anterior"; no hay plantillas con nombre.
