# 06. Backlog

Historias de usuario con criterios de aceptación en formato Dado / Cuando / Entonces.

- **Prioridad** (MoSCoW): Imprescindible, Importante, Deseable.
- **Puntos:** esfuerzo relativo en la serie 1, 2, 3, 5, 8.
- **Etapa:** MVP, Fase 2 o Fase 3.

## Resumen

| Épica | Historias | Puntos | Etapa |
|---|---|---|---|
| E1. Acceso y roles | 4 | 13 | MVP |
| E2. Ficha del trabajador | 3 | 11 | MVP |
| E3. Vacaciones y permisos | 6 | 26 | MVP |
| E4. Documentos y vencimientos | 4 | 16 | MVP |
| E5. Certificados | 1 | 5 | MVP |
| E6. Auditoría y privacidad | 2 | 8 | MVP |
| E7. Reportes | 2 | 8 | MVP básico, Fase 2 |
| E8. Turnos | 3 | 18 | Fase 2 |
| E9. Asistente de IA | 2 | 13 | Fase 2 |
| **Total MVP** | **21** | **82** | |

---

## E1. Acceso y roles

### HU-01. Ingresar con RUT
**Como** trabajador **quiero** ingresar con mi RUT y una contraseña **para** usar el portal aunque no tenga correo de la empresa.

Prioridad: Imprescindible. Puntos: 3.

- Dado un trabajador activo, cuando ingresa su RUT y contraseña correctos, entonces entra a su página de inicio.
- Dado un RUT con formato o dígito verificador inválido, cuando intenta ingresar, entonces ve un mensaje de formato incorrecto sin consultar la base de datos.
- Dados 5 intentos fallidos seguidos, cuando intenta de nuevo, entonces la cuenta se bloquea por 15 minutos.
- El mensaje de error nunca revela si el RUT existe.

### HU-02. Primera contraseña
**Como** trabajador nuevo **quiero** crear mi contraseña con un enlace o código de un solo uso **para** que nadie más la conozca.

Prioridad: Imprescindible. Puntos: 3.

- Dado un trabajador recién creado, cuando Personas genera su invitación, entonces recibe un enlace o código válido por 48 horas.
- Dado un código ya usado o vencido, cuando se intenta usar, entonces se rechaza.
- La contraseña exige al menos 10 caracteres.

### HU-03. Permisos por rol y sede
**Como** encargada de personas **quiero** que cada usuario vea solo lo que le corresponde **para** proteger los datos de los trabajadores.

Prioridad: Imprescindible. Puntos: 5.

- Dado un trabajador, cuando intenta abrir la ficha de otro, entonces recibe acceso denegado.
- Dada una jefatura, cuando lista trabajadores, entonces ve solo a su equipo.
- Dado un usuario de Gerencia, cuando abre una ficha, entonces no ve documentos sensibles.
- Cada regla tiene una prueba automatizada.

### HU-04. Segundo factor para roles con más acceso
**Como** gerente **quiero** que las cuentas con acceso amplio pidan un código adicional **para** reducir el riesgo si roban una contraseña.

Prioridad: Importante. Puntos: 2.

- Dado un usuario con rol Personas, Gerencia o Administrador, cuando ingresa, entonces debe entregar un código de su aplicación de autenticación.

---

## E2. Ficha del trabajador

### HU-05. Crear y editar fichas
**Como** encargada de personas **quiero** registrar a cada trabajador con sus datos y contrato **para** tener una sola fuente de información.

Prioridad: Imprescindible. Puntos: 5.

- Dado un RUT ya registrado en la empresa, cuando se intenta crear otra ficha, entonces se rechaza.
- La ficha exige: nombres, RUT, fecha de ingreso, sede, cargo, jefatura y tipo de contrato.
- Cada cambio guarda quién lo hizo y cuándo.

### HU-06. Ver mis datos
**Como** trabajador **quiero** ver mis datos y pedir que corrijan un error **para** que mi información esté al día.

Prioridad: Importante. Puntos: 3.

- Dado un trabajador, cuando abre "Mis datos", entonces ve su información personal y contractual.
- Cuando solicita una corrección, entonces Personas recibe la solicitud y el trabajador ve su estado.

### HU-07. Carga inicial desde planilla
**Como** encargada de personas **quiero** importar a los 52 trabajadores desde un archivo **para** no digitarlos uno por uno.

Prioridad: Imprescindible. Puntos: 3.

- Dado un archivo con errores, cuando se importa, entonces el sistema muestra las filas con problema y no carga nada hasta corregirlas.
- El archivo incluye el saldo inicial de vacaciones de cada persona.

---

## E3. Vacaciones y permisos

### HU-08. Ver mi saldo
**Como** trabajador **quiero** ver cuántos días de vacaciones tengo **para** planificar sin preguntarle a nadie.

Prioridad: Imprescindible. Puntos: 5.

- Dado un trabajador con más de un año de servicio, cuando abre su saldo, entonces ve días ganados, tomados y disponibles.
- El saldo se calcula con 15 días hábiles por año, proporcional al tiempo trabajado.
- Puede ver el detalle de movimientos que explica el saldo.

