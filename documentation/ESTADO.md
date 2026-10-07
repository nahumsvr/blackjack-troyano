# ESTADO — ¿Dónde vamos?

> Rama de extras `extras-x1-x5` — 2026-10-07: X-1 implementada por Hector, con revisión local, typecheck y 399 pruebas correctas (1 omitida, 0 fallos). Pendiente PR conjunto de X-1…X-5 y revisión de Nahum/Massimo. No suma al avance de main. Evidencia: [X-1-revision.md](../evidencias/X-1-revision.md).

_Última actualización: mié 7 oct 2026 CDMX. Seguimiento de Hector sobre main 8bfe554, integrado con main 727f86e (#43); fechas del registro en America/Mexico_City._

## Resumen

`main` incluye el motor T-18/T-19/T-20/T-21 (#29–#32), bots T-26 y desconexión T-36 (#37 incorporado con #33), además de contrato, economía, cliente, documentación y empaquetador previamente registrados. Se comprueba en GitHub la fusión de los PRs y en Git el código integrado. Main mantiene protección y una aprobación de otro dev.

#43 (regresión jsonb en ambos modos prepare) ya está en `main` (727f86e). #44 se cerró sin fusionar: este seguimiento (#47) incluye sus commits. PRs abiertos: #45 (endurecimiento T-37), #46 (registro HTTP LAN/producción T-38), #47 (este seguimiento) y #48 (JSDoc T-45).
El camino crítico **T-01 → T-03 → T-07 → T-18 → T-20 → T-31** espera la integración de T-18/T-20. Hay código publicado en la cadena #29 → #30 → #31 → #32 → #33, pero sus tareas conservan casillas abiertas hasta cumplir fusión y aceptación. T-38 tiene aceptación LAN registrada en PR #46; sigue abierta hasta aprobación y fusión.

## Hito actual

**Hito 5 — mar 6 oct:** ensayos y ZIP probado. Entrega **mié 7 oct, 13:00 CDMX**; objetivo de subida **antes de las 11:00**.

Estado: 🔴 **Atrasados**. H1–H4 no se cerraron en sus fechas; no hay tag v0.9-congelado. La evidencia automática no acredita la sesión de tres laptops, instalación independiente ni aceptación del ZIP.

**Alcance de entrega:** ver [decisión y gate en PLAN §10](PLAN.md#10-criterio-de-corte).

## Avance

Se cuentan tareas con código fusionado y criterio acreditado. T-20/T-21 se cierran con evidencia SQL/WebSocket. T-18/T-26/T-36 están implementadas y fusionadas, pero siguen abiertas por falta de aceptación actual sobre la versión integrada; las evidencias históricas y los tests no acreditan esos cierres. T-46 tiene revisión realizada, pero queda abierta hasta T-43 y la comprobación de la documentación de la versión congelada.

| Dev | Completadas | Total | % |
|---|---|---|---|
| Hector | 12 | 19 | 63 % |
| Nahum | 4 | 17 | 24 % |
| Massimo | 9 | 19 | 47 % |
| Equipo | 0 | 2 | 0 % |
| **Total** | **25** | **57** | **44 %** |

Avance por hito: H1 12/14 (86 %) · H2 11/19 (58 %) · H3 1/10 (10 %) · H4 0/8 (0 %) · H5 1/5 (20 %) · Entrega 0/1.

- **Hector:** T-01/T-02/T-06/T-07/T-08/T-09/T-15/T-16/T-17/T-19/T-20/T-21.
- **Nahum:** T-10/T-11/T-12/T-27.
- **Massimo:** T-03/T-04/T-05/T-22/T-23/T-24/T-25/T-34/T-54.
- **T-32/T-50:** ver [revisión de arquitectura en T-32](TAREAS.md#t-32-revision-de-arquitectura).
- **T-14/T-48:** falta la instalación independiente de Nahum. T-54 acredita el empaquetador, no el ZIP final ni T-55.

## Verificación

En esta sesión: revisión del código de shared/db/store, arquitectura, criterios y fusiones. Evidencia histórica T-18: tres pestañas, cada transición en menos de 21 ms, carta oculta hasta DEALER (evidencias/T-18-navegador.json). T-20/T-21/T-36 tienen regresiones con WebSocket y PostgreSQL; bots.test.ts prueba cuatro bots, diez rondas, 40 resultados y conciliación de movimientos.

Validación final del seguimiento con Bun 1.3.13 y PostgreSQL de pruebas: `bun run typecheck` correcto; `bun test ./server/test ./client/test`: **363 correctas, 1 omitida por enlaces a archivo en Windows, 0 fallos, 4,619 aserciones**, en 38 archivos. Los intentos dentro del sandbox no se consideran resultado del producto: el entorno denegó lectura de directorios y conexiones SQL; la ejecución final fuera del sandbox pasa. Auditoría TypeScript de JSDoc: 62 declaraciones públicas revisadas, 0 sin documentación.

La auditoría previa de Massimo sobre main 8bfe554 registró 364 pruebas, cero fallos. #43, ya fusionado, añade cobertura prepare=true/false; no es necesario para contar T-21, cuya corrección jsonb llegó en #33. No se ejecuta db:reset en esta sesión.

## Bloqueos activos

- **T-18/T-26/T-36:** implementadas y fusionadas; aceptación actual pendiente (ver TAREAS). No suman al avance.
- **T-31:** el código del camino crítico ya está integrado. Falta jugar cinco rondas y comprar fichas con tres personas en tres laptops; coordinar con las aceptaciones del cliente T-13/T-28/T-29/T-30/T-41/T-42.
- **T-37/T-38:** #45/#46 pendientes de revisión/fusión; las observaciones de Massimo requieren respuesta de sus autores. La cuenta HectorD20 no puede aprobar estos PRs propios.
- **T-32/T-50:** ver [pendientes de T-32](TAREAS.md#t-32-revision-de-arquitectura); T-50 conserva la dependencia T-45.
- **T-43:** espera T-34/T-36/T-37/T-38/T-41/T-42 fusionadas y aceptadas, tipos/pruebas SQL en verde sobre la versión a etiquetar y el tag. T-35/T-39/T-40 están excluidas por el corte y no bloquean este gate.
- **T-44/T-45/T-46/T-47:** falta T-43 y aceptación/revisión de la versión congelada. La revisión previa de T-46 está registrada; su casilla y cierre final permanecen pendientes.
- **T-14/T-48/T-55:** instalación independiente y prueba del ZIP en máquina limpia.
- **T-33/T-51/T-52/T-53/T-56/T-57:** aprobación del guion, diapositivas, ensayos, video y subida final.

## Hoy le toca a… (mar 6 oct noche → mié 7 oct mañana)

- **Hector:** responder los hallazgos de #45/#46/#48; tras T-43 cerrar T-45 con revisión de Massimo y confirmar T-46 sobre la versión congelada. Participar en T-31/T-55. Acreditar T-18/T-36 en pestañas reales y T-26 con CLI/configuración normal sobre la versión integrada; solicitar revisión de otro dev. Ver alcance en PLAN §10.
- **Nahum:** instalación independiente T-14/T-48, pruebas del cliente con tres laptops T-13/T-28–T-30/T-41/T-42, manual/diapositivas/video y revisión del seguimiento.
- **Massimo:** renderizado/exportación T-32/T-50; coordinar T-31 y checklist T-44, resolver la decisión de congelamiento con el corte documentado, empaquetar tras las verificaciones y subir antes de las 11:00.

## Registro diario

| Fecha (CDMX) | Nota |
|---|---|
| 2026-10-06 | Hector: comentarios de Massimo de PR #45 (T-37) atendidos con presupuesto global de autenticación, cierre por abuso/falta de progreso, correlación compartida y pruebas de reloj manual. Apagado corregido frente al contador obsoleto de Bun 1.3.13 tras cierre del servidor. Typecheck; suite SQL 377 correctas, 1 omitida, 0 fallos; 80 pruebas afectadas pasan tras inyectar el reloj en integración. Code review local sin hallazgos pendientes. Shared requiere revisión de Massimo. T-37 hecha por Hector (PR #45), con casilla marcada y criterio verificado; pendiente aprobación/fusión, sin sumar aún al avance integrado de main. Ver Avance-H-T37.md. |
| 2026-10-06 | T-37 implementada por Hector en PR #45: ventana móvil de 20 mensajes/s, cola acotada y logs de errores internos con contexto. Ráfaga de 1,000 mensajes y tres jugadores con PostgreSQL real superan el criterio de <1 s; espectadora sin cambios de estado/dinero. Typecheck y 372 pruebas/4,682 aserciones sin fallos; una omitida por plataforma. Autorrevisión final sin hallazgos pendientes. Revisión solicitada; pendiente aprobación/fusión, sin sumar a main. Ver Avance-H-T37.md. |
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
| 2026-10-06 | Massimo: PR #22 fusionado con main tras revisar la segunda corrección (`348f849`). Incluye T-09 y las integraciones de #21 (T-34 por WebSocket) y #24 (T-38). T-09 y T-17 hechas por Hector (PR #22 y #28). Estado histórico anterior a PR #46: T-38 esperaba jugar desde otra laptop por IP. Avance 21/57 (37 %), Hector 9/19, H1 12/14, H2 7/19. |
| 2026-10-06 | Revisión de PR #36: conflictos resueltos contra main `42b5b65`. Se actualizan las afirmaciones que dejaron de ser ciertas (#22, #28 y #35 ya fusionados; T-09/T-17/T-27 hechas) y se conserva el avance de main 21/57. La verificación de 236 pruebas corresponde a `04802be` y no se repitió. |
| 2026-10-06 | Nahum: revisión de PR #36 aplicada: `ESTADO.md` sin bloque duplicado de avance; T-38/T-48 y `Avance-M-06.md` reflejan que #21/#24 llegaron a `main` con #22 (`42b5b65`); tareas de Massimo actualizadas. Sin cambios de casillas: 21/57. |
| 2026-10-06 | Massimo: T-46 lista para revisión de Hector: JSDoc en los esquemas y constantes exportados de `shared/` y en `Saldos`; 0 exportaciones sin JSDoc en store/db/shared. Typecheck y pruebas de shared/cliente en verde. Sin casillas nuevas: 21/57. |
| 2026-10-06 | Hector: revisión 5435739214 de T-18 atendida en PR #29 sobre main `3e185d1`, conservando el modo espectador. Salida voluntaria separada de caída de red; regresión falla antes y pasa después. Typecheck correcto y suite PostgreSQL 16.15/Bun 1.3.13: 311 pruebas correctas, cero fallos, una omitida por enlaces a archivo en Windows. Evidencia visual histórica conservada; pendiente aprobación/fusión, sin recalcular contadores. |
| 2026-10-06 | Revisión de código de PR #30 (T-19) atendida (incluye #31): rama integrada sobre main tras el squash de #29 (se descartan los commits duplicados y se conserva el modo espectador de #22). Reintento acotado si falla el reparto, plazo de apuestas restaurado si alguien llega tras un cierre anticipado y PAGOS espera la liquidación. Typecheck y suite completa con PostgreSQL de pruebas (322 pruebas, 0 fallos). Casilla de T-19 abierta hasta fusión. |
| 2026-10-06 | Hector: revisión de T-20 atendida en PR #31; conserva limpieza/aviso de token compartido de #21 y cola económica común para apuestas/compras. Typecheck y 319 pruebas SQL sin fallos; pendiente revisión de Massimo y fusión. |
| 2026-10-06 | Hector: revisión de T-21 atendida en PR #32; apagar completa liquidaciones pendientes, conserva UUID/créditos y espera todas las mesas. Regresión SQL falla con el apagado anterior y pasa tras la corrección; typecheck y 332 pruebas PostgreSQL sin fallos. Pendiente revisión de Massimo y fusión. |
| 2026-10-06 | Nahum: corrige la revisión de T-21 en PR #32 (jsonb como arreglo, tope de reintentos en PAGOS, apagado con `finally`). Typecheck y 333 pruebas PostgreSQL sin fallos. Pendiente revisión de Massimo y fusión. |
| 2026-10-06 | Massimo: manual de instalación y README listos para la prueba independiente de Nahum (T-14/T-48). Ruta rápida, conexión LAN y firewall; enlaces rotos y historial retirados. Verificado desde el ZIP de `main` `3e185d1`: instalación, `db:reset`, build y start; HTTP 200 por IP de LAN y registro/lobby/mesa por WebSocket. Sin casillas nuevas: 21/57. |
| 2026-10-06 | Nahum: revisión de PR #39 aplicada: integra main `16f7e32` (#29–#32) resolviendo el conflicto del registro; README indica que las rondas completas ya están en `main` y solo faltan los bots (#33); manual con Bun 1.3.13 como en `package.json` y `copy` para `cmd` de Windows. Sin casillas nuevas. |
| 2026-10-06 | Massimo: `docs/arquitectura.md` actualizado con el motor ya integrado en `main` (PR #29–#32): clases y firmas reales, dependencias, liquidación idempotente, handlers/topics, máquina de estados implementada y pruebas. T-32/T-50 esperan la revisión de Hector. Sin casillas nuevas: 21/57. |
| 2026-10-06 | Hector: PR #33 (T-26) actualizado sobre las correcciones de #22 y #28–#32; no tenía comentarios propios. Typecheck, build y 336 pruebas PostgreSQL sin fallos; cuatro bots completan diez rondas, 40 resultados guardados y libro contable conciliado. Pendiente revisión/fusión. |
| 2026-10-06 | Nahum: revisión de PR #33 (T-26) atendida; los bots tratan FASE_INCORRECTA/NO_ES_TU_TURNO/YA_APOSTASTE como carrera y esperan el siguiente snapshot, no apuestan con menos de `BOTS_MARGEN_APUESTA_MS` y un bot sin fichas deja la mesa sin detener al grupo. Prueba nueva con servidor WS guionado (falla con el código anterior). Rama integrada con main `c619262` y con T-36 (#37). `HistorialSQL` envía `cartas` como texto JSON con cast `::text::jsonb`, porque Bun 1.3.13 no serializa los arreglos igual que 1.3.8. Typecheck y 364 pruebas PostgreSQL sin fallos en Bun 1.3.13 y 1.3.8. Pendiente revisión/fusión. |
| 2026-10-06 | T-22 hecha por Massimo: interfaz `Billetera` en `main` usada por `Mesa` y por `BilleteraMemoria` en las pruebas del motor (PR #29–#32). Contadores recalculados con T-19, ya marcada en TAREAS: 23/57 (40 %), Hector 10/19, Massimo 9/19, H2 9/19. |
| 2026-10-06 | Massimo: seguimiento sobre `main` `c07c9de` (#42 fusionado). Resumen, bloqueos y "Hoy le toca" actualizados con #29–#32 y #38–#41 fusionados y #33 (con #37/T-36) abierto. Suite: 340 correctas y 7 fallos por `HistorialSQL` con `prepare: false`; corrección en #43 (349/0 con Bun 1.3.13 y 1.4.2). Fecha del registro de #30 corregida a CDMX. Sin casillas nuevas además de T-22: 23/57 (40 %). |
| 2026-10-06 | Massimo: seguimiento actualizado a `main` `8bfe554` (#33 fusionado con bots y T-36). Suite en verde: 364/0 con Bun 1.3.13. #43 queda como regresión de `HistorialSQL`. Bloqueos y "Hoy le toca" sin #33; el congelamiento espera T-37. Sin casillas nuevas: 23/57 (40 %). |
| 2026-10-06 | Massimo: PR #43 reducido a la regresión de `HistorialSQL`; el arreglo `::text::jsonb` ya llegó a `main` con #33. `historialSQL.test.ts` guarda una ronda con `prepare: true` (producción) y `prepare: false` (pruebas), acepta el reintento igual y rechaza otras cartas con `ERROR_INTERNO`; el comentario del código explica que la causa es el modo de conexión, no la versión de Bun. Sin casillas nuevas. |
| 2026-10-06 | T-18/T-26/T-36: Hector comprueba su fusión en `main`; quedan abiertas hasta acreditar su aceptación sobre la versión integrada (ver TAREAS). |
| 2026-10-06 | T-20 hecha por Hector: fusión y criterio comprobados; evidencia y PR de implementación identificados en TAREAS. |
| 2026-10-06 | T-21 hecha por Hector: fusión y criterio comprobados; evidencia y PR de implementación identificados en TAREAS. |
| 2026-10-06 | Revisión previa de T-46 por Hector sobre PR #40 fusionado; el cierre propuesto inicialmente en #47 se corrige: falta T-43 y comprobación sobre la versión congelada. T-32/T-50 revisadas y actualizadas con T-36; renderizado/exportaciones pendientes. |
| 2026-10-06 | Hector confirma el corte de T-35/T-39/T-40 para esta entrega según PLAN §10, sin contarlas como hechas. |
| 2026-10-06 | Revisión de PR #47 atendida por Hector: T-43 exige solo dependencias conservadas, T-46 vuelve a pendiente y se propaga el corte a T-41/T-44/T-49/T-53 y al checklist. Los requisitos excluidos permanecen sin marcar; backend T-34 se verifica por WebSocket. Corrección documental, sin nueva aceptación de tareas ni cambios de código. |
| 2026-10-06 | Hector: nueve comentarios de PR #47 atendidos. T-18/T-26/T-36 vuelven a pendientes por aceptación no acreditada; avance vigente 25/57 (44 %), Hector 12/19 (63 %), H2 11/19 y H3 1/10. Tabla diaria reparada, arquitectura completada, checklist YA_POSEIDO restaurado y alcance centralizado en PLAN §10. Validación de esta revisión: typecheck correcto; 363 pruebas PostgreSQL correctas, 0 fallos y 1 omitida en Windows; tabla diaria renderizada por GitHub. Pendiente aprobación de otro dev. |
| 2026-10-07 | Nahum: PR #47 integrado con `main` `727f86e` (#43); conflicto del registro resuelto conservando ambas filas. Revisión de #47: #43 fusionado y #44 cerrado (reemplazado por #47), filas de cierres rectificados unificadas, cifra 28/57 retirada, PR #31/#32 en las casillas de T-20/T-21 y nota duplicada de T-36 retirada. Sin casillas nuevas: 25/57 (44 %). |
| 2026-10-06 | Hector: T-38 revisada; registro por HTTP LAN corregido, build y ronda con tres bots verificados. 364 pruebas correctas, 0 fallos y 1 omitida en Windows. Primera comprobación de acceso; la aceptación tras recargar se completó después, como registra la siguiente entrada. Sin nuevas casillas. |
| 2026-10-06 | Hector: T-38 aceptada por el usuario desde dos dispositivos después de corregir el registro HTTP LAN. Code review final sin hallazgos pendientes; se autoriza publicar el PR. Casilla pendiente de fusión. |
| 2026-10-06 | Hector: T-38 publicada en PR #46, con aceptación desde dos dispositivos, code review final y revisión solicitada a Nahum. Pendiente aprobación/fusión en main. |
| 2026-10-06 | Hector: seis comentarios de PR #46 atendidos: UUID con prueba pura sin BD, integración en server/test, saldos derivados de configuración, todos los assets verificados y ejecución documentada en el servidor. Estado vigente de T-38: aceptación LAN completada; pendiente aprobación/fusión, sin nuevas casillas. |
