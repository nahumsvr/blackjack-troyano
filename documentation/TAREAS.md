# TAREAS — Tablero con checks

Formato: `- [ ] T-XX · descripción · dueño · depende de: T-YY` y debajo **Hecho cuando:** (criterio comprobable).
🔓 = **desbloquea a otro dev** → hacerla primero.
⏸ = **pospuesta** (no eliminada; ver su nota).
Al terminar una tarea: marcar `[x]`, poner el número de PR y agregar una línea al registro de `ESTADO.md`.

Resumen: **57 tareas** · Hector 19 · Nahum 17 · Massimo 19 · Equipo 2.

---

## Hito 1 — mié 30 sep: monorepo, BD, contrato, login y 3 pestañas en el lobby

### Hector
- [x] T-01 · 🔓 Monorepo con Bun workspaces (`server`, `client`, `shared`), `tsconfig` estricto base, scripts raíz (`dev`, `test`, `typecheck`), `.gitignore` · Hector · depende de: —
  - **Hecho cuando:** `bun install` en un clon limpio termina sin errores y `bun run typecheck` pasa en los 3 paquetes. *Desbloquea a todos.*
  - **Preparacion local (2026-10-01):** implementada en `t-01-monorepo-bun`; instalacion limpia y tipos verificados. PR #1 abierto; pendiente revision de Nahum/Massimo por el scaffolding minimo y fusion en main.
  - **Hecha — PR #1 (2026-10-04):** PR #1 fusionado en main. Auditoría de Massimo: clon limpio de `main` (3eeb079) → `bun install` y `bun run typecheck` correctos en los 3 paquetes, con Bun 1.4.2.
- [x] T-02 · 🔓 Repo en GitHub, `main` protegida (1 aprobación obligatoria), plantilla de PR con casilla "¿marcaste TAREAS.md?" · Hector · depende de: T-01 · PR #2
  - **Hecho cuando:** un `git push` directo a `main` es rechazado y un PR no se puede fusionar sin aprobación.
  - **Preparacion local (2026-10-01):** plantilla de PR en `t-02-plantilla-proteccion`. Hector confirmo que Nahum configurara main; PR #2 abierto como borrador; pendiente aplicar y verificar proteccion y fusion.
  - **Auditoría (2026-10-04):** PR #2 fusionado (plantilla), pero `gh api repos/nahumsvr/blackjack-troyano/branches/main` devuelve `protected:false` y no hay rulesets; tres commits de documentación entraron a main sin PR. La protección sigue sin aplicarse.
  - **Hecha — protección aplicada (2026-10-05):** Nahum aplicó `.github/proteccion-main.json` más historial lineal: 1 aprobación de otro dev también para administradores, sin force-push ni borrado. El repositorio solo permite fusionar con squash y borra la rama al fusionar. Un push directo de prueba a `main` fue rechazado (`GH006: Protected branch update failed … Changes must be made through a pull request`).
- [x] T-06 · 🔓 `Bun.serve` en `0.0.0.0:3000` con upgrade a `/ws`, suscripción a topic `lobby` y mensaje de bienvenida con número de conectados · Hector · depende de: T-01 · PR #3
  - **Hecho cuando:** con 3 pestañas (o 3 laptops) abiertas, las 3 muestran "conectados: 3" y se actualiza en < 1 s al cerrar una. *Desbloquea a Nahum (T-11).*
  - **Preparacion local (2026-10-01):** implementada en `t-06-servidor-websocket`; tipos y 3 pruebas con sockets reales correctos. Bienvenida confirmada por Hector y documentada en PLAN.md. PR #3 abierto como borrador; pendiente verificacion visual con tres pestañas, revision y fusion.
  - **Auditoría (2026-10-04):** PR #3 fusionado; las 3 pruebas con sockets reales pasan en clon limpio de main. Falta la verificación visual con tres pestañas para cerrar la casilla.
  - **Hecha — verificación visual (2026-10-05 CDMX):** tres pestañas reales de Chromium muestran 3 conexiones; cerrar una actualiza las restantes a 2 en 32 ms. Capturas y medición en [evidencia T-06](../docs/evidencia/t06/README.md). Prueba automatizada con renderizado headless sobre código fusionado; puerto efímero para preservar el proceso ajeno en 3000. No acredita LAN ni T-13.
- [x] T-07 · 🔓 Enrutador: `JSON.parse` + `safeParse` de Zod + `switch` por `type` + `try/catch` global + respuesta `error` con `reqId` + límite de 16 KB · Hector · depende de: T-03, T-06 · PR #18
  - **Hecha — PR #18 (2026-10-05):** fusionada en main; los ataques y continuidad de tres conexiones están comprobados en las pruebas WebSocket reales.
  - **Hecho cuando:** enviar `no-json`, `{"type":"x"}`, `{"type":"apostar","cantidad":-5}` y un mensaje de 1 MB devuelve `error` con el código correcto y el servidor sigue atendiendo a las otras pestañas.
  - **Preparación histórica — PR #18 (2026-10-05, antes de fusionar):** `Enrutador`, validación UTF-8 de 16 KB, errores correlacionados, `ping`/`pong` y seis pruebas nuevas con sockets reales. En aquel momento faltaban revisión/fusión y la conexión de auth/economía. Esa preparación quedó integrada en PR #18; auth y consulta de billetera se conectaron después en PR #19.
