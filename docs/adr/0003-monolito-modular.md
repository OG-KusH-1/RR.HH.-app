# ADR-0003. Monolito modular en vez de microservicios

**Estado:** Aceptada. **Fecha:** 2026-11-11.

## Contexto

El sistema tendrá 52 usuarios y un desarrollador. Los microservicios resuelven problemas de equipos grandes y cargas altas: despliegues independientes y escalado por separado. A cambio exigen operar varios servicios, redes entre ellos, trazas distribuidas y consistencia eventual.

## Decisión

Un solo servicio de API, dividido en módulos con fronteras estrictas: cada módulo expone un servicio público y nadie más toca sus tablas. La tabla Empresa existe desde el inicio para permitir varias empresas en el futuro.

## Consecuencias

- Un despliegue, una base de datos, un lugar donde buscar errores. Menor costo de nube.
- Las transacciones son simples: aprobar vacaciones y descontar saldo ocurren juntas o no ocurren.
- Si un módulo necesitara escalar por separado, sus fronteras ya permiten extraerlo.
- Riesgo: que las fronteras se rompan con el tiempo. Se controla con reglas de dependencias revisadas en la integración continua.

## Regla general

Se parte con un monolito ordenado y se extraen servicios solo cuando hay un motivo medible.
