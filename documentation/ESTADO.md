# ESTADO — ¿Dónde vamos?

_Última actualización: mar 6 oct 2026 CDMX. Auditoría iniciada sobre `main` en `04802be` y actualizada con `main` en `42b5b65` (#35, #28 y #22 fusionados). Fechas del registro en America/Mexico_City._

## Resumen

`main` contiene contrato/BD/economía SQL (PR #4/#14), cliente y mock (#6/#7/#16), guion (#17), enrutador/auth (#18/#19), Carta/Baraja y Mano/Dealer (#25/#27), empaquetado (#20), documentación (#23), aceptación visual T-06 (#26), reconexión con la misma sesión T-11 (#34), muestrario T-27 (#35), resolución de resultados y pagos T-17 (#28) y tres mesas con asientos T-09 (#22, que trae también la economía WebSocket #21 y la producción #24). `main` está protegida: cada PR necesita 1 aprobación de otro dev y se fusiona con squash.

El camino crítico **T-01 → T-03 → T-07 → T-18 → T-20 → T-31** espera la integración de T-18/T-20. Hay código publicado en la cadena #29 → #30 → #31 → #32 → #33, pero sus tareas conservan casillas abiertas hasta cumplir fusión y aceptación. T-38 sigue abierta hasta jugar desde otra laptop por IP.

## Hito actual

**Hito 5 — mar 6 oct:** ensayos y ZIP probado. Entrega **mié 7 oct, 13:00 CDMX**; objetivo de subida **antes de las 11:00**.

Estado: 🔴 **Atrasados**. H1/H2/H3/H4 no se cerraron en sus fechas y no existe el tag `v0.9-congelado`. Las pruebas unitarias e integración parcial no acreditan cinco rondas en tres laptops, instalación independiente ni aceptación de la entrega.

El líder debe confirmar el criterio de corte de PLAN §10 y la fecha/condiciones del congelamiento. T-39/T-40 están pospuestas; no se cambia el alcance en esta auditoría.

## Avance

Solo se cuentan tareas con código fusionado en `main` y criterio comprobado.

| Dev | Completadas | Total | % |
|---|---|---|---|
| Hector | 10 | 19 | 53 % |
| Nahum | 4 | 17 | 24 % |
| Massimo | 9 | 19 | 47 % |
| Equipo | 0 | 2 | 0 % |
| **Total** | **23** | **57** | **40 %** |

Avance por hito: H1 12/14 (86 %) · H2 9/19 (47 %) · H3 1/10 (10 %) · H4 0/8 · H5 1/5 (20 %) · Entrega 0/1.

- **Hector:** T-01/T-02/T-06/T-07/T-08/T-09/T-15/T-16/T-17/T-19.
- **Nahum:** T-10/T-11/T-12/T-27; T-11 acreditada en PR #34 con cliente real, PostgreSQL y capturas; T-27 en PR #35.
- **Massimo:** T-03/T-04/T-05/T-22/T-23/T-24/T-25/T-34/T-54. T-03 se acredita con PR #4 (contrato), #14 (límites) y #7 (cliente que consume `@blackjack/shared`). T-54 acredita el script ZIP, no T-55 ni el paquete final.
- **T-22:** hecha; interfaz y `db/` en #4, consumida por `Mesa` y por `BilleteraMemoria` en #29–#32.
- **T-14/T-48:** requieren instalación independiente de Nahum. La fusión de #23 aportó documentación, no esa aceptación.
- **PR #7 ya está en `main`:** T-28–T-30 y T-41 tienen implementación integrada; conservan casilla abierta cuando falta su criterio de aceptación completo.

## Verificación de esta auditoría

Sobre `main` en `04802be` (anterior a #35, #28 y #22; no se repitió tras fusionarlos), con **Bun 1.3.13 y PostgreSQL 16.15**: typecheck, **236 pruebas / 3,540 aserciones**, cero fallos/omisiones, y build del cliente correctos. Se usaron schemas aleatorios de pruebas; no se ejecutó `db:reset`. El Bun global sigue en 1.4.2; la comprobación usó un ejecutable 1.3.13 aislado.

## Bloqueos activos

- **Cadena del motor #29–#33:** #28 ya está en `main`; falta actualizar cada rama sobre la nueva base y revisarla. #31 aún contiene auth/economía anteriores a las correcciones de #21; conservar logout compartido, caducidad, saldos ordenados, respuestas sin duplicados y servidor estático de #24 al resolver los cruces.
- **T-13/T-30/T-38:** #22 ya está en `main`; falta verificarlas contra el servidor real (lobby, compra de 1,000 fichas y juego desde otra laptop por IP).
- **T-28/T-29/T-31/T-41:** esperan acciones y rondas reales integradas. El historial final requiere compras, apuestas y artículos con saldos correctos.
- **T-36/T-37/T-42:** falta aceptación de desconexión/reserva de 60 s y endurecimiento de 20 mensajes/s; la reconexión de sesión T-11 no prueba recuperación de asiento/mano.
  - T-36 implementada en PR #37 (`t-36-desconexion-reconexion`), con recuperación de mano/saldo y 12 casos nuevos; revisión/fusión pendientes. Evidencia en [Avance-H-T36.md](Avance-H-T36.md). T-42 conserva su prueba de Wi-Fi en tres laptops pendiente.
- **T-35:** espera T-18 integrado y validación autoritativa de fase; coordinar con el alcance que confirme el líder para cosméticos/tienda.
- **T-43/T-44/T-45/T-46/T-47:** falta congelamiento y revisión final por otro integrante. Se puede preparar auditoría/checklist sin marcar el cierre.
- **T-33/T-51/T-52/T-53/T-56:** falta aprobación del guion/diapositivas, ensayos cronometrados y video de respaldo.
- **T-48/T-50/T-55/T-57:** manual independiente, arquitectura final revisada, ZIP jugable en máquina limpia y subida/verificación final.

## Hoy le toca a… (mar 6 oct, después de T-09/T-17/T-27)

- **Hector:**
  - T-09/T-17 hechas (PR #22/#28); T-18 en PR #29 y T-19/T-20/T-21/T-26 en PR #30–#33, pendientes de revisión/fusión; no cuentan todavía. Las prioridades y el alcance corresponden al líder.
- **Nahum:**
  - T-33 guion de exposición (PR #17 fusionado, pendiente de aprobación del grupo).
  - T-27 hecha (PR #35) → borradores de T-49 (manual) y T-51 (diapositivas) con capturas del mock y del muestrario.
  - T-11 hecha (reconexión con la misma sesión verificada con T-08); T-09 ya está en `main`: verificar T-13 contra el servidor real.
- **Massimo:**
  - Preparar la verificación de checklist T-44 cuando el equipo acuerde el corte.
  - Revisar la economía y el contrato en #31 contra lo que #21 ya dejó en `main` (logout compartido, caducidad, cola por usuario, estáticos de #24).
  - Auditoría JSDoc de `shared/`, `db/` y `store/` (T-46) y matriz de Funcionamiento de T-44, según [Avance-M-06.md](Avance-M-06.md).
  - Adelantar empaquetado y documentación; las decisiones de alcance permanecen con el líder.

Plan para la sesión y hasta la entrega: [Avance-M-06.md](Avance-M-06.md). Las decisiones de alcance permanecen con el líder.

## Registro diario

| Fecha (CDMX) | Nota |
|---|---|
| 2026-10-06 | T-36 implementada por Hector en PR #37 (borrador), con reserva exacta de 60 s, auto-plantado, recuperación de mano/saldo y transferencia a espectadora. Bun 1.3.13/PostgreSQL 16.15: typecheck y 357 pruebas/4,564 aserciones sin fallos/omisiones. Incluye 12 casos nuevos y sockets reales; revisión/fusión y aceptación Wi-Fi de T-42 pendientes. Ver Avance-H-T36.md. |
| 2026-09-29 | Plan aprobado: `PLAN.md`, `TAREAS.md`, `ESTADO.md`, `CHECKLIST_ENTREGA.md`, `CLAUDE.md` creados. 57 tareas, 0 % completado. |
| 2026-10-01 | Hector: T-01 preparada localmente en t-01-monorepo-bun. bun install en clon limpio y typecheck correctos. Sin tests aun. PR #1 abierto; no se contabiliza como fusionada. |
| 2026-10-01 | Hector: plantilla T-02 publicada en PR #2 (borrador). Nahum aplicara la proteccion de main; pendiente comprobar rechazos. |
| 2026-10-01 | Hector: T-06 publicada en PR #3 (borrador). Tipos y 3 pruebas WebSocket correctos. Pendiente verificacion visual y revision; bienvenida confirmada y documentada en PLAN.md. Avance-H-01.md publicado para contexto del equipo. |
| 2026-10-04 | Massimo: T-03, T-04/T-05, T-22–T-25 y servicios T-34 preparados localmente; suite conjunta typecheck + 70 tests/381 aserciones con PostgreSQL real. README/manual/arquitectura y empaquetador preparados parcialmente. Ver Avance-M-01.md. |
| 2026-10-04 | Massimo: trabajo anterior publicado en PR #4 (abierto, sin revisión). |
| 2026-10-04 | T-01 hecha por Hector (PR #1); auditoría en clon limpio de main. T-02: main sin protección. T-06: falta prueba visual. Congelamiento no alcanzado; avance 1/57 (2 %). Ver Avance-M-02.md. |
| 2026-10-04 | Massimo: entorno objetivo verificado (Bun 1.3.13 + PostgreSQL 16.15, clon limpio). Gates de T-04 y T-05 cumplidos y 70 pruebas sin fallos; se cuentan al fusionarse el PR #4. |
| 2026-10-05 | Massimo: T-54 verificada por adelantado en ZIP real y copia extraída: instalación con lockfile fijo, typecheck, 203 pruebas con PostgreSQL 16.15 y build del cliente correctos. T-48/T-55 y entrega final pendientes. Auditoría de 26 declaraciones públicas de shared/db/store sin JSDoc faltante; revisión T-46 pendiente. Ver Avance-M-04.md. |
| 2026-10-05 | Hector: T-16 implementada en PR #27; dieciséis pruebas nuevas verifican Ases, natural, pasadas y dealer. Typecheck y 224 pruebas con PostgreSQL 16 pasan sin fallos/omisiones; pendiente revisión/fusión. |
| 2026-10-05 | Hector: T-15 implementada en PR #25; Carta/Baraja y cinco pruebas verifican composición, extracción y umbral. Typecheck y 208 pruebas con PostgreSQL 16 pasan sin fallos/omisiones. Pendiente revisión/fusión; no se suma al avance de main. |
| 2026-10-05 | Hector: T-07 implementada desde main con el contrato de PR #14 y cliente de PR #7 revisados; PR #18 en borrador. Typecheck correcto, 166 pruebas sin fallos (29 SQL omitidas por falta de TEST_DATABASE_URL) y build del cliente correcto. Seis pruebas nuevas con sockets reales cubren ataques, UTF-8, reqId, autorización y fallos async. T-06 visual sigue pendiente: el navegador no inició por fallo de ACL del entorno. |
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
| 2026-10-05 | PR #7 fusionado en `main` (`ea8c33f`); revisión aprobada verificó consumo del contrato, 187 pruebas, typecheck y build. T-03 marcada hecha; T-11 sigue pendiente de `reanudar` real (T-08) y T-12 de mostrar el catálogo en el mock. Avance 10/57 (18 %). |
| 2026-10-05 | Nahum: T-33 v1 en PR #17 (`docs/exposicion.md`, 9:00 en papel); pendiente aprobación de los 3. |
| 2026-10-05 | T-12 hecha por Nahum (PR #16): pestaña «Tienda» de solo lectura en el menú lateral con el catálogo del mock; desbloquea T-27. Avance 11/57 (19 %). |
| 2026-10-05 | Hector: T-07 hecha, PR #18 fusionado. T-08 implementada con nueve pruebas PostgreSQL/WebSocket, registro atómico y sesiones persistentes; pendiente revisión/fusión. Docker recuperado conservando respaldos y datos. Avance fusionado: 12/57 (21 %), H1 8/14. |
| 2026-10-05 | T-08 publicada por Hector en PR #19 sobre main actualizado con PR #16 y #17. Suite SQL completa: 203 pruebas, cero fallos/omisiones; typecheck correcto. Pendiente revisión/fusión. |
| 2026-10-05 | T-08 hecha por Hector (PR #19 fusionado). Auditoría de Massimo: documentación ajustada a main 831dcd2, 203 pruebas PostgreSQL 16.15 en copia extraída, typecheck/build correctos. Contadores 13/57 (23 %), H1 9/14; las casillas de pruebas independientes y motor continúan pendientes. |
| 2026-10-05 | Massimo: integración de T-24/T-34 por WebSocket preparada en PR #21; 210 pruebas y typecheck con PostgreSQL 16.15, revisión/fusión pendientes. T-35 espera GestorMesas. Empaquetado verificado en PR #20; T-48/T-55 siguen abiertos. |
| 2026-10-05 | Massimo: review #23 corregida (dependencias, errores reales, estado de auth/tests y calendario CDMX). Bun 1.3.13 + PostgreSQL 16.15: copia histórica extraída 203 pruebas/3,402 aserciones; rama sobre main83165c6 208/3,438, typecheck/build correctos. T-15 hecha por Hector, PR #25 fusionado; avance 14/57, H2 4/19. Ver Revision-PR-23.md. |
| 2026-10-05 | T-16 hecha por Hector, PR #27 fusionado durante la revisión documental. Rama actualizada a mainaf772d8 y comprobada con Bun 1.3.13/PostgreSQL 16.15: typecheck, 224 pruebas/3,497 aserciones y build del cliente. Avance base15/57, H2 5/19; Carta/Baraja y Mano/Dealer incluidos en arquitectura. |
| 2026-10-05 | Massimo: revisión parcial de T-54 atendida en PR #20: rutas lógicas POSIX/CRLF, alternativas lockfile/Compose y 10 pruebas con ZIP real. Typecheck y suite con PostgreSQL 16.15: 213 pruebas, 3,431 aserciones, cero fallos. Las cifras históricas del empaquetado se distinguen de la aceptación final; T-54/T-55 siguen pendientes. |
| 2026-10-06 | Massimo: segunda revisión de #23 atendida: registro sin filas duplicadas y ordenado por fecha CDMX; PR #20 añadido al resumen. T-54 hecha, fusionada en c2daf78: Bun 1.3.13 genera ZIP de 124 archivos/272,903 bytes, validado con unzip del sistema (<20 MB); no es aceptación del ZIP final. Avance base16/57, Massimo 8/19; T-48/T-55 pendientes. |
| 2026-10-06 | Massimo: review de #26 atendida; PR limitado a evidencia T-06 y seguimiento, apilado sobre #23 actualizado. Capturas/medición del 5 oct: tres pestañas Chromium renderizadas muestran 3 y luego 2 en 32 ms, sobre código fusionado desde PR #3. T-06 hecha por Hector, verificada por Massimo; avance 17/57 (30 %), H1 10/14. Evidencia de integración se conserva fuera de este PR en la rama local respaldo/t06-integracion-antes-review-20261006; requiere integración/revisión aparte. |
| 2026-10-06 | T-11 hecha por Nahum: prueba de integración con cliente real (`Conexion` + `ControladorJuego` + reductor) contra servidor autenticado y PostgreSQL 16; reinicio del servidor → `reconectando` → vuelve solo con la misma sesión vía `reanudar`, y caso de token inválido. Verificación visual en navegador con capturas en `docs/evidencia/t11/`. 236 pruebas y typecheck en verde. Avance 18/57 (32 %), H1 11/14. |
| 2026-10-06 | Massimo: auditoría de main `04802be` y PRs (estado previo a fusionar #22/#28/#35). #23/#26/#34 están en main; #21/#24 se fusionaron en la rama de #22 y todavía no llegan a main. #22 y #35 tienen conflictos; #31 contiene auth/economía anteriores a la revisión de #21. Bun 1.3.13/PostgreSQL 16.15: typecheck, 236 pruebas/3,540 aserciones y build del cliente correctos. Sin nuevas casillas cerradas: 18/57, Massimo 8/19. Plan de sesión/entrega en Avance-M-06. |
| 2026-10-06 | T-27 hecha por Nahum (PR #35): muestrario `?mock=1&muestrario` con las 52 cartas, los 5 reversos del catálogo (solo CSS), dealer y asientos en sus estados; `Carta` acepta `reverso` para T-40. Typecheck y 244 pruebas en verde. Al integrarse con T-11 (#34): avance 19/57 (33 %), Nahum 4/17, H1 11/14, H2 6/19. |
| 2026-10-06 | Nahum: corrección local de arranque de T-01, pendiente de PR. `server/package.json` carga explícitamente `.env` de la raíz; `bun run dev` arranca desde `server/` y desde raíz sin el error de DATABASE_URL. Typecheck correcto con Bun 1.3.8; conectividad PostgreSQL no comprobada en esta corrección. README/manual actualizados. |
| 2026-10-06 | Hector: revisión de T-17 atendida en PR #28; base main sin commits duplicados de #25/#27, copias de manos y pagos ligados a LIMITES_CANTIDAD. Typecheck y 250 pruebas SQL sin fallos; pendiente aprobación/fusión. |
| 2026-10-06 | Hector: segunda revisión de PR #28 atendida sobre main con #35; conflicto de ESTADO resuelto sin perder T-27. Se restauraron pruebas separadas para enlaces a archivo (Unix) y directorio/junction (Windows) en el ZIP. Typecheck y 218 pruebas pasan; 45 omitidas sin TEST_DATABASE_URL y por condiciones de plataforma. T-17 sigue pendiente de aprobación/fusión; avance en main 19/57. |
| 2026-10-06 | Hector: primera revisión de T-09 en PR #22 (`6a93a43`); main incorporada y #21/#24 conservadas. Traspaso, cosméticos, publicaciones y cierre corregidos; tipos y 270 pruebas PostgreSQL sin fallos. Revisión posterior solicita conservar la pestaña anterior como espectadora según PLAN §7.5; pendiente aprobación/fusión. |
| 2026-10-06 | Hector: segunda revisión de T-09 atendida en PR #22; pestaña anterior como espectadora según PLAN §7.5, salida sin liberar asiento ajeno y recuperación tras salir/cerrar la dueña. Cliente de main conservado y conflicto de ESTADO resuelto con T-27. Bun 1.3.13/PostgreSQL 16.15: typecheck correcto y suite SQL completa sin fallos. Pendiente aprobación/fusión; avance aceptado 19/57. |
| 2026-10-06 | Massimo: PR #22 fusionado con main tras revisar la segunda corrección (`348f849`). Incluye T-09 y las integraciones de #21 (T-34 por WebSocket) y #24 (T-38). T-09 y T-17 hechas por Hector (PR #22 y #28). T-38 sigue abierta hasta jugar desde otra laptop por IP. Avance 21/57 (37 %), Hector 9/19, H1 12/14, H2 7/19. |
| 2026-10-06 | Revisión de PR #36: conflictos resueltos contra main `42b5b65`. Se actualizan las afirmaciones que dejaron de ser ciertas (#22, #28 y #35 ya fusionados; T-09/T-17/T-27 hechas) y se conserva el avance de main 21/57. La verificación de 236 pruebas corresponde a `04802be` y no se repitió. |
| 2026-10-06 | Nahum: revisión de PR #36 aplicada: `ESTADO.md` sin bloque duplicado de avance; T-38/T-48 y `Avance-M-06.md` reflejan que #21/#24 llegaron a `main` con #22 (`42b5b65`); tareas de Massimo actualizadas. Sin cambios de casillas: 21/57. |
| 2026-10-06 | Massimo: T-46 lista para revisión de Hector: JSDoc en los esquemas y constantes exportados de `shared/` y en `Saldos`; 0 exportaciones sin JSDoc en store/db/shared. Typecheck y pruebas de shared/cliente en verde. Sin casillas nuevas: 21/57. |
| 2026-10-06 | Hector: revisión 5435739214 de T-18 atendida en PR #29 sobre main `3e185d1`, conservando el modo espectador. Salida voluntaria separada de caída de red; regresión falla antes y pasa después. Typecheck correcto y suite PostgreSQL 16.15/Bun 1.3.13: 311 pruebas correctas, cero fallos, una omitida por enlaces a archivo en Windows. Evidencia visual histórica conservada; pendiente aprobación/fusión, sin recalcular contadores. |
| 2026-10-07 | Revisión de código de PR #30 (T-19) atendida (incluye #31): rama integrada sobre main tras el squash de #29 (se descartan los commits duplicados y se conserva el modo espectador de #22). Reintento acotado si falla el reparto, plazo de apuestas restaurado si alguien llega tras un cierre anticipado y PAGOS espera la liquidación. Typecheck y suite completa con PostgreSQL de pruebas (322 pruebas, 0 fallos). Casilla de T-19 abierta hasta fusión. |
| 2026-10-06 | Hector: revisión de T-20 atendida en PR #31; conserva limpieza/aviso de token compartido de #21 y cola económica común para apuestas/compras. Typecheck y 319 pruebas SQL sin fallos; pendiente revisión de Massimo y fusión. |
| 2026-10-06 | Hector: revisión de T-21 atendida en PR #32; apagar completa liquidaciones pendientes, conserva UUID/créditos y espera todas las mesas. Regresión SQL falla con el apagado anterior y pasa tras la corrección; typecheck y 332 pruebas PostgreSQL sin fallos. Pendiente revisión de Massimo y fusión. |
| 2026-10-06 | Nahum: corrige la revisión de T-21 en PR #32 (jsonb como arreglo, tope de reintentos en PAGOS, apagado con `finally`). Typecheck y 333 pruebas PostgreSQL sin fallos. Pendiente revisión de Massimo y fusión. |
| 2026-10-06 | Massimo: manual de instalación y README listos para la prueba independiente de Nahum (T-14/T-48). Ruta rápida, conexión LAN y firewall; enlaces rotos y historial retirados. Verificado desde el ZIP de `main` `3e185d1`: instalación, `db:reset`, build y start; HTTP 200 por IP de LAN y registro/lobby/mesa por WebSocket. Sin casillas nuevas: 21/57. |
| 2026-10-06 | Nahum: revisión de PR #39 aplicada: integra main `16f7e32` (#29–#32) resolviendo el conflicto del registro; README indica que las rondas completas ya están en `main` y solo faltan los bots (#33); manual con Bun 1.3.13 como en `package.json` y `copy` para `cmd` de Windows. Sin casillas nuevas. |
| 2026-10-06 | Massimo: `docs/arquitectura.md` actualizado con el motor ya integrado en `main` (PR #29–#32): clases y firmas reales, dependencias, liquidación idempotente, handlers/topics, máquina de estados implementada y pruebas. T-32/T-50 esperan la revisión de Hector. Sin casillas nuevas: 21/57. |
| 2026-10-06 | Hector: PR #33 (T-26) actualizado sobre las correcciones de #22 y #28–#32; no tenía comentarios propios. Typecheck, build y 336 pruebas PostgreSQL sin fallos; cuatro bots completan diez rondas, 40 resultados guardados y libro contable conciliado. Pendiente revisión/fusión. |
| 2026-10-06 | Nahum: revisión de PR #33 (T-26) atendida; los bots tratan FASE_INCORRECTA/NO_ES_TU_TURNO/YA_APOSTASTE como carrera y esperan el siguiente snapshot, no apuestan con menos de `BOTS_MARGEN_APUESTA_MS` y un bot sin fichas deja la mesa sin detener al grupo. Prueba nueva con servidor WS guionado (falla con el código anterior). Rama integrada con main `c619262` y con T-36 (#37). `HistorialSQL` envía `cartas` como texto JSON con cast `::text::jsonb`, porque Bun 1.3.13 no serializa los arreglos igual que 1.3.8. Typecheck y 364 pruebas PostgreSQL sin fallos en Bun 1.3.13 y 1.3.8. Pendiente revisión/fusión. |
| 2026-10-06 | T-22 hecha por Massimo: interfaz `Billetera` en `main` usada por `Mesa` y por `BilleteraMemoria` en las pruebas del motor (PR #29–#32). Contadores recalculados con T-19, ya marcada en TAREAS: 23/57 (40 %), Hector 10/19, Massimo 9/19, H2 9/19. |
| 2026-10-06 | Hector: preparación de T-45 sobre main `8bfe554`; JSDoc de game/ws/auth auditado (18 archivos, 116 declaraciones públicas, cero omisiones). Typecheck y suite SQL: 363 correctas, 1 omitida, 0 fallos. Code review local sin hallazgos pendientes; ver evidencias/T-45-revision.md. No se marca hecha: espera T-43, reauditoría de la versión congelada y revisión de Massimo. |