- [x] T-08 · Auth: `registro`, `login`, `reanudar`, `logout` con `Bun.password` y tabla `sesiones`; al registrarse da $10,000, 500 fichas y los 3 artículos gratuitos equipados (en una transacción) · Hector · depende de: T-05, T-07 · PR #19
  - **Hecho cuando:** registrar → cerrar pestaña → abrir de nuevo → `reanudar` entra como el mismo usuario sin pedir contraseña; contraseña incorrecta → `CREDENCIALES_INVALIDAS`; usuario repetido → `USUARIO_EXISTE`.
  - **Preparación histórica — PR #19 (2026-10-05, antes de fusionar):** Argon2id, tokens persistentes de siete días, registro atómico con saldos/inventario/equipado/libro contable y revocación de sesión. Nueve pruebas SQL/WebSocket, incluida recuperación tras reiniciar. Esa preparación recibió revisión y se fusionó, como registra el cierre siguiente. Detalle en [Avance-H-02.md](Avance-H-02.md).
  - **Hecha — PR #19 (2026-10-05 CDMX):** revisión aprobada y fusión en `831dcd2`; 203 pruebas completas con PostgreSQL 16.15 sin fallos. Criterio de registro/reanudación y errores de acceso comprobado en sockets reales. La prueba del cliente y el lobby completo siguen siendo T-11/T-13.
- [ ] T-09 · `GestorMesas` con las 3 mesas de config, `lobby.listar`, `mesa.unirse`/`mesa.salir` (solo asientos, sin juego) y publicación de `lobby` al cambiar ocupación · Hector · depende de: T-08
  - **Hecho cuando:** 3 usuarios distintos ven las 3 mesas; cuando uno se sienta, las otras 2 pestañas ven "1/5" en < 1 s; una sexta persona recibe `MESA_LLENA`.

### Nahum
- [x] T-10 · Cliente Vite + React + TS + Tailwind, proxy de `/ws` a `:3000`, `vite --host` · Nahum · depende de: T-01 · PR #6
  - **Hecho cuando:** `bun run dev` abre la app en otra laptop de la misma red usando la IP de la máquina.
  - **Hecha — PR #6 (2026-10-05):** Vite 7 + React 19 + Tailwind 4, proxy de `/ws`, `vite --host`, `config.ts` y `LimiteErrores` quedaron en `main`. Verificados typecheck, build y la `bienvenida` de T-06 a través del proxy. Se restaura la marca que ya tenía `main`; desbloquea T-38.
- [ ] T-11 · Capa de red: hook `useSocket` con reconexión (1 s, 2 s, 4 s… máx 10 s), envío con `reqId`, `reanudar` automático con token de `localStorage`, store global de estado · Nahum · depende de: T-03, T-08, T-10 · PR #7 (fusionado)
  - **Hecho cuando:** reiniciar el servidor con la app abierta → el cliente muestra "reconectando" y vuelve solo, con la misma sesión, sin recargar.
  - **Avance — PR #7 (2026-10-05):** `Transporte`, `Conexion` (reconexión 1/2/4/8/10 s, `reqId` con timeout de 8 s, sin cola offline, validación Zod), desfase del reloj, token con respaldo en memoria, reductor/controlador/store y 45 pruebas. La reconexión se comprobó con T-06 y el mock. `reanudar` real ya existe desde T-08 (PR #19 fusionado); T-11 sigue abierta hasta acreditar su criterio con el cliente real sobre una versión integrada.
- [x] T-12 · 🔓 Mock del servidor (`?mock=1`) con snapshots `MesaEstado` de las 6 fases, billetera, catálogo e inventario de ejemplo · Nahum · depende de: T-03 · PR #7 (avance original de #8) + PR #16
  - **Hecho cuando:** sin backend, se pueden ver las pantallas de mesa en cada fase y la tienda. *Permite que el cliente avance sin esperar al servidor.*
  - **Avance integrado en PR #7 (original #8, 2026-10-05):** `ServidorFalso` con las validaciones del contrato, fixtures de las 6 fases comprobados contra `shared`, validación de formularios, pantallas base y barra del modo `?mock=1`. Recorrido acceso → lobby → 6 fases → billetera → historial verificado sin backend; 70 pruebas. El mock ya responde `tienda.catalogo` con datos de ejemplo, en esa versión todavía no había una pantalla para mostrarlos. PR #16 completó esa vista y cerró T-12.
  - **Hecha — PR #16 (2026-10-05 CDMX):** pestaña «Tienda» en el menú lateral (`CatalogoTienda`) con el catálogo de `tienda.catalogo` agrupado por tipo, precio y «Poseído»; solo lectura (la compra sigue siendo T-39, pospuesta). Prueba del controlador con el `ServidorFalso`: 14 artículos y 3 gratuitos poseídos. Desbloquea T-27.
- [ ] T-13 · Pantallas de login/registro y lobby conectadas al servidor real (errores del servidor visibles como aviso) · Nahum · depende de: T-08, T-09, T-11
  - **Hecho cuando:** **checkpoint Hito 1** — 3 pestañas con 3 usuarios distintos logueadas ven el lobby y la ocupación en vivo.
  - **Lado del cliente listo (2026-10-05):** pantallas de acceso y lobby con el mock, integradas mediante PR #7 (avance original #8). T-08 ya está fusionada; falta T-09 y el criterio de T-11 para cerrar la prueba del lobby real.