### HU-09. Solicitar vacaciones
**Como** trabajador **quiero** pedir vacaciones desde el celular **para** no llenar papeles.

Prioridad: Imprescindible. Puntos: 5.

- Dado un rango de fechas, cuando lo selecciona, entonces el sistema muestra los días hábiles que consume, sin contar sábados, domingos ni feriados.
- Dado un saldo insuficiente, cuando intenta enviar, entonces se le informa cuántos días le faltan.
- Dada una solicitud que se cruza con otra ya aprobada, cuando la envía, entonces se rechaza.
- Al enviar, la jefatura recibe un aviso.

### HU-10. Aprobar o rechazar
**Como** jefatura **quiero** resolver solicitudes viendo quién más estará ausente **para** no dejar el local sin personal.

Prioridad: Imprescindible. Puntos: 5.

- Dada una solicitud pendiente, cuando la abre, entonces ve las ausencias aprobadas de su equipo en esas fechas.
- Cuando rechaza, entonces debe escribir un motivo.
- Cuando aprueba, entonces el saldo se descuenta y el trabajador recibe aviso.
- Una jefatura no puede aprobar su propia solicitud.

### HU-11. Feriado progresivo
**Como** encargada de personas **quiero** que el sistema sume los días adicionales por antigüedad **para** que los saldos sean correctos.

Prioridad: Importante. Puntos: 3.

- Dado un trabajador con años de servicio acreditados, cuando se calcula su devengo anual, entonces se agrega el feriado progresivo según la regla configurada.
- Personas puede registrar años trabajados con empleadores anteriores, con el documento de respaldo.

### HU-12. Permisos y otras ausencias
**Como** trabajador **quiero** informar un permiso o una licencia **para** que quede registrada.

Prioridad: Importante. Puntos: 5.

- Los tipos de ausencia son configurables: permiso con goce, permiso sin goce, licencia médica informada, permisos legales.
- Una licencia médica se registra como dato sensible, visible solo para Personas.
- La jefatura ve la ausencia y sus fechas, pero no el diagnóstico ni el documento.

### HU-13. Calendario del equipo
**Como** jefatura **quiero** un calendario con las ausencias de mi equipo **para** planificar.

Prioridad: Importante. Puntos: 3.

- El calendario muestra ausencias aprobadas y pendientes del mes.
- Las fechas se muestran en la hora de la sede.

---

## E4. Documentos y vencimientos

### HU-14. Subir documentos a la carpeta
**Como** encargada de personas **quiero** guardar los documentos de cada trabajador **para** dejar de depender de carpetas físicas.

Prioridad: Imprescindible. Puntos: 5.

- Se aceptan PDF e imágenes de hasta 10 MB.
- Cada documento tiene tipo, fecha de vencimiento opcional y nivel de visibilidad.
- Los archivos se guardan cifrados y nunca tienen dirección pública.

### HU-15. Ver mis documentos
**Como** trabajador **quiero** descargar mi contrato y mis anexos **para** tenerlos cuando los necesite.

Prioridad: Imprescindible. Puntos: 3.

- Dado un trabajador, cuando abre "Mis documentos", entonces ve solo los suyos marcados como visibles para él.
- El enlace de descarga caduca a los 5 minutos.

### HU-16. Alertas de vencimiento
**Como** encargada de personas **quiero** recibir avisos antes de que venza un documento **para** actuar a tiempo.

Prioridad: Imprescindible. Puntos: 5.

- Dado un documento con vencimiento, cuando faltan 30, 15 y 5 días, entonces Personas y la jefatura reciben aviso.
- Dado un contrato a plazo fijo próximo a vencer, entonces el aviso indica que requiere una decisión.
- Existe una vista con todo lo que vence en los próximos 60 días.

### HU-17. Documentos faltantes
**Como** encargada de personas **quiero** saber a quién le falta algún documento obligatorio **para** completar las carpetas.

Prioridad: Deseable. Puntos: 3.

- Se define una lista de documentos obligatorios por cargo.
- Un reporte muestra los faltantes por sede.

---

## E5. Certificados

### HU-18. Certificado de antigüedad
**Como** trabajador **quiero** descargar mi certificado de antigüedad **para** presentarlo en el banco sin esperar.

Prioridad: Imprescindible. Puntos: 5.

- El PDF incluye nombre, RUT, cargo, fecha de ingreso, tipo de contrato y fecha de emisión.
- Incluye un código que un tercero puede verificar en una página pública.
- La página de verificación muestra solo la validez y los datos del certificado.
- Cada emisión queda registrada.

---

## E6. Auditoría y privacidad

### HU-19. Registro de accesos
**Como** gerente **quiero** saber quién vio o cambió datos personales **para** responder ante un reclamo o fiscalización.

Prioridad: Imprescindible. Puntos: 5.

- Se registran: ingresos, vistas de fichas ajenas, descargas de documentos y todo cambio.
- El registro no se puede editar ni borrar desde la aplicación.
- Personas puede filtrar por trabajador y por fecha.

