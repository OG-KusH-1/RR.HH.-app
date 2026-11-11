# ADR-0004. Fechas en UTC y zona horaria por sede

**Estado:** Aceptada. **Fecha:** 2026-11-11.

## Contexto

La empresa opera en Rapa Nui (`Pacific/Easter`) y en Santiago (`America/Santiago`), con 2 horas de diferencia. Ambas zonas cambian de horario durante el año. Un error típico: una solicitud hecha a las 23:00 en la isla queda registrada con la fecha del día siguiente.

## Decisión

- Los instantes (cuándo se aprobó algo) se guardan en UTC.
- Las fechas de calendario (un día de vacaciones) se guardan como fecha sin hora.
- Cada sede tiene su zona horaria con nombre IANA; nunca un desfase fijo como "-2".
- La interfaz muestra las horas en la zona de la sede del usuario.

## Consecuencias

- Los cambios de horario los resuelve la base de datos de zonas horarias del sistema, sin código propio.
- Los feriados se definen por sede.
- Se requieren pruebas automáticas específicas de casos de borde: medianoche y días de cambio de hora.
