# ESTADO — ¿Dónde vamos?

_Última actualización: lun 5 oct 2026 CDMX, tras fusionar T-08 en PR #19. Algunas entradas históricas usan la fecha UTC del 6 oct._

## Resumen

Ya están en `main` los PR #4 (contrato, BD y economía), #6/#7 (cliente y mock), #14 (límites únicos), #18 (enrutador) y #19 (autenticación). `main` está protegida: un push directo es rechazado, cada PR necesita 1 aprobación de otro dev, el historial es lineal y solo se permite fusionar con squash (la rama se borra al fusionar).

El cliente del PR #7 consume el contrato compartido. T-07/T-08 ya permiten acceso real y consulta de billetera; las pantallas de mesa y el recorrido completo de economía siguen usando el mock hasta integrar sus servicios. Tras T-08, una copia extraída del ZIP de fuentes pasó instalación con lockfile fijo, typecheck, 203 pruebas con PostgreSQL 16.15 y build del cliente.

El camino crítico **T-01 → T-03 → T-07 → T-18 → T-20 → T-31** espera ahora T-09 y las clases T-15/T-16 necesarias para T-18.

## Hito actual

**Por calendario: Hito 4 — lun 5 oct** (pruebas y documentación). Mañana corresponde Hito 5 (ensayos y ZIP probado); entrega mié 7, 13:00.

Estado: 🔴 **Atrasados**. No se cumplieron el Hito 1 (30 sep), el Hito 2 (3 oct) ni el Hito 3/congelamiento (4 oct 22:00); no existe el tag `v0.9-congelado`.

> Semáforo: 🟢 a tiempo · 🟡 en riesgo (una tarea del camino crítico con > medio día de atraso) · 🔴 atrasados (el hito no se cumple en su fecha)

**Decisiones pendientes del equipo:**
- Aplicar el criterio de corte de PLAN §10 y decidir si se mueve el congelamiento.
- Confirmar con el equipo el criterio de corte y priorizar integración/pruebas del servidor frente a tareas de entrega aún abiertas.

## Avance

Solo se cuentan tareas con PR fusionado en `main` y criterio de "hecho" comprobado.

| Dev | Completadas | Total | % |
|---|---|---|---|
| Hector | 4 | 19 | 21 % |
| Nahum | 2 | 17 | 12 % |
| Massimo | 7 | 19 | 37 % |
| Equipo | 0 | 2 | 0 % |
| **Total** | **13** | **57** | **23 %** |

Avance por hito: H1 9/14 (64 %) · H2 3/19 (16 %) · H3 1/10 (10 %) · H4 0/8 · H5 0/5 · Entrega 0/1

