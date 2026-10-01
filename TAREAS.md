# TAREAS — Tablero con checks

Formato: `- [ ] T-XX · descripción · dueño · depende de: T-YY` y debajo **Hecho cuando:** (criterio comprobable).
🔓 = **desbloquea a otro dev** → hacerla primero.
Al terminar una tarea: marcar `[x]`, poner el número de PR y agregar una línea al registro de `ESTADO.md`.

Resumen: **57 tareas** · Hector 19 · Nahum 17 · Massimo 19 · Equipo 2.

---

## Hito 1 — mié 30 sep: monorepo, BD, contrato, login y 3 pestañas en el lobby

### Hector
- [ ] T-01 · 🔓 Monorepo con Bun workspaces (`server`, `client`, `shared`), `tsconfig` estricto base, scripts raíz (`dev`, `test`, `typecheck`), `.gitignore` · Hector · depende de: —
  - **Hecho cuando:** `bun install` en un clon limpio termina sin errores y `bun run typecheck` pasa en los 3 paquetes. *Desbloquea a todos.*
  - **Preparacion local (2026-10-01):** implementada en `t-01-monorepo-bun`; instalacion limpia y tipos verificados. PR #1 abierto; pendiente revision de Nahum/Massimo por el scaffolding minimo y fusion en main.
- [ ] T-02 · 🔓 Repo en GitHub, `main` protegida (1 aprobación obligatoria), plantilla de PR con casilla "¿marcaste TAREAS.md?" · Hector · depende de: T-01
  - **Hecho cuando:** un `git push` directo a `main` es rechazado y un PR no se puede fusionar sin aprobación.
  - **Preparacion local (2026-10-01):** plantilla de PR en `t-02-plantilla-proteccion`. Hector confirmo que Nahum configurara main; PR #2 abierto como borrador; pendiente aplicar y verificar proteccion y fusion.
- [ ] T-06 · 🔓 `Bun.serve` en `0.0.0.0:3000` con upgrade a `/ws`, suscripción a topic `lobby` y mensaje de bienvenida con número de conectados · Hector · depende de: T-01
  - **Hecho cuando:** con 3 pestañas (o 3 laptops) abiertas, las 3 muestran "conectados: 3" y se actualiza en < 1 s al cerrar una. *Desbloquea a Nahum (T-11).*
- [ ] T-07 · 🔓 Enrutador: `JSON.parse` + `safeParse` de Zod + `switch` por `type` + `try/catch` global + respuesta `error` con `reqId` + límite de 16 KB · Hector · depende de: T-03, T-06
  - **Hecho cuando:** enviar `no-json`, `{"type":"x"}`, `{"type":"apostar","cantidad":-5}` y un mensaje de 1 MB devuelve `error` con el código correcto y el servidor sigue atendiendo a las otras pestañas.
- [ ] T-08 · Auth: `registro`, `login`, `reanudar`, `logout` con `Bun.password` y tabla `sesiones`; al registrarse da $10,000, 500 fichas y los 3 artículos gratuitos equipados (en una transacción) · Hector · depende de: T-05, T-07
  - **Hecho cuando:** registrar → cerrar pestaña → abrir de nuevo → `reanudar` entra como el mismo usuario sin pedir contraseña; contraseña incorrecta → `CREDENCIALES_INVALIDAS`; usuario repetido → `USUARIO_EXISTE`.
- [ ] T-09 · `GestorMesas` con las 3 mesas de config, `lobby.listar`, `mesa.unirse`/`mesa.salir` (solo asientos, sin juego) y publicación de `lobby` al cambiar ocupación · Hector · depende de: T-08
  - **Hecho cuando:** 3 usuarios distintos ven las 3 mesas; cuando uno se sienta, las otras 2 pestañas ven "1/5" en < 1 s; una sexta persona recibe `MESA_LLENA`.

### Nahum
- [ ] T-10 · Cliente Vite + React + TS + Tailwind, proxy de `/ws` a `:3000`, `vite --host` · Nahum · depende de: T-01
  - **Hecho cuando:** `bun run dev` abre la app en otra laptop de la misma red usando la IP de la máquina.
