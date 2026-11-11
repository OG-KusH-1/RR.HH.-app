# 08. Marco legal

> Este documento identifica las normas que afectan el diseño. **No es asesoría legal.** Antes de operar con datos reales, un abogado laboral debe revisar las reglas implementadas. Estado de la información: noviembre de 2026.

## 1. Resumen

| Norma | Qué exige | Cómo afecta al sistema |
|---|---|---|
| Código del Trabajo | Reglas de contrato, jornada, feriado anual y documentación | Cálculo de vacaciones; alertas de contratos; carpeta digital |
| Ley 21.561 (40 horas) | Reducción gradual de la jornada | Horas semanales configurables por contrato; validación en turnos |
| Ley 21.719 (datos personales) | Tratamiento lícito, seguro y transparente de datos | Permisos mínimos, auditoría, derechos del titular |
| Ley 21.643 (Ley Karin) | Prevención e investigación del acoso laboral | El sistema no gestiona denuncias; el asistente deriva |

## 2. Jornada de trabajo

La Ley 21.561 reduce la jornada de forma gradual: 44 horas desde abril de 2024, **42 horas desde el 26 de abril de 2026** y 40 horas desde el 26 de abril de 2028 ([Ministerio del Trabajo](https://www.mintrab.gob.cl/40horas/)).

Consecuencias de diseño:

- Las horas semanales son un dato del contrato y no un valor fijo en el código. En 2028 cambian sin reprogramar.
- El módulo de turnos alerta cuando alguien supera su jornada pactada.

### Registro de asistencia

El empleador está obligado a llevar un registro de asistencia, y la Dirección del Trabajo fija por dictamen los estándares que deben cumplir los sistemas electrónicos ([Ministerio del Trabajo](https://www.mintrab.gob.cl/40horas/)). La fiscalización se ha reforzado con la reducción de jornada ([CNN Chile](https://www.cnnchile.com/pais/ley-40-horas-empresas-chilenas-enfrentan-nuevo-ajuste-operativo-desde-abril-de-2026-con-reduccion-a-42-horas-semanales_20260310/)).

**Decisión:** Tangata no reemplaza el registro legal de asistencia en el MVP. Construir un sistema de marcación sin cumplir esos estándares expondría a la empresa. Ver [ADR-0005](adr/0005-asistencia-fuera-del-mvp.md).

## 3. Feriado anual (vacaciones)

Reglas del Código del Trabajo que el sistema implementa. Los artículos deben confirmarse con el abogado:

| Regla | Implementación |
|---|---|
| 15 días hábiles al año tras un año de servicio | Devengo mensual proporcional |
| El sábado se considera inhábil para el feriado | El calendario no cuenta sábados, domingos ni feriados |
| Feriado progresivo por antigüedad | Regla configurable; años con otros empleadores se acreditan con documento |
| Límites a la acumulación de períodos | Alerta a Personas cuando un trabajador acumula más de un período |

Las reglas se guardan como parámetros para ajustarlas sin modificar el código si cambia la ley o la interpretación.

## 4. Protección de datos personales

La Ley 21.719 reemplaza casi por completo el régimen anterior y crea la Agencia de Protección de Datos Personales. Su texto fija la entrada en vigencia el **1 de diciembre de 2026**. Las multas pueden llegar a 20.000 UTM.

**Situación a noviembre de 2026:** el Senado aprobó en primer trámite, el 28 de octubre de 2026, un proyecto que posterga la vigencia al 15 de octubre de 2027; mientras ese proyecto no se publique como ley, la fecha vigente sigue siendo el 1 de diciembre de 2026 ([Garrigues](https://www.garrigues.com/es_ES/noticia/chile-redefine-marco-privacidad-ciberseguridad-nuevas-reglas-cumplimiento-cambios.md)).

**Decisión:** el sistema se diseña cumpliendo la ley desde el primer día, cualquiera sea la fecha final.

| Principio | Medida en Tangata |
|---|---|
| Finalidad | Cada dato tiene un propósito declarado: administrar la relación laboral |
| Minimización | Solo se piden los datos necesarios; no hay campos "por si acaso" |
| Seguridad | Cifrado, control de acceso por rol, auditoría |
| Datos sensibles | Salud y afiliación sindical con acceso restringido y registrado |
| Derechos del titular | El trabajador puede pedir acceso y rectificación desde el portal (HU-20) |
| Decisiones automatizadas | Ninguna decisión sobre una persona la toma el sistema |
| Encargados de tratamiento | El proveedor de nube y el de IA se declaran; el contrato define responsabilidades |
| Conservación | Plazos de retención definidos por tipo de documento |

### Sobre el asistente de IA

- No recibe datos personales de los trabajadores.
- Se identifica siempre como sistema automático.
- Sus respuestas son informativas; ante una diferencia, prevalece el documento oficial.

## 5. Ley Karin

La Ley 21.643 obliga a las empresas a contar con un protocolo de prevención y un procedimiento de investigación del acoso laboral, sexual y la violencia en el trabajo.

**Decisión:** Tangata no incluye un canal de denuncias. Ese procedimiento exige confidencialidad, plazos y garantías propias. El sistema solo publica el protocolo vigente en la sección de documentos de la empresa, y el asistente deriva cualquier consulta sobre el tema a la vía formal.

## 6. Documentos laborales electrónicos

La digitalización de documentos laborales y su firma electrónica tienen requisitos fijados por la Dirección del Trabajo. En el MVP la carpeta digital guarda **copias** de los documentos firmados en papel; los originales se conservan. La firma electrónica queda para la fase 3, previa revisión legal.

## 7. Pendientes para validar con un abogado

1. Reglas exactas de feriado progresivo y acumulación.
2. Plazos de conservación de cada tipo de documento.
3. Texto del aviso de privacidad para los trabajadores.
4. Contrato de encargo de tratamiento de datos con el proveedor.
5. Requisitos para la firma electrónica de anexos.
6. Si existe alguna norma especial aplicable a los trabajadores de Rapa Nui.

## Por qué lo hicimos así

- **Las leyes definen el alcance.** Dos de las decisiones más importantes del proyecto (no calcular sueldos y no registrar asistencia) nacen de este análisis.
- **Se declara lo que no se sabe.** La lista de pendientes para el abogado protege al cliente y al desarrollador.
- **Reglas como parámetros.** La ley cambia; el código no debería tener que cambiar con ella.
