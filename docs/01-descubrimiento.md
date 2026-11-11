# 01. Descubrimiento

Objetivo de esta fase: entender la empresa y el problema antes de proponer cualquier solución.

> Todo lo que describe a la empresa es un **supuesto de diseño** (la empresa es ficticia). En un proyecto real, cada supuesto se valida en entrevistas. La tabla de la sección 7 indica cómo.

## 1. Perfil de la empresa

**Comercial Te Moana SpA** distribuye abarrotes, bebidas y licores en Rapa Nui. Abastece a almacenes, hoteles y restaurantes de la isla y opera dos minimarkets propios. Casi toda su mercadería se compra en el continente, se consolida en una bodega en Santiago y viaja a la isla por barco (carga general) o por avión (perecibles y urgencias).

| Sede | Ubicación | Dotación | Cargos principales |
|---|---|---|---|
| Distribuidora | Hanga Roa | 14 | Bodegueros, choferes repartidores, vendedores, jefe de bodega |
| Minimarket 1 | Hanga Roa | 11 | Cajeros, reponedores, jefa de local |
| Minimarket 2 | Hanga Roa | 10 | Cajeros, reponedores, jefe de local |
| Bodega de consolidación | Santiago | 9 | Recepción de carga, despacho, comprador, jefe de operaciones |
| Administración | Hanga Roa | 8 | Gerente general, finanzas, encargada de personas, asistentes |
| **Total** | | **52** | |

Datos de contexto que condicionan la solución:

- **Dos husos horarios.** Rapa Nui está 2 horas detrás de Santiago. Una solicitud enviada a las 17:00 en Santiago llega a las 15:00 de la isla; al revés, lo que la isla envía a las 17:00 llega a Santiago fuera de horario.
- **Conectividad variable** en la isla. La aplicación debe ser liviana y tolerar cortes.
- **Trabajadores sin correo corporativo.** Solo administración y jefaturas tienen correo de la empresa. Cajeros, reponedores y bodegueros usan su celular personal y WhatsApp.
- **Turnos.** Los minimarkets abren los 7 días, con turnos rotativos. La distribuidora y Santiago trabajan de lunes a sábado.
- **Remuneraciones externalizadas.** Un contador externo calcula sueldos y cotizaciones con su propio software.

## 2. Cómo se gestiona hoy a las personas

| Proceso | Herramienta actual | Responsable |
|---|---|---|
| Vacaciones y permisos | Papel firmado + planilla Excel de saldos | Encargada de personas |
| Turnos de minimarkets | Hoja impresa en el local + grupo de WhatsApp | Jefes de local |
| Asistencia | Libro de asistencia en papel por sede | Jefaturas; la encargada consolida |
| Contratos, anexos y documentos | Carpetas físicas en la oficina de Hanga Roa | Encargada de personas |
| Certificados y copias de liquidación | Se piden por WhatsApp o en persona | Encargada de personas |
| Ingreso y salida de trabajadores | Lista mental; depende de la memoria de quien lo hace | Encargada de personas |
| Informes para gerencia | Se arman a mano cuando se piden | Encargada de personas |

## 3. Personas clave (stakeholders)

| Persona | Qué necesita | Qué le preocupa |
|---|---|---|
| Gerente general (dueño) | Saber dotación, ausentismo y horas extra sin pedir informes | Costo, multas, depender de una sola persona |
| Encargada de personas | Dejar de responder lo mismo todo el día | Perder control, quedar reemplazada |
| Jefes de local y de bodega | Armar turnos sin conflictos y saber quién falta | Más trabajo administrativo |
| Trabajadores de la isla | Saber cuántas vacaciones les quedan y su turno | Que sea complicado de usar en el celular |
| Trabajadores de Santiago | Hacer trámites sin esperar a la isla | Sentirse lejos de la administración |
| Contador externo | Recibir novedades del mes ordenadas y a tiempo | Cambiar su forma de trabajar |

## 4. Dolores detectados

1. **RR.HH. depende de una sola persona.** Si la encargada se enferma o renuncia, nadie sabe el saldo de vacaciones de nadie.
2. **El equipo de Santiago está aislado.** Sus documentos están en una carpeta a 3.700 km. Cada trámite toma días.
3. **Saldos de vacaciones poco confiables.** La planilla se actualiza a mano, con errores que aparecen recién en los finiquitos.
4. **Turnos conflictivos.** Los cambios se acuerdan por WhatsApp y no queda registro de quién aprobó qué.
5. **Vencimientos que nadie vigila.** Contratos a plazo fijo que se renuevan tarde, licencias de conducir de choferes vencidas.
6. **Cierre de mes lento.** Consolidar asistencia y novedades para el contador toma varios días.
7. **Gerencia sin información.** No hay cifras de ausentismo, rotación ni horas extra.
8. **Exposición legal.** La jornada bajó a 42 horas en abril de 2026 y la fiscalización del registro de asistencia se reforzó (ver [marco legal](08-marco-legal.md)).

## 5. Carga administrativa actual (línea base)

Horas mensuales estimadas dedicadas a tareas administrativas de personal:

| Tarea | Encargada de personas | Jefaturas | Total |
|---|---|---|---|
| Vacaciones y permisos | 14 | 0 | 14 |
| Certificados y copias de documentos | 10 | 0 | 10 |
| Turnos y cambios de turno | 4 | 16 | 20 |
| Consolidar asistencia y novedades del mes | 16 | 4 | 20 |
| Contratos, documentos y vencimientos | 8 | 0 | 8 |
| Ingresos y salidas | 6 | 0 | 6 |
| Informes para gerencia | 6 | 0 | 6 |
| Preguntas frecuentes | 6 | 2 | 8 |
| **Total** | **70** | **22** | **92** |

92 horas al mes equivalen a media jornada completa (la jornada de 42 horas semanales son 182 horas mensuales).

## 6. Objetivos del proyecto

| Objetivo | Indicador | Meta a 6 meses |
|---|---|---|
| Reducir la carga administrativa | Horas mensuales en las tareas de la tabla anterior | De 92 a menos de 45 |
| Autoservicio | Solicitudes de vacaciones hechas en la plataforma | Más del 90 % |
| Rapidez | Tiempo entre solicitud y respuesta de vacaciones | De días a menos de 24 horas hábiles |
| Cero vencimientos sorpresa | Documentos vencidos sin alerta previa | 0 |
| Integrar a Santiago | Trámites de Santiago resueltos sin papel | 100 % |
| Adopción | Trabajadores que entran al menos una vez al mes | Más del 80 % |

## 7. Supuestos y cómo validarlos

| Supuesto | Cómo se valida en un proyecto real |
|---|---|
| Dotación y distribución por sede | Libro de remuneraciones o nómina del contador |
| Horas mensuales por tarea | Registro de tiempos de la encargada durante 2 semanas |
| Sueldos usados en el caso de negocio | Costo empresa real informado por finanzas |
| Trabajadores sin correo corporativo | Encuesta breve por WhatsApp |
| Calidad de la conexión en cada sede | Prueba de velocidad en cada local en horario punta |
| El contador acepta recibir un archivo de novedades | Reunión con el contador y revisión del formato de su software |

## Por qué lo hicimos así

- **Primero el problema, después el software.** La mayoría de los proyectos que fracasan resolvieron bien un problema que nadie tenía.
- **Supuestos escritos.** Un supuesto declarado se puede corregir; uno escondido se convierte en un error caro.
- **Línea base en horas.** Sin una medida del "antes" no se puede demostrar el ahorro del "después".