- [ ] T-11 · Capa de red: hook `useSocket` con reconexión (1 s, 2 s, 4 s… máx 10 s), envío con `reqId`, `reanudar` automático con token de `localStorage`, store global de estado · Nahum · depende de: T-03, T-10
  - **Hecho cuando:** reiniciar el servidor con la app abierta → el cliente muestra "reconectando" y vuelve solo, con la misma sesión, sin recargar.
- [ ] T-12 · 🔓 Mock del servidor (`?mock=1`) con snapshots `MesaEstado` de las 6 fases, billetera, catálogo e inventario de ejemplo · Nahum · depende de: T-03
  - **Hecho cuando:** sin backend, se pueden ver las pantallas de mesa en cada fase y la tienda. *Permite que el cliente avance sin esperar al servidor.*
- [ ] T-13 · Pantallas de login/registro y lobby conectadas al servidor real (errores del servidor visibles como aviso) · Nahum · depende de: T-08, T-09, T-11
  - **Hecho cuando:** **checkpoint Hito 1** — 3 pestañas con 3 usuarios distintos logueadas ven el lobby y la ocupación en vivo.

### Massimo
- [ ] T-03 · 🔓 Contrato en `shared/`: esquemas Zod de todos los mensajes de `PLAN.md` §3 (uniones discriminadas por `type`), tipos con `z.infer`, `MesaEstado`, `CartaVista`, catálogo de códigos de error con mensajes en español · Massimo · depende de: T-01
  - **Hecho cuando:** `server` y `client` importan `@blackjack/shared` sin errores de tipos y hay un test con 1 ejemplo válido y 1 inválido por cada mensaje (todos pasan). *Desbloquea a Hector y Nahum.*
- [ ] T-04 · 🔓 `docker-compose.yml` con Postgres 16 + volumen, `.env.example` con `DATABASE_URL` · Massimo · depende de: T-01
  - **Hecho cuando:** `docker compose up -d` levanta la BD y `psql $DATABASE_URL -c 'select 1'` responde.
- [ ] T-05 · 🔓 `server/db/schema.sql` (7 tablas con PK, FK, `CHECK` e índices de `PLAN.md` §4), `seed.sql` (14 artículos) y script `bun run db:reset` · Massimo · depende de: T-04
  - **Hecho cuando:** `bun run db:reset` en limpio crea 7 tablas y 14 artículos; `UPDATE usuarios SET fichas = -1` falla por `CHECK`; insertar dos veces el mismo artículo en `inventario` falla por PK. *Desbloquea a Hector (T-08).*
- [ ] T-14 · README con requisitos (Bun, Docker) y los 4 comandos para arrancar (borrador del manual de instalación) · Massimo · depende de: T-05
  - **Hecho cuando:** Nahum levanta el proyecto en su máquina solo con el README, sin preguntar.

---

## Hito 2 — sáb 3 oct: ronda completa con 3 jugadores + compra de fichas con límite

### Hector
- [ ] T-15 · Clases `Carta` y `Baraja` (4 mazos, Fisher–Yates con `crypto.getRandomValues`, rebarajar con < 25 %) con JSDoc · Hector · depende de: T-03
  - **Hecho cuando:** `bun test` verifica 208 cartas únicas por rebarajado y que `necesitaRebarajar()` se activa con 51 cartas restantes.
- [ ] T-16 · `Mano` (As 1/11, blanda, blackjack natural, pasada) y `Dealer` (pide ≤ 16, se planta en todo 17) · Hector · depende de: T-15
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
- [ ] T-27 · Componentes `Carta` (frente y reverso por CSS/SVG, sin imágenes externas), `Asiento` (avatar, nombre, apuesta, total, estado, desconectado) y `ManoDealer` · Nahum · depende de: T-12
  - **Hecho cuando:** en el mock se ven las 52 cartas y los 5 reversos del catálogo correctamente.
- [ ] T-28 · Pantalla de mesa: fase, cuenta regresiva a partir de `finEn`, fichas para apostar, botones Pedir/Plantarse habilitados **solo** en tu turno · Nahum · depende de: T-27, T-11 (mock) y T-18 (real)
  - **Hecho cuando:** con 3 pestañas reales, solo la pestaña con el turno tiene los botones activos y las 3 ven la carta repartida en < 1 s.
