# Estado y próximos pasos de Massimo — 6 oct 2026 CDMX

Auditoría de `main` en `04802be`, PR abiertos y PLAN/TAREAS/CHECKLIST. El líder conserva las decisiones de alcance. Entrega: **7 oct, 13:00 CDMX**; subida prevista antes de las **11:00**.

## Estado comprobado

| Ubicación | Trabajo disponible | Límite de aceptación |
|---|---|---|
| `main` | Contrato, BD y servicios SQL; cliente/mock; enrutador/auth; Carta/Baraja/Mano/Dealer; ZIP; arquitectura y evidencia T-06/T-11 | Lobby, compras WS, producción y motor todavía no están integrados |
| PR #22 (`acd560a`) | Tres mesas/asientos más correcciones de #21 y producción #24, fusionadas en esta rama | PR abierto con conflictos y revisión pendiente; no equivale a fusión en main |
| Cadena #28 → #29 → #30 → #31 → #32 → #33 | Resolución de manos, Mesa, relojes, acciones/billetera, liquidación SQL e historial, bots | Revisiones/rebases y aceptación final pendientes; conservar las correcciones nuevas de economía/auth/producción |
| PR #35 | Muestrario de 52 cartas y cinco reversos | Conflictos y revisión/fusión pendientes |

Avance: **18/57 (32 %)**. Hector 7/19 (37 %), Nahum 3/17 (18 %), Massimo 8/19 (42 %). H1 11/14, H2 5/19, H3 1/10, H4 0/8, H5 1/5. Semáforo rojo por hitos incumplidos; no existe `v0.9-congelado`.

## Evidencia de esta auditoría

Bun **1.3.13**, aislado del runtime global 1.4.2, PostgreSQL **16.15**, main `04802be`:

- Typecheck completo correcto.
- **236 pruebas / 3,540 aserciones**, cero fallos/omisiones.
- Build del cliente correcto (`bun run --filter @blackjack/client build`).
- Suites SQL con schemas aleatorios en la base de pruebas; sin db:reset.

Esta evidencia no acredita juego LAN, cinco rondas, instalación por otro integrante ni ZIP final. La evidencia histórica de integración en `t-09-integracion-local` conserva su snapshot; no prueba las ramas actuales del motor.

## 1. Trabajo de la próxima sesión

| Orden | Acción disponible | Responsable/apoyo | Resultado revisable |
|---|---|---|---|
| 1 | Apoyar correcciones y rebase de #22: transferencia de asiento/pestaña, cleanup aun ante errores, conflictos de seguimiento | Hector; apoyo de Massimo | Pruebas reales de reemplazo/logout/cierre, typecheck/suite SQL/build y diff que conserva #21/#24; aprobación del dueño antes de integrar |
| 2 | Revisar #28 y preparar actualizaciones sucesivas #29–#33; revisar contrato y composición de economía en #31 | Hector; Massimo revisa economía/contrato | No perder caducidad, logout compartido, cola por usuario, respuestas sin duplicados ni estáticos. Validar apuestas/pagos contra ledger, no solo tipos |
| 3 | Ayudar con #35 y comprobar T-13/T-30 después de que #22 llegue a main | Nahum; apoyo de Massimo en servidor/SQL | Muestrario sin conflictos; tres usuarios ven ocupación; compra de 1,000 actualiza saldos/disponible y agotamiento deshabilita compra |
| 4 | Preparar auditoría JSDoc y matriz de Funcionamiento de T-44; actualizar borradores T-32/T-48/T-50 al código revisado | Massimo | Evidencias por criterio, faltantes con dueño y diagramas exportables. No marcar checklist firmado ni cierre previo al congelamiento |
| 5 | Coordinar la instalación independiente según README (T-14) y la prueba de producción/manual (T-48) al estar lista | Nahum; Massimo corrige manual | Registro de versión/base/comandos/tiempo/problemas; la prueba inicial de entorno/acceso puede empezar antes del motor, la aceptación final requiere el recorrido previsto |

