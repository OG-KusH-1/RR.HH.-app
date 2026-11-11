# 03. Caso de negocio y costos

Valores en pesos chilenos, sin IVA. Fecha de las cifras: noviembre de 2026.

## 1. Conclusión

- La plataforma libera cerca de **53 horas al mes** de trabajo administrativo, un 57 % de la carga actual.
- Eso equivale a unos **$359.000 mensuales** en tiempo recuperado.
- Con el precio propuesto, la inversión se recupera en **17 meses** en el escenario base.
- **La plataforma no reemplaza a la encargada de personas.** Le devuelve media jornada para tareas que hoy no alcanza a hacer.
- Para una sola empresa, un software ya existente es una alternativa razonable. La sección 6 compara ambas opciones sin maquillaje.

## 2. Supuestos

| Supuesto | Valor | Origen |
|---|---|---|
| Jornada mensual | 182 horas | 42 horas semanales × 52 / 12 |
| Sueldo bruto encargada de personas | $1.200.000 | Supuesto a validar |
| Sueldo bruto promedio jefaturas | $950.000 | Supuesto a validar |
| Recargo por costos del empleador | 8 % | Supuesto: seguro de cesantía, SIS, mutual y cotización adicional |
| Costo hora encargada | $7.121 | $1.200.000 × 1,08 / 182 |
| Costo hora jefaturas | $5.637 | $950.000 × 1,08 / 182 |
| Tarifa de desarrollo | $20.000 por hora | Supuesto para perfil junior independiente; validar con el mercado |

## 3. Ahorro estimado

| Tarea | Horas actuales | Reducción esperada | Horas liberadas |
|---|---|---|---|
| Vacaciones y permisos | 14 | 75 % | 10,5 |
| Certificados y copias | 10 | 85 % | 8,5 |
| Turnos | 20 | 50 % | 10,0 |
| Asistencia y novedades del mes | 20 | 35 % | 7,0 |
| Documentos y vencimientos | 8 | 60 % | 4,8 |
| Ingresos y salidas | 6 | 50 % | 3,0 |
| Informes para gerencia | 6 | 80 % | 4,8 |
| Preguntas frecuentes | 8 | 50 % | 4,0 |
| **Total** | **92** | **57 %** | **52,6** |

Costo actual de esas 92 horas: **$622.000 al mes**. Ahorro en el escenario base: **$359.000 al mes**.

La asistencia tiene la reducción más baja porque el registro legal no cambia en esta etapa; solo se ordena la entrega de novedades.

### Escenarios

| Escenario | Horas liberadas al mes | Ahorro mensual | Ahorro neto (menos mensualidad) | Recuperación de la inversión |
|---|---|---|---|---|
| Conservador (65 % del base) | 34 | $233.000 | $83.000 | 42 meses |
| **Base** | **53** | **$359.000** | **$209.000** | **17 meses** |
| Optimista (120 % del base) | 63 | $431.000 | $281.000 | 12,5 meses |

El escenario conservador ocurre si la adopción es baja. Por eso el [plan del MVP](07-plan-mvp.md) incluye capacitación y un piloto antes de extender a todas las sedes.

## 4. Beneficios que no se convirtieron a pesos

No se les asignó un monto porque no hay datos de la empresa para justificarlo:

- **Menor riesgo de multas.** Las infracciones de jornada se sancionan con multas que, según la Dirección del Trabajo, pueden ir de 3 a 60 UTM por trabajador afectado ([fuente](https://www.chilevision.cl/noticias/te-ayuda/ley-de-40-horas-cuando-es-la-proxima-reduccion-de-la-jornada-laboral-y-cuales-son-los-plazos/amp/)).
- **Finiquitos sin sorpresas.** Saldos de vacaciones correctos evitan pagos de más y reclamos.
- **Continuidad.** El conocimiento deja de estar en la cabeza de una persona.
- **Clima.** El equipo de Santiago recibe el mismo servicio que el de la isla.

## 5. Costos

### 5.1 Desarrollo del MVP (8 semanas)

| Actividad | Horas |
|---|---|
| Descubrimiento y diseño | 60 |
| Backend (API, base de datos, reglas) | 150 |
| Frontend (portal web adaptable a celular) | 150 |
| Pruebas | 50 |
| Infraestructura y despliegue automático | 40 |
| Capacitación y puesta en marcha | 30 |
| Gestión del proyecto | 30 |
| **Total** | **510** |

Valor de mercado: 510 horas × $20.000 = **$10.200.000**.

### 5.2 Operación mensual

| Ítem | Estimación mensual | Nota |
|---|---|---|
| Servidor de aplicación (contenedor pequeño) | US$ 10 a 15 | |
| Base de datos PostgreSQL administrada (instancia mínima) | US$ 15 a 20 | Con respaldos automáticos |
| Almacenamiento de documentos | US$ 1 a 3 | |
| Distribución web, DNS, correo transaccional, secretos | US$ 5 a 10 | |
| **Infraestructura** | **US$ 35 a 50** | |
| Asistente de IA (fase 2) | US$ 5 a 20 | Depende del uso |
| Soporte y mejoras menores | 6 horas | |

Los montos de infraestructura son órdenes de magnitud. Antes de firmar se cotizan con la [calculadora de precios de AWS](https://calculator.aws/) para la región elegida.

## 6. Comprar o construir

En Chile existen plataformas maduras de RR.HH. Una comparativa de 2026 sitúa a las suites completas como Buk y Talana entre $4.000 y $8.000 por colaborador al mes según los módulos contratados ([fuente](https://www.guiadesoftware.com/blog/mejor-software-rrhh-nomina-chile)). Buk ofrece además un plan gratuito para empresas de hasta 20 colaboradores, que no cubre a Te Moana ([fuente](https://www.buk.cl/quienes-somos/buk-mejores-softwares-rh/buk-vs-talana)).

| Criterio | Suite existente | Tangata (a medida) |
|---|---|---|
| Costo mensual para 52 personas | $208.000 a $416.000 | $150.000 |
| Inversión inicial | Baja; implementación guiada | $3.500.000 |
| Costo total a 3 años | $7,5 a $15 millones | $8,9 millones |
| Remuneraciones integradas | Sí | No; sigue con el contador |
| Tiempo de puesta en marcha | Semanas | 8 semanas de desarrollo más piloto |
| Madurez y soporte | Alta | Baja al inicio; depende de un proveedor pequeño |
| Adaptación a dos husos horarios y conexión inestable | Estándar | Diseñada para eso |
| Trabajadores sin correo | Varía | Ingreso con RUT |
| Integración futura con inventario y punto de venta | Limitada | Prevista |

**Recomendación honesta:**

- Si la empresa solo quiere resolver RR.HH. y valora el menor riesgo, **contratar una suite existente es una buena decisión**, sobre todo si de paso integra las remuneraciones.
- Tangata conviene si la empresa valora la adaptación a su realidad isleña, un costo mensual menor y el camino hacia una plataforma única con inventario y ventas.

### Por qué el precio propuesto es menor que el valor de mercado

El desarrollo vale $10.200.000 y se ofrece la implementación en $3.500.000. La diferencia se explica así:

- El desarrollador **conserva la propiedad del software** y puede ofrecerlo a otras pymes.
- Te Moana actúa como **cliente piloto**: aporta retroalimentación y permite usar el caso como referencia.
- El modelo de ingresos es la mensualidad, repartida entre varios clientes en el tiempo.

Es una práctica habitual al lanzar un producto. Debe quedar escrita en el contrato.

## 7. Punto de equilibrio del proveedor

Con una mensualidad de $150.000 y costos de infraestructura cercanos a $45.000 por cliente, el margen mensual ronda los $105.000. Con un solo cliente el proyecto no recupera su costo de desarrollo en un plazo razonable; el modelo necesita **5 o más clientes**. Por eso la arquitectura deja preparado el camino para atender a varias empresas ([ADR-0003](adr/0003-monolito-modular.md)).

## Por qué lo hicimos así

- **Tres escenarios en vez de una sola cifra.** Un cliente desconfía de una promesa única y confía en un rango con supuestos visibles.
- **Se dice cuándo conviene la competencia.** Recomendar la alternativa cuando corresponde es lo que hace creíble el resto de la propuesta.
- **No se prometió ahorrar un sueldo.** El ahorro real es media jornada; prometer más habría sido falso y fácil de desmentir.
