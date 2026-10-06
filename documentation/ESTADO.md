# ESTADO — ¿Dónde vamos?

_Última actualización: mar 6 oct 2026 CDMX (PR #7 integrado en `main`; detalle del cliente en [Avance-N-01.md](Avance-N-01.md))_

## Resumen

Ya están en `main` los PR #4 (contrato, BD y economía), #6 (base del cliente), #7 (cliente y mock) y #14 (límites únicos). `main` está protegida: un push directo es rechazado, cada PR necesita 1 aprobación de otro dev, el historial es lineal y solo se permite fusionar con squash (la rama se borra al fusionar).

El PR #7 se fusionó en `main` el 6 oct a las 00:51 UTC (5 oct 18:51 CDMX), integrando el cliente y los cambios de #8–#12. La revisión aprobada verificó 187 pruebas sin fallos con PostgreSQL 16, `typecheck` en los 3 paquetes y build del cliente. El flujo completo sigue usando el mock: la prueba contra el servidor real depende de T-07, T-08 y T-18. PR #14 también está fusionado (`7bf4e89`).

El camino crítico **T-01 → T-03 → T-07 → T-18 → T-20 → T-31** ya no está detenido en T-03 (el contrato está en `main`). Ahora espera a **T-07** (enrutador), y con él a T-08, T-09 y T-18, que son los que permiten probar el cliente contra el servidor real.

## Hito actual

**Por calendario: Hito 5 — mar 6 oct** (ensayos y ZIP probado). La entrega es mié 7, 13:00.

Estado: 🔴 **Atrasados**. No se cumplieron el Hito 1 (30 sep), el Hito 2 (3 oct) ni el Hito 3/congelamiento (4 oct 22:00); no existe el tag `v0.9-congelado`.

> Semáforo: 🟢 a tiempo · 🟡 en riesgo (una tarea del camino crítico con > medio día de atraso) · 🔴 atrasados (el hito no se cumple en su fecha)

**Decisiones pendientes del equipo:**
- Aplicar el criterio de corte de PLAN §10 y decidir si se mueve el congelamiento.
- Confirmar con el equipo el criterio de corte y priorizar integración/pruebas del servidor frente a tareas de entrega aún abiertas.

## Avance

Solo se cuentan tareas con PR fusionado en `main` y criterio de "hecho" comprobado.

| Dev | Completadas | Total | % |
|---|---|---|---|
| Hector | 2 | 19 | 11 % |
| Nahum | 1 | 17 | 6 % |
| Massimo | 7 | 19 | 37 % |
| Equipo | 0 | 2 | 0 % |
| **Total** | **10** | **57** | **18 %** |

Avance por hito: H1 6/14 (43 %) · H2 3/19 (16 %) · H3 1/10 (10 %) · H4 0/8 · H5 0/5 · Entrega 0/1

- **Hechas:**
  - T-01 y T-02 (Hector); la protección de `main` se aplicó y verificó hoy.
  - T-10 (Nahum, PR #6 fusionado en `main`; marca restaurada desde `main` durante la revisión del PR #7).
  - T-04, T-05, T-23, T-24, T-25 y T-34 (Massimo). Su criterio está verificado con PostgreSQL 16 en Avance-M-02, que indicaba marcarlas al fusionarse el PR #4.
- **Fusionadas con un gate pendiente** (no cuentan):
  - T-06: prueba visual.
- **T-03 hecha:** PR #4 aporta contrato y pruebas; PR #14 centraliza límites; PR #7 integró el cliente que consume `@blackjack/shared`.
- **T-14 y T-22:** README/manual e interfaz `Billetera` están en `main`, pero sus criterios (instalación independiente e importación por Hector) carecen de evidencia de cierre; siguen pendientes.
- **PR #7 ya está en `main`:** T-11, T-12, T-27–T-30 y T-41 tienen implementación integrada; conservan casilla abierta cuando falta su criterio de aceptación completo.

## Bloqueos activos

- **T-07 (enrutador) sin publicar:** bloquea T-08, T-09, T-18 y las pruebas reales del cliente:
  - T-13 espera T-08 y T-09;
  - T-28 y T-29 esperan T-18 y T-20;
  - T-30 y T-41 esperan los handlers de T-24/T-34 conectados al enrutador.
- **Cliente integrado (PR #7):** T-11 sigue pendiente de recuperar la misma sesión con `reanudar` real (T-08); T-12 requiere mostrar el catálogo en una vista accesible desde el mock.
- **T-06 — prueba visual:** falta abrir `scripts/verificar-ws.html` en tres pestañas.
- **T-42** espera T-36. **T-35** espera `GestorMesas` (T-09/T-18). **T-31** espera T-20, T-21, T-28 y T-24.

## Hoy le toca a… (mar 6 oct)

- **Hector:**
  - T-07 enrutador → T-08/T-09 (desbloquean T-13) → T-15 y T-18.
  - Prueba visual de T-06.
- **Nahum:**
  - **Siguiente paso inmediato: T-12** — agregar a `?mock=1` una vista de tienda que muestre el catálogo de ejemplo de `tienda.catalogo`. La vista de lectura cumple el criterio de T-12; la compra y confirmación de T-39 siguen pospuestas.
  - T-27: página de prueba con las 52 cartas → T-33 guion → borradores de T-49 (manual) y T-51 (diapositivas) con capturas del mock.
  - En cuanto existan T-08 y T-09, verificar T-13 contra el servidor real.
- **Massimo:**
  - Preparar la verificación de checklist T-44 cuando el equipo acuerde el corte.
  - Handlers de economía para el enrutador de T-07 y coordinación con Hector.
  - Coordinar la decisión de corte.

## Registro diario

| Fecha | Nota |
|---|---|
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