### Massimo
- [x] T-03 · 🔓 Contrato en `shared/`: esquemas Zod de todos los mensajes de `PLAN.md` §3 (uniones discriminadas por `type`), tipos con `z.infer`, `MesaEstado`, `CartaVista`, catálogo de códigos de error con mensajes en español · Massimo · depende de: T-01 · PR #4, #7 y #14
  - **Preparación local (2026-10-04):** Contrato implementado y verificado localmente: 18 mensajes entrantes, 12 salientes, tipos inferidos, errores españoles y 40 pruebas del contrato. Importaciones verificadas desde server y client. Publicado en PR #4 (abierto, sin revisión); detalles en Avance-M-01.md.
  - **Hecha (2026-10-05 CDMX):** PR #4 aporta los esquemas y pruebas; PR #14 centraliza los límites en `LIMITES_CANTIDAD`; PR #7 integra el cliente que importa los mismos esquemas y límites. La revisión de #7 comprobó ese uso y su build. Ver [Avance-M-03.md](Avance-M-03.md) y [Avance-N-01.md](Avance-N-01.md).
  - **Hecho cuando:** `server` y `client` importan `@blackjack/shared` sin errores de tipos y hay un test con 1 ejemplo válido y 1 inválido por cada mensaje (todos pasan). *Desbloquea a Hector y Nahum.*
- [x] T-04 · 🔓 `docker-compose.yml` con Postgres 16 + volumen, `.env.example` con `DATABASE_URL` · Massimo · depende de: T-01 · PR #4
  - **Preparación local (2026-10-04):** Compose PostgreSQL 16, volumen y .env.example preparados; docker compose config --quiet correcto. Arranque Docker pendiente por permisos del daemon. Esquema comprobado aparte en PostgreSQL 18.6; no acredita el gate de PostgreSQL 16. Incluido en PR #4 (abierto).
  - **Gate verificado (2026-10-04, 23:45):** `docker compose up -d --wait` → postgres:16.15 sano; `psql $DATABASE_URL -c 'select 1'` → 1 (puerto 5433 por conflicto local). Pendiente fusión del PR #4.
  - **Hecho cuando:** `docker compose up -d` levanta la BD y `psql $DATABASE_URL -c 'select 1'` responde.
  - **Hecha — PR #4 (2026-10-05):** PR #4 fusionado. Criterio verificado con PostgreSQL 16.15 y Bun 1.3.13 en [Avance-M-02](Avance-M-02.md); se marca según esa auditoría.
- [x] T-05 · 🔓 `server/db/schema.sql` (7 tablas con PK, FK, `CHECK` e índices de `PLAN.md` §4), `seed.sql` (14 artículos) y script `bun run db:reset` · Massimo · depende de: T-04 · PR #4
  - **Preparación local (2026-10-04):** Siete tablas, índices, 14 artículos y db:reset atómico implementados. Reinicio, restricciones y conservación de datos ante fallo comprobados en PostgreSQL 18.6; pendiente entorno objetivo y PR. Incluido en PR #4 (abierto).
  - **Gate verificado (2026-10-04, 23:45):** en PostgreSQL 16.15 con Bun 1.3.13, `db:reset` → 7 tablas y 14 artículos; `UPDATE usuarios SET fichas = -1` falla por `usuarios_fichas_check`; artículo repetido en `inventario` falla por `inventario_pkey`. Pendiente fusión del PR #4.
  - **Hecho cuando:** `bun run db:reset` en limpio crea 7 tablas y 14 artículos; `UPDATE usuarios SET fichas = -1` falla por `CHECK`; insertar dos veces el mismo artículo en `inventario` falla por PK. *Desbloquea a Hector (T-08).*
  - **Hecha — PR #4 (2026-10-05):** PR #4 fusionado. Criterio verificado en [Avance-M-02](Avance-M-02.md) (7 tablas, 14 artículos, restricciones comprobadas en SQL); se marca según esa auditoría.
- [ ] T-14 · README con requisitos (Bun, Docker) y los 4 comandos para arrancar (borrador del manual de instalación) · Massimo · depende de: T-05
  - **Preparación local (2026-10-04):** README y docs/manual-instalacion.md actualizados con los comandos existentes y límites actuales. Pendiente que Nahum arranque independientemente siguiendo el README. Incluido en PR #4 (abierto).
  - **Hecho cuando:** Nahum levanta el proyecto en su máquina solo con el README, sin preguntar.

---

## Hito 2 — sáb 3 oct: ronda completa con 3 jugadores + compra de fichas con límite

### Hector
- [x] T-15 · Clases `Carta` y `Baraja` (4 mazos, Fisher–Yates con `crypto.getRandomValues`, rebarajar con < 25 %) con JSDoc · Hector · depende de: T-03 · PR #25
  - **Hecha — PR #25 (2026-10-05 CDMX):** fusionada en `83165c6`; cinco pruebas verifican 208 instancias, cuatro copias de cada vista, extracción sin reemplazo y umbral 52/51. Auditoría con Bun 1.3.13 y PostgreSQL 16.15: 208 pruebas sin fallos/omisiones, typecheck/build correctos.
  - **Hecho cuando:** `bun test` verifica 208 cartas únicas por rebarajado y que `necesitaRebarajar()` se activa con 51 cartas restantes.
