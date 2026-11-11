# 04. Alcance y requisitos

## 1. Roles

| Rol | Quién | Qué puede hacer |
|---|---|---|
| Trabajador | Todos | Ver sus datos, turnos, saldo y documentos; solicitar vacaciones y permisos; descargar certificados |
| Jefatura | Jefes de local, bodega y operaciones | Lo anterior, más aprobar solicitudes y gestionar turnos de su equipo |
| Personas | Encargada de personas | Gestionar fichas, documentos, saldos y reportes de toda la empresa |
| Gerencia | Gerente general, finanzas | Ver paneles y reportes; no edita fichas |
| Administrador | Soporte técnico | Configurar sedes, roles y parámetros; no ve documentos personales |

## 2. Alcance por etapa

| Módulo | MVP | Fase 2 | Fase 3 |
|---|---|---|---|
| Ingreso seguro y roles | Sí | | |
| Ficha del trabajador | Sí | | |
| Vacaciones y permisos | Sí | | |
| Carpeta digital y vencimientos | Sí | | |
| Certificado de antigüedad | Sí | | |
| Registro de auditoría | Sí | | |
| Turnos de minimarkets | | Sí | |
| Reportes y panel de gerencia | Básico | Completo | |
| Archivo de novedades para el contador | | Sí | |
| Ingreso y salida de trabajadores | | Sí | |
| Asistente de IA sobre el reglamento | | Sí | |
| Firma electrónica de documentos | | | Sí |
| Varias empresas en la misma plataforma | | | Sí |

## 3. Fuera de alcance

| Qué | Por qué |
|---|---|
| Cálculo de remuneraciones y cotizaciones | Alto riesgo legal y ya lo resuelve el software del contador ([ADR-0002](adr/0002-no-calcular-remuneraciones.md)) |
| Registro legal de asistencia | Los sistemas electrónicos de asistencia deben cumplir exigencias específicas de la Dirección del Trabajo ([ADR-0005](adr/0005-asistencia-fuera-del-mvp.md)) |
| Selección de personal | Decisión humana; no aporta al problema principal |
| Evaluaciones de desempeño | No es un dolor actual |
| Canal de denuncias de acoso | Requiere un procedimiento formal propio de la Ley Karin; no se improvisa dentro de otra herramienta |
| Aplicación nativa para celular | El portal web adaptable cubre la necesidad a menor costo |

## 4. Requisitos funcionales principales

El detalle está en el [backlog](06-backlog.md). Resumen:

- **RF-01.** Ingreso con RUT y contraseña; recuperación por correo o por la encargada de personas.
- **RF-02.** Cada usuario ve solo lo que su rol y su sede permiten.
- **RF-03.** El saldo de vacaciones se calcula automáticamente: 15 días hábiles por año de servicio, más feriado progresivo.
- **RF-04.** Las solicitudes siguen un flujo: solicitada, aprobada o rechazada, tomada.
- **RF-05.** Cada documento tiene tipo, fecha de vencimiento opcional y control de quién puede verlo.
- **RF-06.** El sistema avisa los vencimientos a 30, 15 y 5 días.
- **RF-07.** El certificado de antigüedad se genera en PDF con código de verificación.
- **RF-08.** Toda acción sobre datos personales queda registrada: quién, qué y cuándo.

## 5. Requisitos no funcionales

| Categoría | Requisito | Cómo se verifica |
|---|---|---|
| Rendimiento | La pantalla principal carga en menos de 3 segundos con conexión 3G | Prueba con limitación de red en el navegador |
| Tolerancia a cortes | La aplicación muestra los últimos datos vistos si se pierde la conexión | Prueba manual sin red |
| Uso en celular | Todas las funciones del trabajador operan en una pantalla de 360 píxeles de ancho | Revisión en dispositivos reales |
| Disponibilidad | 99,5 % mensual | Monitoreo |
| Respaldo | Copia diaria de la base de datos, retención de 30 días, restauración probada | Ejercicio de restauración trimestral |
| Seguridad | Cifrado en tránsito y en reposo; contraseñas con hash seguro; bloqueo tras intentos fallidos | Revisión contra OWASP Top 10 |
| Privacidad | Acceso mínimo por rol; documentos sensibles visibles solo para Personas | Pruebas de permisos automatizadas |
| Zonas horarias | Fechas guardadas en UTC y mostradas en la hora de cada sede | Pruebas automáticas |
| Accesibilidad | Contraste y tamaño de letra legibles; navegación simple | Lista de verificación WCAG nivel AA en pantallas clave |
| Mantenibilidad | Cobertura de pruebas sobre 70 % en reglas de negocio | Reporte del proceso de integración continua |
| Idioma | Español; textos preparados para agregar rapa nui a futuro | Textos centralizados |

## 6. Restricciones

- Presupuesto acotado: un desarrollador durante 8 semanas.
- Los trabajadores usan sus propios celulares, de gama media o baja.
- La conexión en la isla puede ser lenta.
- El contador no cambiará su software.

## Por qué lo hicimos así

- **La lista de "fuera de alcance" es tan importante como la de alcance.** Evita la discusión más común de los proyectos: "yo pensé que eso venía incluido".
- **Los requisitos no funcionales tienen una forma de verificarse.** "Que sea rápido" no se puede probar; "menos de 3 segundos en 3G" sí.