- **Hechas:**
  - T-01, T-02, T-07 y T-08 (Hector); enrutador/auth fusionados y probados con sockets reales y PostgreSQL 16.
  - T-10 (Nahum, PR #6 fusionado en `main`; marca restaurada desde `main` durante la revisión del PR #7).
  - T-12 (Nahum, PR #16): vista de tienda de solo lectura en `?mock=1`.
  - T-04, T-05, T-23, T-24, T-25 y T-34 (Massimo). Su criterio está verificado con PostgreSQL 16 en Avance-M-02, que indicaba marcarlas al fusionarse el PR #4.
- **Fusionadas con un gate pendiente** (no cuentan):
  - T-06: prueba visual.
- **T-03 hecha:** PR #4 aporta contrato y pruebas; PR #14 centraliza límites; PR #7 integró el cliente que consume `@blackjack/shared`.
- **T-14 y T-22:** README/manual e interfaz `Billetera` están en `main`, pero sus criterios (instalación independiente e importación por Hector) carecen de evidencia de cierre; siguen pendientes.
- **PR #7 ya está en `main`:** T-11, T-12, T-27–T-30 y T-41 tienen implementación integrada; conservan casilla abierta cuando falta su criterio de aceptación completo.

## Bloqueos activos

- **T-07/T-08 fusionadas:** autenticación y consulta de billetera disponibles; faltan T-09/T-18 y conexión de compras/historial:
  - T-13 espera T-09;
  - T-28 y T-29 esperan T-18 y T-20;
  - T-30 y T-41 esperan los handlers de T-24/T-34 conectados al enrutador.
- **Cliente integrado (PR #7):** T-11 ya puede verificar recuperación de la misma sesión con T-08; falta documentar esa prueba del cliente real.
- **T-06 — prueba visual:** falta abrir `scripts/verificar-ws.html` en tres pestañas.
- **T-42** espera T-36. **T-35** espera `GestorMesas` (T-09/T-18). **T-31** espera T-20, T-21, T-28 y T-24.

## Hoy le toca a… (lun 5 oct, después de T-08)

- **Hector:**
  - Continuar Hito 2 hasta T-18: T-15 → T-16 → T-17 → máquina de estados. Alcance autorizado el 5 oct; T-19 y posteriores se retoman en otro chat. T-09 (PR #22) sigue pendiente de revisión/fusión.
  - Prueba visual de T-06.
- **Nahum:**
  - T-33 guion de exposición (PR #17 fusionado, pendiente de aprobación del grupo).
  - T-27 (desbloqueada por T-12): página de prueba con las 52 cartas → borradores de T-49 (manual) y T-51 (diapositivas) con capturas del mock.
  - Verificar reconexión cliente de T-11 con T-08; al llegar T-09, verificar T-13 contra el servidor real.
- **Massimo:**
  - Preparar la verificación de checklist T-44 cuando el equipo acuerde el corte.
  - Handlers de economía para el enrutador de T-07 y coordinación con Hector.
  - Adelantar empaquetado y documentación; las decisiones de alcance permanecen con el líder.

## Registro diario

| Fecha | Nota |
|---|---|
| 2026-10-05 | Hector: T-16 implementada en PR #27; dieciséis pruebas nuevas verifican Ases, natural, pasadas y dealer. Typecheck y 224 pruebas con PostgreSQL 16 pasan sin fallos/omisiones; pendiente revisión/fusión. |
| 2026-10-05 | Hector: T-15 implementada en PR #25; Carta/Baraja y cinco pruebas verifican composición, extracción y umbral. Typecheck y 208 pruebas con PostgreSQL 16 pasan sin fallos/omisiones. Pendiente revisión/fusión; no se suma al avance de main. |
| 2026-10-05 | Hector: T-07 implementada desde main con el contrato de PR #14 y cliente de PR #7 revisados; PR #18 en borrador. Typecheck correcto, 166 pruebas sin fallos (29 SQL omitidas por falta de TEST_DATABASE_URL) y build del cliente correcto. Seis pruebas nuevas con sockets reales cubren ataques, UTF-8, reqId, autorización y fallos async. T-06 visual sigue pendiente: el navegador no inició por fallo de ACL del entorno. |
| 2026-09-29 | Plan aprobado: `PLAN.md`, `TAREAS.md`, `ESTADO.md`, `CHECKLIST_ENTREGA.md`, `CLAUDE.md` creados. 57 tareas, 0 % completado. |
| 2026-10-01 | Hector: T-01 preparada localmente en t-01-monorepo-bun. bun install en clon limpio y typecheck correctos. Sin tests aun. PR #1 abierto; no se contabiliza como fusionada. |
| 2026-10-01 | Hector: plantilla T-02 publicada en PR #2 (borrador). Nahum aplicara la proteccion de main; pendiente comprobar rechazos. |
| 2026-10-01 | Hector: T-06 publicada en PR #3 (borrador). Tipos y 3 pruebas WebSocket correctos. Pendiente verificacion visual y revision; bienvenida confirmada y documentada en PLAN.md. Avance-H-01.md publicado para contexto del equipo. |
| 2026-10-04 | Massimo: T-03, T-04/T-05, T-22–T-25 y servicios T-34 preparados localmente; suite conjunta typecheck + 70 tests/381 aserciones con PostgreSQL real. README/manual/arquitectura y empaquetador preparados parcialmente. Ver Avance-M-01.md. |
| 2026-10-04 | Massimo: trabajo anterior publicado en PR #4 (abierto, sin revisión). |
| 2026-10-04 | T-01 hecha por Hector (PR #1); auditoría en clon limpio de main. T-02: main sin protección. T-06: falta prueba visual. Congelamiento no alcanzado; avance 1/57 (2 %). Ver Avance-M-02.md. |
| 2026-10-04 | Massimo: entorno objetivo verificado (Bun 1.3.13 + PostgreSQL 16.15, clon limpio). Gates de T-04 y T-05 cumplidos y 70 pruebas sin fallos; se cuentan al fusionarse el PR #4. |
| 2026-10-05 | Nahum: T-10 en PR #6. Vite 7 + React 19 + Tailwind 4, proxy /ws, vite --host; typecheck, pruebas y build correctos. Pendiente: abrirlo desde otra laptop por IP. |
| 2026-10-05 | Nahum: T-11 en PR #7 (sobre #6). Conexion con reconexion 1/2/4/8/10 s, reqId con timeout de 8 s, validacion Zod de entrada y salida, reanudar automatico, desfase de reloj por ping, reductor y controlador; 45 pruebas del cliente. Reconexion verificada reiniciando el servidor de T-06; falta volver con la misma sesion (requiere T-08). |
| 2026-10-05 | Nahum: T-12 en PR #8 (sobre #7). ServidorFalso con las validaciones del contrato, fixtures de las 6 fases comprobados con shared y modo ?mock=1; recorrido acceso, lobby, mesa en 6 fases, billetera e historial verificado sin backend. 70 pruebas del cliente. |
| 2026-10-05 | Nahum: T-27 (avance) en PR #9 (sobre #8). Carta en CSS, Ficha en SVG, Asiento, ManoDealer y MesaVisual con el dealer al centro y un color por asiento; 77 pruebas. Falta la pagina de prueba con las 52 cartas. |
| 2026-10-05 | Nahum: T-30 y T-41 (avance) en PR #10 (sobre #9). Billetera e historial en un menu lateral accesible desde lobby y mesa; compra con validacion previa y clave por clic verificada en el mock. Falta probar contra T-24 y movimientos.listar reales. |
| 2026-10-05 | Nahum: T-28 (avance) en PR #11 (sobre #10). Temporizador circular y barra de turno, cartas que vuelan del zapato y se descubren en orden de casino, total sobre la ultima carta, jugador propio al centro, selector de fichas y panel de acciones centrado; 101 pruebas. Falta la prueba con 3 pestanas reales (T-18). |
| 2026-10-05 | Nahum: T-29 (avance) en PR #12 (sobre #11). Pantalla de resultado animada por tono (victoria con rayos, confeti y fichas volando; empate; derrota), pildora para reabrirla, avisos y saldo animados y resultados forzables en el mock; 116 pruebas. Falta probar con el servidor real (T-18/T-20). |
| 2026-10-05 | Seguimiento de Nahum (antes de la review de #7): main protegida y verificada (push directo rechazado, 1 aprobacion, historial lineal, solo squash); T-02 hecha. PR #4 y PR #6 (T-10) fusionados; T-04, T-05, T-23, T-24, T-25 y T-34 cuentan segun Avance-M-02; T-10 con gate pendiente (otra laptop por IP). Avance 8/57 (14 %). Cliente publicado en PRs apilados #7 a #12. |
| 2026-10-05 | Seguimiento de Nahum (2): T-23, T-24, T-25 y T-34 marcadas segun Avance-M-02 (avance 8/57, 14 %); T-12 desmarcada porque su criterio pide la tienda (T-39, pospuesta); notas con fecha en las tareas del cliente; README, manual de instalacion y arquitectura actualizados con el cliente; Avance-N-01 con el detalle. |
| 2026-10-05 | Review del PR #7: T-10 restaurada como hecha según `main`; T-11 queda pendiente hasta probar la misma sesión con `reanudar` de T-08; T-12 sigue pendiente porque falta la pantalla de tienda. El trabajo de #8–#12 está en la rama del PR #7. Se cherry-pickearon allí los cuatro commits de seguimiento que habían quedado fuera de PR: TAREAS, ESTADO, README/manual/arquitectura y Avance-N-01. Avance: 9/57 (16 %). |
| 2026-10-05 | Massimo: límites de apuesta y compra con fuente única en `shared/` (`LIMITES_CANTIDAD`); `config.ts` los re-exporta (PR #14). Revisión del PR #7 con cambios pedidos. Ver Avance-M-03.md. |
| 2026-10-05 | Siguiente paso de Nahum: completar T-12 con una vista de tienda en `?mock=1` que muestre el catálogo de ejemplo de `tienda.catalogo`; no requiere completar la compra de T-39, que sigue pospuesta. |
| 2026-10-05 | Auditoría documental: `origin/main` contiene PR #14 (`7bf4e89`), con límites únicos desde `shared`; se revisaron README, ESTADO y arquitectura. |
| 2026-10-06 | PR #7 fusionado en `main` (`ea8c33f`); revisión aprobada verificó consumo del contrato, 187 pruebas, typecheck y build. T-03 marcada hecha; T-11 sigue pendiente de `reanudar` real (T-08) y T-12 de mostrar el catálogo en el mock. Avance 10/57 (18 %). |
| 2026-10-06 | Nahum: T-33 v1 en PR #17 (`docs/exposicion.md`, 9:00 en papel); pendiente aprobación de los 3. |
| 2026-10-06 | T-12 hecha por Nahum (PR #16): pestaña «Tienda» de solo lectura en el menú lateral con el catálogo del mock; desbloquea T-27. Avance 11/57 (19 %). |
| 2026-10-05 | Hector: T-07 hecha, PR #18 fusionado. T-08 implementada con nueve pruebas PostgreSQL/WebSocket, registro atómico y sesiones persistentes; pendiente revisión/fusión. Docker recuperado conservando respaldos y datos. Avance fusionado: 12/57 (21 %), H1 8/14. |
| 2026-10-05 | T-08 publicada por Hector en PR #19 sobre main actualizado con PR #16 y #17. Suite SQL completa: 203 pruebas, cero fallos/omisiones; typecheck correcto. Pendiente revisión/fusión. |
| 2026-10-05 | T-08 hecha por Hector (PR #19 fusionado). Auditoría de Massimo: documentación ajustada a main 831dcd2, 203 pruebas PostgreSQL 16.15 en copia extraída, typecheck/build correctos. Contadores 13/57 (23 %), H1 9/14; las casillas de pruebas independientes y motor continúan pendientes. |
| 2026-10-05 | Massimo: integración de T-24/T-34 por WebSocket preparada en PR #21; 210 pruebas y typecheck con PostgreSQL 16.15, revisión/fusión pendientes. T-35 espera GestorMesas. Empaquetado verificado en PR #20; T-48/T-55 siguen abiertos. |