- [x] T-16 · `Mano` (As 1/11, blanda, blackjack natural, pasada) y `Dealer` (pide ≤ 16, se planta en todo 17) · Hector · depende de: T-15
  - **Preparación histórica — PR #27 (2026-10-05, antes de fusionar):** `Mano` calcula total/blanda/natural/pasada sin mutar cartas; `Dealer` pide hasta 17 y se planta también en 17 blando. Dieciséis pruebas nuevas, typecheck y suite completa de 224 pruebas con PostgreSQL 16 pasan. PR apilado sobre T-15 (#25); pendiente revisión/fusión.
  - **Hecha — PR #27 (2026-10-05 CDMX):** fusionada en `af772d8`; sus dieciséis pruebas cubren los casos del criterio, As flexible y regla de 17 blando. Auditoría del entorno objetivo registrada en Revision-PR-23.md.
  - **Hecho cuando:** ≥ 10 casos de prueba pasan: A+K = 21 blackjack; A+A+9 = 21; A+6 = 17 blanda; A+6+10 = 17 dura; 10+6+A = 17; K+Q+2 = 22 pasada; el dealer con A+6 se planta.
- [ ] T-17 · Función pura `resolver(mano, manoDealer, apuesta)` → `{resultado, pago}` · Hector · depende de: T-16
  - **Hecho cuando:** tests: blackjack con apuesta 10 → pago 25; gana con 10 → 20; empate → 10; pierde → 0; blackjack vs blackjack del dealer → empate; jugador pasado pierde aunque el dealer también se pase.
- [ ] T-18 · 🔓 `Mesa`: máquina de estados de `PLAN.md` §6, asientos, `snapshot()` que **nunca** incluye la carta oculta, publicación en `mesa:<id>` · Hector · depende de: T-09, T-16
  - **Hecho cuando:** con 3 pestañas, las 3 reciben el mismo `mesa.estado` en < 1 s en cada transición y, en la pestaña de red del navegador, la carta oculta del dealer aparece como `{oculta:true}`. *Desbloquea a Nahum (T-28).*
- [ ] T-19 · Relojes: 15 s apuestas (cierra antes si todos apostaron), 20 s por turno (auto-plantar), 5 s de resultados; un solo `setTimeout` por mesa · Hector · depende de: T-18
  - **Hecho cuando:** un jugador que no actúa en 20 s queda `PLANTADO` y el turno pasa al siguiente; la mesa encadena 5 rondas sin intervención y sin quedarse atorada.
- [ ] T-20 · Acciones `apostar`, `pedir`, `plantarse` con todas las validaciones (fase, turno, rango, múltiplo de 10, saldo vía interfaz `Billetera`; con billetera falsa si T-23 no está) · Hector · depende de: T-18, T-22
  - **Hecho cuando:** `pedir` fuera de turno → `NO_ES_TU_TURNO`; apostar en `TURNOS` → `FASE_INCORRECTA`; apostar 15, 0, -10, 10.5, "abc" o 600 → `CANTIDAD_INVALIDA`; apostar dos veces → `YA_APOSTASTE`.
- [ ] T-21 · Liquidación en `PAGOS`: `acreditarPago` por jugador, `INSERT` en `rondas` y `rondas_jugadores` y mensaje `ronda.resultado` · Hector · depende de: T-17, T-23
  - **Hecho cuando:** tras una ronda de 3 jugadores, `SELECT * FROM rondas_jugadores WHERE ronda_id = …` muestra 3 filas con resultado y pago correctos, y las fichas de cada usuario coinciden con `movimientos`.
- [ ] T-26 · `scripts/bots.ts`: N bots que se registran, se sientan, apuestan 10 y piden hasta 17 · Hector · depende de: T-20
  - **Hecho cuando:** `bun run bots 4 --mesa mesa-1` juega 10 rondas seguidas sin errores en la consola del servidor (sirve también de jugadores extra en la demo).

### Nahum
- [ ] T-27 · Componentes `Carta` (frente y reverso por CSS/SVG, sin imágenes externas), `Asiento` (avatar, nombre, apuesta, total, estado, desconectado) y `ManoDealer` · Nahum · depende de: T-12 · rama de PR #7 (avance original de #9)
  - **Hecho cuando:** en el mock se ven las 52 cartas y los 5 reversos del catálogo correctamente.
  - **Avance integrado en PR #7 (original #9, 2026-10-05):** `Carta` en CSS (reverso para `{oculta:true}`), `Ficha` en SVG, `Asiento`, `ManoDealer`, `MesaVisual` con el dealer al centro y un color por asiento. La animación de reparto y el volteo llegan con T-28. Falta la página de prueba con las 52 cartas; los 5 reversos del catálogo dependen de T-40 (pospuesta), hoy hay un reverso único.
- [ ] T-28 · Pantalla de mesa: fase, cuenta regresiva a partir de `finEn`, fichas para apostar, botones Pedir/Plantarse habilitados **solo** en tu turno · Nahum · depende de: T-27, T-11 (mock) y T-18 (real) · rama de PR #7 (avance original de #11)
  - **Hecho cuando:** con 3 pestañas reales, solo la pestaña con el turno tiene los botones activos y las 3 ven la carta repartida en < 1 s.
  - **Avance integrado en PR #7 (original #11, 2026-10-05):** temporizador circular desde `finEn` (verde → ámbar → rojo) y barra del turno; cartas que vuelan del zapato del dealer y se descubren en orden de casino; total sobre la última carta; jugador propio abajo al centro; selector de fichas 10/50/100/500; Pedir y Plantarse solo en tu turno; panel de acciones centrado. 101 pruebas, verificado en el mock. Falta la prueba con 3 pestañas reales (requiere T-18).
