# ADR-0002. No calcular remuneraciones

**Estado:** Aceptada. **Fecha:** 2026-11-11.

## Contexto

Un sistema de RR.HH. "completo" suele incluir el cálculo de sueldos. En Chile eso implica impuestos, cotizaciones, gratificaciones, topes que cambian todos los meses y la declaración en Previred. Un error se traduce en multas y en sueldos mal pagados. La empresa ya tiene un contador con software especializado.

## Decisión

Tangata no calcula remuneraciones. Entrega al contador un archivo mensual con las novedades (vacaciones, permisos, licencias informadas, ingresos y salidas).

## Consecuencias

- Se elimina el mayor riesgo legal y la mayor carga de mantención del proyecto.
- El contador no cambia su forma de trabajar: menor resistencia.
- Las suites del mercado sí integran remuneraciones. Es una desventaja real y se declara en la propuesta.
- A futuro se puede integrar con el software del contador en vez de reemplazarlo.