Las correcciones de #22 siguen siendo la primera acción que habilita trabajo de varias personas. #28 puede revisarse en paralelo porque T-16 ya está fusionada. Cada merge con squash requiere actualizar la siguiente rama sobre la nueva base y volver a verificar los cruces; cerrar un PR apilado no demuestra presencia en main.

### Responsabilidades de Massimo restantes

| Tarea | Qué puede adelantarse | Qué falta para cerrarla |
|---|---|---|
| T-14 | Corregir README con los problemas de la instalación independiente | Nahum lo sigue en su laptop sin ayuda |
| T-22 | Consumidor y billetera falsa ya existen en #31; firmas comparadas con main, sin diferencias | Verificación/revisión de la integración de T-20 |
| T-31 | Preparar tres cuentas/laptops, escenarios y consultas SQL | Cinco rondas y compras reales con los tres, sin errores |
| T-32 | Diagramas según clases publicadas, anotando base | Mesa integrada y diagramas renderizados que coincidan con el código |
| T-35 | Identificar API de fase/publicación al integrar Mesa | T-18, validación BLOQUEADO_EN_MANO, posesión y snapshot; confirmar alcance de tienda/cosméticos con el líder |
| T-43 | Registrar faltantes y estabilidad; solicitar decisión del líder en la coordinación del equipo | Alcance acordado, H3 terminado conforme a ese alcance, main estable y tag |
| T-44 | Matriz de cobertura y preparación de escenarios | Funcionamiento completo verificado o cada fallo con issue/dueño/fecha; firma de otro integrante |
| T-46 | Auditoría shared/db/store y handlers disponibles | Congelamiento y revisión de Hector |
| T-48 | Mantener manual sincronizado con producción revisada | Instalación desde cero por Nahum siguiendo solo el manual |
| T-50 | Diccionario SQL listo; completar diagramas del motor y exportarlos | T-32/T-45 y confirmación de Hector sobre código final |
| T-57 | Preparar checklist de subida/descarga y nombre del artefacto | ZIP aprobado en T-55, ensayos, subida antes de las 11:00 y descarga verificada |

T-54 ya está cerrada: regenerar el ZIP acompaña a la integración, pero no sustituye T-55. Tienda/cosméticos T-39/T-40 siguen pospuestos; Massimo no decide su corte ni su reactivación.

## 2. Secuencia restante hasta la entrega

1. **Integrar y comprobar lo esencial:** #22 y cadena del motor; desconexión/reserva de 60 s (T-36), límite de 20/s (T-37) y producción. El líder confirma el criterio de corte de PLAN §10; estas funciones esenciales no se eliminan por cuenta de Massimo.
2. **Cerrar integración con clientes:** T-13/T-28/T-29/T-30/T-41/T-42; tres laptops, cinco rondas, compras/límite, desconexión y recuperación, resultados y rondas persistidas con reconciliación de movimientos. Registrar incidencias y corregirlas.
3. **Congelar y revisar:** tag T-43 cuando proceda; T-44 completo, JSDoc por otro integrante, arquitectura y manuales sincronizados con la misma versión. Exportar diagramas para leerlos dentro del ZIP.
4. **Preparar exposición:** aprobación de guion/diapositivas por los tres, video de respaldo, ensayos T-52/T-56 cronometrados. Responsable Nahum/equipo; Massimo prepara su bloque de economía/transacciones y participa.
5. **Aceptar el paquete:** regenerar con el empaquetador aprobado; T-48 instalación independiente y T-55 desde descomprimir hasta jugar con tres pestañas en ≤ 15 min. Probar portabilidad en Windows si ese será el equipo de entrega/demo. Corregir problemas del manual y volver a probar el artefacto resultante.
6. **7 oct antes de las 11:00:** subir el mismo ZIP que pasó T-55, descargarlo y comprobar integridad/apertura; conservar confirmación de entrega. Límite oficial 13:00 CDMX.

Las fases anteriores son puertas de aceptación, no promesas de horario. Con menos de un día disponible, el mayor riesgo es que revisión/integración consuman el tiempo de prueba independiente y de ensayos. El líder debe decidir prioridades y corte; los contadores no se adelantan por tener código en un PR.