- [ ] T-29 · Resultado de ronda (overlay con ganó/perdió/empate y fichas) + avisos de error legibles a partir de `error.mensaje` · Nahum · depende de: T-28 · rama de PR #7 (avance original de #12)
  - **Hecho cuando:** al terminar la ronda cada jugador ve su resultado; forzar `pedir` fuera de turno desde consola muestra el aviso "No es tu turno".
  - **Avance integrado en PR #7 (original #12, 2026-10-05):** pantalla de resultado animada por tono (victoria con rayos, confeti y fichas volando; empate; derrota), píldora para reabrirla, avisos y saldo animados; los avisos de `error.mensaje` y el límite de errores vienen de T-11/T-12. 116 pruebas, verificado en el mock. Falta probar con el servidor real (requiere T-18 y T-20).
- [ ] T-30 · Panel de billetera: dinero, fichas, "te quedan X fichas por comprar hoy, se reinicia a las 00:00", compra con botón deshabilitado mientras espera respuesta y `clave` nueva por clic · Nahum · depende de: T-24 (mock mientras tanto) · rama de PR #7 (avance original de #10)
  - **Hecho cuando:** comprar 1,000 actualiza saldo y disponible; con el límite agotado, el botón muestra el motivo y la hora de reinicio.
  - **Avance integrado en PR #7 (original #10, 2026-10-05):** billetera en un menú lateral accesible desde lobby y mesa; compra con validación previa (contrato y `disponibleHoy`), `clave` nueva por clic y botón deshabilitado mientras espera. En el mock: 1,000 actualiza saldo y disponible, el doble clic cobra una vez y 0, -10, 10.5, 15 y 1e9 no se envían. Falta probar contra T-24 por WebSocket (requiere T-07).
- [ ] T-33 · Guion de exposición v1 (`docs/exposicion.md`): estructura, quién dice qué y tiempos (≈3 min cada uno), guion de la demo en vivo · Nahum · depende de: —
  - **Hecho cuando:** los 3 aprobaron el guion en el grupo y suma ≤ 9 min en papel.
  - **v1 en PR #17, pendiente aprobación del grupo (2026-10-06):** `docs/exposicion.md` con bloques y tiempos (9:00), guion de la demo alineado con CHECKLIST §2, plan B, preguntas probables y checklist previo. Hector y Massimo ajustan sus bloques en el PR. Se marca al aprobarlo los 3; desbloquea T-51.

### Massimo
- [ ] T-22 · 🔓 `server/src/db` (conexión `sql` de Bun, helper `enTransaccion`) + **interfaz `Billetera`** con JSDoc y firmas definitivas · Massimo · depende de: T-05
  - **Preparación local (2026-10-04):** crearConexion, enTransaccion e interfaz Billetera con firmas async implementados y verificados. Pendiente PR/fusión e importación por Hector en T-20. Incluido en PR #4 (abierto).
  - **Hecho cuando:** la interfaz está fusionada en `main` y Hector la importa para T-20 con una implementación falsa en memoria. *Desbloquea a Hector.*
- [x] T-23 · `BilleteraSQL.debitarApuesta` / `acreditarPago` con `FOR UPDATE` + `movimientos` · Massimo · depende de: T-22 · PR #4
  - **Preparación local (2026-10-04):** Débito y pago transaccionales implementados; tests PostgreSQL real verifican rollback, concurrencia, saldo y ledger. Pago cero no crea movimiento. Pendiente integración con Mesa y PR. Incluido en PR #4 (abierto).
  - **Hecho cuando:** test: debitar más fichas de las que hay → `FICHAS_INSUFICIENTES` y ni `usuarios` ni `movimientos` cambian.
  - **Hecha — PR #4 (2026-10-05):** PR #4 fusionado. Criterio técnico verificado con PostgreSQL real en [Avance-M-02](Avance-M-02.md); se marca según esa auditoría. La conexión al enrutador depende de T-07.
- [x] T-24 · `fichas.comprar` con límite diario en CDMX, idempotencia por `clave` y mensaje `billetera` con `compradoHoy`, `disponibleHoy`, `reinicioEn` · Massimo · depende de: T-22 · PR #4
  - **Preparación local (2026-10-04):** Compra idempotente con límite del día CDMX implementada y probada en PostgreSQL real, incluido reloj capturado después del bloqueo. Pendiente handler WebSocket y PR. Incluido en PR #4 (abierto).
  - **Hecho cuando:** comprar 5,000 funciona; comprar 10 más → `LIMITE_DIARIO`; cambiar la fecha de los movimientos a "ayer" en SQL → se puede comprar otra vez; repetir la misma `clave` no cobra dos veces.
  - **Hecha — PR #4 (2026-10-05):** PR #4 fusionado. Criterio técnico verificado con PostgreSQL real en [Avance-M-02](Avance-M-02.md); se marca según esa auditoría. El mensaje por WebSocket depende del enrutador (T-07); el cliente ya lo consume en T-30.