- [ ] T-29 · Resultado de ronda (overlay con ganó/perdió/empate y fichas) + avisos de error legibles a partir de `error.mensaje` · Nahum · depende de: T-28
  - **Hecho cuando:** al terminar la ronda cada jugador ve su resultado; forzar `pedir` fuera de turno desde consola muestra el aviso "No es tu turno".
- [ ] T-30 · Panel de billetera: dinero, fichas, "te quedan X fichas por comprar hoy, se reinicia a las 00:00", compra con botón deshabilitado mientras espera respuesta y `clave` nueva por clic · Nahum · depende de: T-24 (mock mientras tanto)
  - **Hecho cuando:** comprar 1,000 actualiza saldo y disponible; con el límite agotado, el botón muestra el motivo y la hora de reinicio.
- [ ] T-33 · Guion de exposición v1 (`docs/exposicion.md`): estructura, quién dice qué y tiempos (≈3 min cada uno), guion de la demo en vivo · Nahum · depende de: —
  - **Hecho cuando:** los 3 aprobaron el guion en el grupo y suma ≤ 9 min en papel.

### Massimo
- [ ] T-22 · 🔓 `server/src/db` (conexión `sql` de Bun, helper `enTransaccion`) + **interfaz `Billetera`** con JSDoc y firmas definitivas · Massimo · depende de: T-05
  - **Hecho cuando:** la interfaz está fusionada en `main` y Hector la importa para T-20 con una implementación falsa en memoria. *Desbloquea a Hector.*
- [ ] T-23 · `BilleteraSQL.debitarApuesta` / `acreditarPago` con `FOR UPDATE` + `movimientos` · Massimo · depende de: T-22
  - **Hecho cuando:** test: debitar más fichas de las que hay → `FICHAS_INSUFICIENTES` y ni `usuarios` ni `movimientos` cambian.
- [ ] T-24 · `fichas.comprar` con límite diario en CDMX, idempotencia por `clave` y mensaje `billetera` con `compradoHoy`, `disponibleHoy`, `reinicioEn` · Massimo · depende de: T-22
  - **Hecho cuando:** comprar 5,000 funciona; comprar 10 más → `LIMITE_DIARIO`; cambiar la fecha de los movimientos a "ayer" en SQL → se puede comprar otra vez; repetir la misma `clave` no cobra dos veces.
- [ ] T-25 · Tests de economía contra Postgres real: 10 compras de 1,000 en paralelo con límite 5,000 → exactamente 5 exitosas; doble `clave`; dinero insuficiente; cantidades 0, -10, 10.5, 15, 1e9 · Massimo · depende de: T-24
  - **Hecho cuando:** `bun test` en verde y la suma de `movimientos` de cada usuario de prueba coincide con su saldo final.
- [ ] T-31 · Integración Hito 2 en 3 laptops (coordina, los 3 participan); abrir issues por cada fallo · Massimo · depende de: T-20, T-21, T-28, T-24
  - **Hecho cuando:** **checkpoint Hito 2** — 3 personas en 3 laptops juegan 5 rondas seguidas sin errores, y cada una compra fichas respetando el límite.
- [ ] T-32 · `docs/arquitectura.md` v1: arquitectura, diagrama de clases, máquina de estados y ER (desde `PLAN.md`, actualizados a lo que realmente se construyó) · Massimo · depende de: T-18
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

### Nahum
- [ ] T-39 · Tienda: catálogo por tipo con precio, "poseído" y compra con confirmación · Nahum · depende de: T-34
  - **Hecho cuando:** comprar un artículo descuenta fichas, aparece como poseído y el botón ya no deja comprarlo otra vez.
- [ ] T-40 · Inventario y equipar; avatar y reverso de los demás visibles en la mesa; tema de mesa aplicado localmente · Nahum · depende de: T-35
  - **Hecho cuando:** A equipa `avatar_robot` en el lobby, entra a la mesa y B y C ven el robot en el asiento de A.
