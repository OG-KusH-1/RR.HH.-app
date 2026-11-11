# Propuesta: plataforma de gestión de personas

**Para:** Gerencia General, Comercial Te Moana SpA
**De:** [Nombre del desarrollador]
**Fecha:** noviembre de 2026
**Validez:** 30 días

---

## 1. Resumen

Hoy una sola persona administra a mano las vacaciones, turnos, documentos y certificados de 52 trabajadores en 4 sedes. Eso consume unas 92 horas al mes, deja al equipo de Santiago esperando días por cada trámite y hace que la empresa dependa de una planilla Excel.

Propongo implementar **Tangata**, un portal donde cada trabajador resuelve sus trámites desde el celular y las jefaturas aprueban con un toque.

| | |
|---|---|
| Tiempo liberado | Cerca de 53 horas al mes |
| Valor de ese tiempo | $359.000 mensuales |
| Inversión inicial | $3.500.000 + IVA |
| Mensualidad | $150.000 + IVA |
| Plazo | 8 semanas de desarrollo y 6 de piloto |
| Recuperación de la inversión | 17 meses en el escenario base |

Tangata no reemplaza a la encargada de personas. Le quita el trabajo repetitivo para que se dedique a lo que una aplicación no puede hacer.

## 2. Lo que su empresa obtiene

1. **Vacaciones sin papeles.** Cada trabajador ve su saldo y solicita desde el celular. La jefatura aprueba viendo quién más estará ausente.
2. **Carpeta digital.** Contratos y anexos de todos, accesibles desde la isla y desde Santiago.
3. **Alertas de vencimiento.** Contratos a plazo fijo y licencias de conducir avisan con 30 días de anticipación.
4. **Certificados al instante.** El trabajador descarga su certificado de antigüedad, con código de verificación.
5. **Panel para gerencia.** Dotación y ausencias por sede, siempre al día.
6. **Registro de quién vio qué.** Preparado para la nueva ley de protección de datos.

En una segunda etapa, cotizada aparte: turnos de los minimarkets, archivo mensual para el contador y un asistente que responde dudas sobre el reglamento interno.

## 3. Lo que no incluye

- Cálculo de remuneraciones: sigue con su contador.
- Registro legal de asistencia: sigue con su sistema actual.
- Selección de personal, evaluaciones y canal de denuncias.
- Digitación de documentos históricos (se puede cotizar aparte).
- Equipos, celulares o conexión a internet.

## 4. Cómo trabajaremos

| Etapa | Duración | Usted recibe |
|---|---|---|
| Sprint 1 | 2 semanas | Ingreso seguro y roles funcionando |
| Sprint 2 | 2 semanas | Fichas y carpetas cargadas |
| Sprint 3 | 2 semanas | Vacaciones de punta a punta |
| Sprint 4 | 2 semanas | Alertas, certificados y panel |
| Piloto en Santiago | 3 semanas | 9 personas usando el sistema |
| Extensión a la isla | 3 semanas | Las 4 sedes operando |

Cada dos semanas hay una demostración. Si algo no sirve, se corrige en ese momento.

**Lo que necesito de la empresa:**

- 2 horas semanales de la encargada de personas.
- La planilla actual de trabajadores y saldos de vacaciones.
- Una persona de referencia por sede.
- Validación legal de las reglas de vacaciones por su abogado o asesor laboral.

## 5. Inversión

| Concepto | Valor |
|---|---|
| Implementación (única vez) | $3.500.000 + IVA |
| Mensualidad | $150.000 + IVA |

**La mensualidad incluye:** alojamiento en la nube, respaldos diarios, actualizaciones de seguridad, soporte en horario hábil y hasta 6 horas mensuales de mejoras menores.

**Forma de pago de la implementación:** 30 % al inicio, 40 % al terminar el sprint 4 y 30 % al cerrar el piloto con los criterios cumplidos.

**Condición de cliente piloto.** El desarrollo tiene un valor de mercado de $10.200.000. El precio ofrecido considera que:

- La propiedad del software queda en el desarrollador, que podrá ofrecerlo a otras empresas.
- Los datos son siempre de Comercial Te Moana, que puede exportarlos o pedir su eliminación en cualquier momento.
- La empresa autoriza a mencionar el proyecto como caso de referencia, sin revelar datos internos.

## 6. Comparación con alternativas

| | Seguir como hoy | Suite existente del mercado | Tangata |
|---|---|---|---|
| Costo mensual | $0 directo; 92 horas de trabajo | $208.000 a $416.000 | $150.000 |
| Inversión inicial | $0 | Baja | $3.500.000 |
| Incluye remuneraciones | No | Sí | No |
| Adaptada a la operación isla y Santiago | No | Estándar | Sí |
| Riesgo | Alto: depende de una persona | Bajo | Medio: producto nuevo |

Si su prioridad es integrar también las remuneraciones con el menor riesgo, una suite existente es una buena alternativa y con gusto le ayudo a evaluarla. Tangata conviene si valora una herramienta hecha a la medida de su operación, con menor costo mensual y que pueda crecer hacia inventario y ventas.

## 7. Riesgos y cómo se manejan

| Riesgo | Manejo |
|---|---|
| Que los trabajadores no la usen | Capacitación en cada local, ingreso con RUT, un mes de convivencia con el papel |
| Saldos iniciales con errores | Cada trabajador valida su saldo durante el piloto |
| Dependencia del desarrollador | Código documentado y entregable; datos exportables |
| Conexión lenta en la isla | Aplicación liviana, probada en los locales |

## 8. Garantías

- Si el piloto no cumple los criterios acordados, el último pago no se cobra.
- Corrección sin costo de errores durante 90 días desde el cierre del piloto.
- Contrato mensual después del primer año, sin permanencia.

## 9. Supuestos

- Dotación de 52 personas. Un cambio superior al 20 % ajusta la mensualidad.
- La información inicial se entrega en una planilla ordenada.
- Las cifras de ahorro se basan en la estimación de horas de la sección 5 del [descubrimiento](01-descubrimiento.md) y se medirán durante el piloto.

## 10. Próximo paso

Una reunión de 45 minutos con gerencia y la encargada de personas para validar los supuestos y fijar la fecha de inicio.

---

Detalle técnico y de costos: [caso de negocio](03-caso-de-negocio-y-costos.md), [alcance](04-alcance-y-requisitos.md), [plan](07-plan-mvp.md).