- [x] T-25 · Tests de economía contra Postgres real: 10 compras de 1,000 en paralelo con límite 5,000 → exactamente 5 exitosas; doble `clave`; dinero insuficiente; cantidades 0, -10, 10.5, 15, 1e9 · Massimo · depende de: T-24 · PR #4
  - **Preparación local (2026-10-04):** Suite de economía/tienda ejecutada contra PostgreSQL 18.6 con TEST_DATABASE_URL: concurrencia, límites, idempotencia, rechazo, paginación y reconciliación contable. Suite conjunta: 70 pruebas correctas; pendiente repetir entorno objetivo. Incluido en PR #4 (abierto).
  - **Entorno objetivo (2026-10-04, 23:45):** clon limpio con Bun 1.3.13 + PostgreSQL 16.15: 70 pruebas, 381 aserciones y 0 fallos (cubre también T-23, T-24 y T-34). Pendiente fusión del PR #4.
  - **Hecho cuando:** `bun test` en verde y la suma de `movimientos` de cada usuario de prueba coincide con su saldo final.
  - **Hecha — PR #4 (2026-10-05):** PR #4 fusionado. Suite de economía con PostgreSQL real: 70 pruebas, 0 fallos ([Avance-M-02](Avance-M-02.md)); se marca según esa auditoría.
- [ ] T-31 · Integración Hito 2 en 3 laptops (coordina, los 3 participan); abrir issues por cada fallo · Massimo · depende de: T-20, T-21, T-28, T-24
  - **Hecho cuando:** **checkpoint Hito 2** — 3 personas en 3 laptops juegan 5 rondas seguidas sin errores, y cada una compra fichas respetando el límite.
- [ ] T-32 · `docs/arquitectura.md` v1: arquitectura, diagrama de clases, máquina de estados y ER (desde `PLAN.md`, actualizados a lo que realmente se construyó) · Massimo · depende de: T-18
  - **Preparación local (2026-10-04):** Borrador docs/arquitectura.md con módulos/clases existentes, ER y máquina de estados prevista. T-18 y revisión/renderizado de GitHub pendientes; no se considera terminada. Incluido en PR #4 (abierto).
  - **Hecho cuando:** los diagramas se ven renderizados en GitHub y coinciden con los nombres de las clases reales.

---

## Hito 3 — dom 4 oct: tienda, inventario, desconexiones, validaciones. **Congelamiento 22:00**

### Hector
- [ ] T-36 · Desconexión y reconexión (`PLAN.md` §7): auto-plantar, reserva de 60 s, `reanudar` recupera asiento, otra pestaña toma el asiento y la anterior queda espectadora · Hector · depende de: T-19, T-08
  - **Hecho cuando:** cerrar la pestaña del jugador en turno → se planta en < 1 s y la mesa sigue; reabrirla en < 60 s → vuelve a su asiento con sus cartas; abrir la mesa en una 2ª pestaña del mismo usuario → la 1ª ya no puede actuar.
- [ ] T-37 · Endurecimiento: límite de 20 mensajes/s, acciones de espectadores rechazadas, `ERROR_INTERNO` sin tumbar el proceso, logs claros · Hector · depende de: T-07
  - **Hecho cuando:** un script que manda 1,000 mensajes basura en 1 s recibe errores y las otras pestañas siguen jugando sin retraso notable.