### HU-20. Derechos del titular
**Como** trabajador **quiero** pedir una copia de mis datos **para** ejercer mis derechos.

Prioridad: Importante. Puntos: 3.

- El trabajador puede solicitar acceso o rectificación desde el portal.
- La solicitud queda con fecha y estado, y Personas recibe aviso.

---

## E7. Reportes

### HU-21. Panel de dotación (MVP)
**Como** gerente **quiero** ver la dotación por sede y las ausencias del mes **para** tener una visión general.

Prioridad: Importante. Puntos: 3.

- Muestra: trabajadores activos por sede, ausencias del mes y días de vacaciones acumulados por sede.

### HU-22. Archivo de novedades (Fase 2)
**Como** contador **quiero** recibir un archivo mensual con las novedades **para** calcular las remuneraciones sin pedir datos.

Prioridad: Importante. Puntos: 5.

- El archivo lista vacaciones, permisos, licencias informadas, ingresos y salidas del período.
- El formato se acuerda con el contador.

---

## E8. Turnos (Fase 2)

### HU-23. Armar y publicar turnos
**Como** jefe de local **quiero** armar la semana a partir de una plantilla **para** publicar el turno en minutos.

Puntos: 8.

- El sistema alerta si alguien supera sus horas semanales pactadas o no tiene su descanso.
- No permite asignar a alguien con vacaciones aprobadas.

### HU-24. Ver mi turno
**Como** trabajador **quiero** ver mi turno en el celular **para** no depender de la foto del grupo.

Puntos: 5.

### HU-25. Cambio de turno
**Como** trabajador **quiero** proponer un cambio con un compañero **para** resolver imprevistos.

Puntos: 5.

- El cambio requiere aceptación del compañero y aprobación de la jefatura.

---

## E9. Asistente de IA (Fase 2)

### HU-26. Preguntar sobre el reglamento
**Como** trabajador **quiero** preguntar en mis palabras sobre normas y beneficios **para** resolver dudas a cualquier hora.

Puntos: 8.

- Toda respuesta cita el documento y el artículo de origen.
- Si no hay respaldo en los documentos, responde que no lo sabe y ofrece derivar.
- No accede a datos personales.

### HU-27. Derivación de temas sensibles
**Como** encargada de personas **quiero** que el asistente me derive los temas delicados **para** atenderlos personalmente.

Puntos: 5.

- Preguntas sobre acoso, despido, sanciones o salud no reciben respuesta automática; se entrega la vía de contacto.

---

## Definición de terminado

Una historia está terminada cuando:

1. Cumple todos sus criterios de aceptación.
2. Tiene pruebas automatizadas de sus reglas.
3. Fue revisada en un pull request.
4. Funciona en un celular de 360 píxeles de ancho.
5. Está desplegada en el entorno de pruebas.
6. La documentación afectada fue actualizada.

## Por qué lo hicimos así

- **Criterios de aceptación verificables.** Son el contrato entre lo que pidió el cliente y lo que se entrega, y se convierten directamente en pruebas.
- **Puntos en vez de horas.** Estimar tamaño relativo es más confiable que adivinar horas exactas.
- **El MVP es chico a propósito.** 82 puntos caben en 8 semanas; lo demás espera a que el piloto confirme que la gente lo usa.

---

## E10. Remuneraciones (Fase 3)

**Estado (2026-11-11): HU-28 y HU-29 implementadas en modo referencia.** Diseño en [10. Liquidaciones](10-liquidaciones.md).

Las fórmulas de una liquidación son deterministas: con parámetros correctos, el resultado es correcto. El riesgo real está en **mantener los parámetros al día** (UF, UTM, tramos de impuesto, topes, tasas de cada AFP y planes de Isapre) y en los casos de borde (licencias parciales, ingresos a mitad de mes, horas extra). Por eso entra en la fase 3 y en modo de referencia antes de reemplazar al contador.

### HU-28. Parámetros previsionales
**Como** encargada de personas **quiero** que el sistema tenga los indicadores del mes (UF, UTM, topes, tasas) **para** calcular sin digitarlos.

Puntos: 5.

- Los indicadores se cargan cada mes desde una fuente oficial o a mano, con fecha de vigencia.
- Un cálculo siempre usa los parámetros vigentes en su período.

### HU-29. Liquidación de referencia
**Como** encargada de personas **quiero** que el sistema calcule una liquidación con los datos del mes **para** compararla con la del contador.

Puntos: 13.

- Calcula sueldo base proporcional, horas extra con recargo, gratificación con tope, descuentos de AFP, salud, seguro de cesantía e impuesto único.
- Muestra cada línea con su fórmula.
- Un conjunto de liquidaciones reales verificadas sirve como pruebas automáticas.

### HU-30. Comparación con el contador
**Como** gerente **quiero** ver las diferencias entre el cálculo del sistema y el del contador **para** decidir cuándo confiar en el sistema.

Puntos: 5.