- [ ] T-41 · Historial de movimientos (tabla con tipo, cambio en fichas/dinero, saldo resultante, fecha en hora local; "ver más") · Nahum · depende de: T-34
  - **Hecho cuando:** tras comprar fichas, apostar y comprar un artículo, aparecen las 3 filas en orden con los saldos correctos.
- [ ] T-42 · Indicador de conexión propia (conectado / reconectando) y de jugadores desconectados en su asiento · Nahum · depende de: T-36
  - **Hecho cuando:** al apagar el Wi-Fi de una laptop, las otras dos ven a ese jugador como "desconectado" en < 2 s.

### Massimo
- [ ] T-34 · Backend de tienda: `tienda.catalogo`, `tienda.comprar` (`FOR UPDATE`, `YA_POSEIDO`, `FICHAS_INSUFICIENTES`), `inventario.listar`, `movimientos.listar` paginado · Massimo · depende de: T-23
  - **Hecho cuando:** test: dos compras simultáneas del mismo artículo → una exitosa y una `YA_POSEIDO`, cobrada una sola vez.
- [ ] T-35 · `inventario.equipar` con `BLOQUEADO_EN_MANO` (consulta a `GestorMesas`) y republicación del snapshot de la mesa · Massimo · depende de: T-34, T-18
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
- [ ] T-49 · `docs/manual-usuario.md` con capturas: registro, lobby, cómo jugar una ronda, comprar fichas, tienda, inventario, historial, qué pasa si te desconectas · Nahum · depende de: T-43
  - **Hecho cuando:** Hector (que no lo escribió) juega una ronda y compra un artículo siguiendo solo el manual.
- [ ] T-51 · Diapositivas (≤ 8, más imágenes que texto): problema, arquitectura, protocolo, juego, economía/transacciones, demo, cierre · Nahum · depende de: T-33
  - **Hecho cuando:** ninguna diapositiva tiene más de 25 palabras y las 3 personas las aprobaron.

### Massimo
- [ ] T-44 · Pasar **completa** la sección de Funcionamiento de `CHECKLIST_ENTREGA.md`; cada fallo → issue asignado · Massimo · depende de: T-43
  - **Hecho cuando:** todas las casillas de Funcionamiento están en `[x]` o tienen issue abierto con dueño y fecha.
- [ ] T-46 · JSDoc completo en `server/src/store`, `server/src/db` y `shared/` · Massimo · depende de: T-43
  - **Hecho cuando:** ninguna función exportada queda sin JSDoc (revisado por Hector).
- [ ] T-48 · `docs/manual-instalacion.md`: requisitos con versiones, clonar/descomprimir, `.env`, Docker, `db:reset`, `build`, `start`, cómo conectarse desde otra laptop, problemas comunes (puerto ocupado, firewall) · Massimo · depende de: T-38
  - **Hecho cuando:** Nahum instala desde cero en su laptop siguiendo solo el manual.
- [ ] T-50 · `docs/arquitectura.md` final: descripción de cada tabla + `schema.sql`/`seed.sql` referenciados, diagrama de clases, diagrama de dependencias, protocolo, máquina de estados, decisiones de diseño · Massimo · depende de: T-32, T-45
  - **Hecho cuando:** cubre los 3 puntos de la rúbrica (BD con scripts, clases, dependencias) y Hector confirma que coincide con el código.

---

## Hito 5 — mar 6 oct: exposición ensayada y `.zip` probado

- [ ] T-52 · Ensayo 1 cronometrado de la exposición con demo en vivo + retroalimentación · **Equipo** · depende de: T-51
  - **Hecho cuando:** duración anotada en `ESTADO.md`, lista de ajustes escrita.
- [ ] T-53 · Video de respaldo de la demo (≈3 min, 3 jugadores, ronda completa, compra de fichas, tienda) · Nahum · depende de: T-44
  - **Hecho cuando:** el video se reproduce desde USB y desde la nube sin internet de la escuela (descargado).
- [ ] T-54 · Script `bun run empaquetar` → `blackjack-equipo.zip` sin `node_modules`, `.env`, `dist` ni `.git`, con `docs/` y `README` · Massimo · depende de: T-48
  - **Hecho cuando:** el `.zip` pesa < 20 MB, abre con el descompresor del sistema y **no** es `.rar`.
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