- [ ] T-38 · En producción el servidor sirve `client/dist` (un solo puerto 3000) y el cliente usa el mismo host para `/ws` · Hector · depende de: T-10
  - **Hecho cuando:** `bun run build && bun run start` y otra laptop abre `http://<ip>:3000` y juega.
  - **Desbloqueada (2026-10-05):** T-10 ya está en `main` (PR #6). El cliente construye la URL de `/ws` con el mismo host, así que funciona servido por Bun sin cambios.

### Nahum
- [ ] T-39 · Tienda: catálogo por tipo con precio, "poseído" y compra con confirmación · Nahum · depende de: T-34
  - **Hecho cuando:** comprar un artículo descuenta fichas, aparece como poseído y el botón ya no deja comprarlo otra vez.
  - **⏸ Pospuesta (2026-10-05):** Nahum la pospone (no se elimina) según el criterio de corte de PLAN §10, pendiente de confirmar en la decisión de corte del equipo. Se retoma solo si las tareas P0 del cliente están fusionadas, T-31 pasó y T-34 está conectada al enrutador.
- [ ] T-40 · Inventario y equipar; avatar y reverso de los demás visibles en la mesa; tema de mesa aplicado localmente · Nahum · depende de: T-35
  - **Hecho cuando:** A equipa `avatar_robot` en el lobby, entra a la mesa y B y C ven el robot en el asiento de A.
  - **⏸ Pospuesta (2026-10-05):** igual que T-39; además requiere T-35.
- [ ] T-41 · Historial de movimientos (tabla con tipo, cambio en fichas/dinero, saldo resultante, fecha en hora local; "ver más") · Nahum · depende de: T-34 · rama de PR #7 (avance original de #10)
  - **Hecho cuando:** tras comprar fichas, apostar y comprar un artículo, aparecen las 3 filas en orden con los saldos correctos.
  - **Avance integrado en PR #7 (original #10, 2026-10-05):** historial compacto en el menú lateral con tipo, Δ fichas, Δ dinero, saldo y hora local; "Ver más" con `antesDe` y `hayMas`. Verificado en el mock. Falta `movimientos.listar` por WebSocket (T-34 + T-07).
- [ ] T-42 · Indicador de conexión propia (conectado / reconectando) y de jugadores desconectados en su asiento · Nahum · depende de: T-36
  - **Hecho cuando:** al apagar el Wi-Fi de una laptop, las otras dos ven a ese jugador como "desconectado" en < 2 s.
  - **Avance integrado en PR #7 (originales #8 a #11, 2026-10-05):** indicador propio (conectado / reconectando / sin conexión) en el encabezado y marca "Desconectado" en el asiento de los demás según `conectado` del snapshot. Falta la prueba de apagar el Wi-Fi con 3 laptops (requiere T-36).

### Massimo
- [x] T-34 · Backend de tienda: `tienda.catalogo`, `tienda.comprar` (`FOR UPDATE`, `YA_POSEIDO`, `FICHAS_INSUFICIENTES`), `inventario.listar`, `movimientos.listar` paginado · Massimo · depende de: T-23 · PR #4
  - **Preparación local (2026-10-04):** Tienda.catalogo/comprar/inventario/listarMovimientos implementados y probados directamente contra PostgreSQL; doble compra cobra una vez. Pendiente handlers/publicaciones WebSocket y PR. Incluido en PR #4 (abierto).
  - **Hecho cuando:** test: dos compras simultáneas del mismo artículo → una exitosa y una `YA_POSEIDO`, cobrada una sola vez.
  - **Hecha — PR #4 (2026-10-05):** PR #4 fusionado. Servicios verificados con PostgreSQL real en [Avance-M-02](Avance-M-02.md); se marca según esa auditoría. `movimientos.listar` por WebSocket depende del enrutador (T-07); el cliente ya lo consume en T-41.
- [ ] T-35 · `inventario.equipar` con `BLOQUEADO_EN_MANO` (consulta a `GestorMesas`) y republicación del snapshot de la mesa · Massimo · depende de: T-34, T-18
  - **Preparación local (2026-10-04):** Bloqueada por GestorMesas (T-18). No se implementa equipamiento sin validación autoritativa de fase ni publicación del snapshot.
  - **Hecho cuando:** equipar en fase `TURNOS` → `BLOQUEADO_EN_MANO`; en `APUESTAS` → los demás ven el cambio en < 1 s; equipar algo no poseído → `NO_POSEIDO`.
- [ ] T-43 · Congelamiento: todas las tareas del Hito 3 fusionadas, `main` estable, tag `v0.9-congelado` · Massimo · depende de: T-36…T-42, T-34, T-35
  - **Hecho cuando:** existe el tag y, a partir de aquí, solo entran PRs de corrección de bugs y documentación.

---

## Hito 4 — lun 5 oct: solo pruebas, bugs y documentación

### Hector
- [ ] T-45 · JSDoc completo en `server/src/game`, `server/src/ws`, `server/src/auth` (clases, métodos públicos, parámetros, errores que lanza) + comentario de cabecera por archivo · Hector · depende de: T-43
  - **Hecho cuando:** ninguna clase o función exportada de esas carpetas queda sin JSDoc (revisado por Massimo).

### Nahum
- [ ] T-47 · JSDoc/comentarios en hooks de red, store y componentes principales del cliente · Nahum · depende de: T-43
  - **Hecho cuando:** `useSocket`, el store y las 5 pantallas tienen comentario de propósito; revisado por Hector.
  - **Avance (2026-10-05):** todo el código del cliente en los PRs #6 a #12 tiene comentario de cabecera y JSDoc en clases, funciones exportadas y componentes. Falta la revisión final de Hector tras el congelamiento.
- [ ] T-49 · `docs/manual-usuario.md` con capturas: registro, lobby, cómo jugar una ronda, comprar fichas, tienda, inventario, historial, qué pasa si te desconectas · Nahum · depende de: T-43
  - **Hecho cuando:** Hector (que no lo escribió) juega una ronda y compra un artículo siguiendo solo el manual.
- [ ] T-51 · Diapositivas (≤ 8, más imágenes que texto): problema, arquitectura, protocolo, juego, economía/transacciones, demo, cierre · Nahum · depende de: T-33
  - **Hecho cuando:** ninguna diapositiva tiene más de 25 palabras y las 3 personas las aprobaron.

### Massimo
- [ ] T-44 · Pasar **completa** la sección de Funcionamiento de `CHECKLIST_ENTREGA.md`; cada fallo → issue asignado · Massimo · depende de: T-43
  - **Hecho cuando:** todas las casillas de Funcionamiento están en `[x]` o tienen issue abierto con dueño y fecha.
- [ ] T-46 · JSDoc completo en `server/src/store`, `server/src/db` y `shared/` · Massimo · depende de: T-43
  - **Preparación local (2026-10-04):** Los nuevos archivos shared/db/store incluyen comentarios de propósito y documentación de APIs. Revisión final de Hector y gate T-43 pendientes. Incluido en PR #4 (abierto).
  - **Hecho cuando:** ninguna función exportada queda sin JSDoc (revisado por Hector).
- [ ] T-48 · `docs/manual-instalacion.md`: requisitos con versiones, clonar/descomprimir, `.env`, Docker, `db:reset`, `build`, `start`, cómo conectarse desde otra laptop, problemas comunes (puerto ocupado, firewall) · Massimo · depende de: T-38
  - **Preparación local (2026-10-04):** Borrador docs/manual-instalacion.md disponible; build/start, PostgreSQL 16 y prueba independiente de Nahum pendientes. Incluido en PR #4 (abierto).
  - **Hecho cuando:** Nahum instala desde cero en su laptop siguiendo solo el manual.
- [ ] T-50 · `docs/arquitectura.md` final: descripción de cada tabla + `schema.sql`/`seed.sql` referenciados, diagrama de clases, diagrama de dependencias, protocolo, máquina de estados, decisiones de diseño · Massimo · depende de: T-32, T-45
  - **Preparación local (2026-10-04):** Borrador de arquitectura referencia schema/seed y distingue implementación de diseño pendiente. Motor/auth/router/cliente y revisión de Hector pendientes.
  - **Hecho cuando:** cubre los 3 puntos de la rúbrica (BD con scripts, clases, dependencias) y Hector confirma que coincide con el código.

---

## Hito 5 — mar 6 oct: exposición ensayada y `.zip` probado

- [ ] T-52 · Ensayo 1 cronometrado de la exposición con demo en vivo + retroalimentación · **Equipo** · depende de: T-51
  - **Hecho cuando:** duración anotada en `ESTADO.md`, lista de ajustes escrita.
- [ ] T-53 · Video de respaldo de la demo (≈3 min, 3 jugadores, ronda completa, compra de fichas, tienda) · Nahum · depende de: T-44
  - **Hecho cuando:** el video se reproduce desde USB y desde la nube sin internet de la escuela (descargado).
- [x] T-54 · Script `bun run empaquetar` → `blackjack-equipo.zip` sin `node_modules`, `.env`, `dist` ni `.git`, con `docs/` y `README` · Massimo · depende de: T-48
  - **Hecha — PR #20 (2026-10-06 CDMX):** fusionada en `c2daf78`. Bun 1.3.13 genera ZIP real de fuentes (124 archivos, 272,903 bytes en la rama documental); `unzip -t` del sistema valida el archivo y pesa <20 MB. Diez regresiones del empaquetador verifican exclusiones y alternativas. T-48/T-55, prueba en Windows y paquete final con juego continúan pendientes; esta casilla acredita el script y su criterio, no la aceptación de la entrega.
  - **Preparación local (2026-10-04):** Script empaquetar preparado para generar/validar ZIP de fuentes. Fixture ZIP del script verificada; archivo de sesión y validación de fuentes extraídas pendientes, además de instalación limpia del proyecto completo; no es el paquete final de entrega. Incluido en PR #4 (abierto).
  - **Hecho cuando:** el `.zip` pesa < 20 MB, abre con el descompresor del sistema y **no** es `.rar`.
  - **Corrida histórica (2026-10-05 CDMX, basada en main `831dcd2` más cambios locales del empaquetador):** aquel ZIP contenía 115 archivos y 255,142 bytes; integridad y exclusiones comprobadas. Su copia extraída instaló con lockfile fijo, pasó typecheck, 203 pruebas con PostgreSQL 16.15 y build del cliente. Estas cifras corresponden exclusivamente a esa corrida; no acreditan la aceptación del ZIP final ni cierran T-54/T-55. Regenerar y verificar el artefacto final tras integrar las tareas pendientes. Ver [Avance-M-04.md](Avance-M-04.md).
  - **Corrección de revisión — PR #20 (2026-10-05 CDMX):** rutas lógicas POSIX y lectura CRLF del listado ZIP, lockfile `bun.lock` o `bun.lockb`, cualquiera de los cuatro nombres habituales de Compose y selección raíz derivada de los requisitos. Diez pruebas con ZIP real y fixtures temporales verifican contenido/exclusiones, alternativas, enlaces y conservación del ZIP anterior ante requisitos faltantes. Ejecutadas en Linux: verifican la representación portable de rutas, no ejecución nativa en Windows. T-54 y T-55 conservan sus casillas pendientes.
- [ ] T-55 · Probar el `.zip` en una máquina limpia (o usuario nuevo del SO) siguiendo solo el manual de instalación · Hector · depende de: T-54
  - **Hecho cuando:** desde descomprimir hasta jugar con 3 pestañas en ≤ 15 min, sin ayuda; problemas encontrados corregidos en el manual.
- [ ] T-56 · Ensayo 2 final: < 10 min, los 3 hablan, sin leer diapositivas · **Equipo** · depende de: T-52
  - **Hecho cuando:** duración ≤ 9:30 anotada en `ESTADO.md`.

## Entrega — mié 7 oct antes de las 13:00

- [ ] T-57 · Subir el `.zip` final (el mismo que pasó T-55) antes de las 11:00 y verificar que se descarga bien · Massimo · depende de: T-55, T-56
  - **Hecho cuando:** captura de la confirmación de entrega guardada en el grupo; Nahum descargó el archivo desde la plataforma y abre.

---

## Vista por dev (orden sugerido)

- **Hector (19):** T-01 🔓, T-02 🔓, T-06 🔓, T-07 🔓, T-08, T-09, T-15, T-16, T-17, T-18 🔓, T-19, T-20, T-21, T-26, T-36, T-37, T-38, T-45, T-55
- **Nahum (17):** T-10, T-12 🔓, T-11, T-13, T-27, T-28, T-29, T-30, T-33, T-39, T-40, T-41, T-42, T-47, T-49, T-51, T-53
- **Massimo (19):** T-03 🔓, T-04 🔓, T-05 🔓, T-14, T-22 🔓, T-23, T-24, T-25, T-31, T-32, T-34, T-35, T-43, T-44, T-46, T-48, T-50, T-54, T-57
- **Equipo (2):** T-52, T-56

Camino crítico: **T-01 → T-03 → T-07 → T-18 → T-20 → T-31**. Si alguna de estas se atrasa, se reasigna ayuda ese mismo día.

## Extras (NO empezar antes del congelamiento)

- [ ] X-1 · Doblar apuesta
- [ ] X-2 · Dividir (split)
- [ ] X-3 · Seguro
- [ ] X-4 · Chat en la mesa
- [ ] X-5 · Ranking global
