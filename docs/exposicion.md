# Guion de exposición — Blackjack multijugador (v1)

> **Borrador v1 (T-33).** Los bloques de arquitectura y juego (Hector) y de protocolo y economía (Massimo) son un primer texto: cada uno lo ajusta en el PR con sus palabras. Se considera aprobado cuando los 3 lo aprueben en el grupo.

## 1. Resumen y reglas

- **Duración objetivo: 9:00** (la rúbrica pide < 10 min; deja 1 min de margen para preguntas o imprevistos).
- **Hablan los 3**, con partes claras. Reparto aproximado: Nahum 2:30 · Hector 3:30 · Massimo 3:00.
- **Nadie lee las diapositivas.** Máximo 25 palabras por diapositiva; el detalle va en lo que se dice, no en la pantalla.
- **Proyector:** laptop de Nahum (laptop A). Nahum cambia las diapositivas y conduce la demo; quien habla le pide "siguiente".
- Laptops de la demo: **A = Nahum** (proyectada), **B = Hector**, **C = Massimo**.

## 2. Bloques

| Inicio | Bloque | Quién | Dura | Diapositiva | Idea clave |
|---|---|---|---|---|---|
| 0:00 | Problema y objetivo | Nahum | 0:45 | 1 · Título y equipo | Blackjack para varios jugadores en tiempo real, con economía simulada y sin trampas posibles desde el cliente. |
| 0:45 | Arquitectura | Hector | 1:30 | 2 · Diagrama cliente–servidor–BD | Bun + WebSocket nativo con pub/sub (un topic por mesa). El servidor es la única fuente de verdad: el cliente solo envía intenciones y dibuja lo que recibe. Las partidas viven en memoria; Postgres guarda solo lo persistente (usuarios, dinero, compras, historial). |
| 2:15 | Protocolo y validación | Massimo | 1:00 | 3 · Ejemplo de mensaje | Los mensajes son uniones discriminadas por `type` en `shared/`, con esquemas Zod que usan cliente y servidor. Todo mensaje se valida al entrar; si es inválido responde `error` con código, y nada tumba el servidor. |
| 3:15 | Juego | Hector | 1:15 | 4 · Máquina de estados | Fases de la mesa (apuestas → reparto → turnos → dealer → pagos). Relojes del servidor (`finEn`), un solo temporizador por mesa. La carta oculta del dealer no viaja al cliente hasta la fase `DEALER`. |
| 4:30 | Economía | Massimo | 1:15 | 5 · Transacción de compra | Cada operación de dinero va en una transacción con `SELECT … FOR UPDATE` y un registro en el libro `movimientos` (solo inserciones). Dinero y fichas son enteros. Límite diario de 5,000 fichas (reinicio 00:00 CDMX) y clave idempotente para no cobrar doble. |
| 5:45 | Demo en vivo | Nahum conduce, los 3 con laptop | 2:45 | 6 · "Demo" | Ver §3. |
| 8:30 | Cierre y lecciones | Nahum | 0:30 | 7 · Lecciones | Qué aprendimos: validar todo en el servidor, diseñar el protocolo primero y trabajar en paralelo con un mock. |
| **9:00** | **Fin** | | **9:00** | | |

## 3. Guion de la demo (2:45)

Antes de empezar: servidor y BD arriba, las 3 laptops con la app abierta en la pantalla de acceso y DevTools → pestaña **Red** (WS) lista en la laptop A.

| # | Paso | Quién hace / quién narra | Dura | Si falta tiempo |
|---|---|---|---|---|
| 1 | **Registro y login de 3 usuarios.** A registra un usuario nuevo en vivo; B y C entran con usuarios de demo ya creados. | Los 3 hacen · Nahum narra | 0:20 | B y C ya entraron antes de pasar. |
| 2 | **Lobby con ocupación en vivo y sentarse en `mesa-1`.** A se sienta y en B y C se ve cambiar la ocupación; luego B y C se sientan. | Los 3 hacen · Nahum narra | 0:15 | — |
| 3 | **Apuestas.** Cada uno apuesta con las fichas; la cuenta regresiva viene del servidor. | Los 3 hacen · Hector narra | 0:15 | — |
| 4 | **Reparto con carta oculta.** En la pestaña Red de A se muestra el `mesa.estado`: la segunda carta del dealer llega como `{oculta:true}`. | Nahum muestra y narra | 0:20 | Mostrar solo la carta tapada en pantalla. |
| 5 | **Turnos.** Solo quien tiene el turno ve Pedir/Plantarse activos; los demás los ven deshabilitados. | Los 3 juegan · Hector narra | 0:15 | Todos se plantan de inmediato. |
| 6 | **Dealer y resultado.** El dealer descubre su carta y pide hasta 17; aparece el resultado y el saldo se actualiza. | Hector narra | 0:15 | — |
| 7 | **Compra de fichas y límite agotado.** C abre la billetera, compra fichas y luego intenta pasar del límite diario: el servidor responde `LIMITE_DIARIO`. | Massimo hace y narra | 0:30 | Usar un usuario de demo que ya tenga el límite casi agotado. |
| 8 | **Tienda.** En el menú lateral, pestaña Tienda: catálogo por tipo, precios y artículos poseídos. | Massimo hace y narra | 0:15 | **Saltar.** |
| 9 | **Desconexión y reconexión.** B apaga el Wi-Fi: su asiento aparece desconectado en A y C; al volver, B se reconecta solo y regresa a la mesa con la misma sesión. | Hector hace · Nahum narra | 0:20 | — |

Si el servidor real no está listo, la demo se hace en una laptop con `?mock=1`: se recorren las 6 fases con la barra del mock, la billetera, la tienda y la caída simulada.

## 4. Plan B (PLAN §9)

1. **Red de la escuela bloqueada** (las laptops no se ven) → hotspot del celular de Nahum; las 3 laptops se conectan a él y usan la IP de la laptop A.
2. **Falla el hotspot** → 3 ventanas en la laptop A, proyectadas, cada una con su usuario.
3. **Falla todo lo anterior** → video de respaldo (T-53) desde la USB.
4. **El servidor real no está listo** → demo con `?mock=1` (ver §3).

## 5. Preguntas probables

| Pregunta | Responde | Respuesta |
|---|---|---|
| ¿Por qué WebSocket? | Hector | Necesitamos que el servidor avise a todos los jugadores al instante (turnos, cartas, cuenta regresiva). Con WebSocket la conexión queda abierta en ambos sentidos y el pub/sub de Bun publica cada cambio a toda la mesa a la vez, sin hacer polling. |
| ¿Qué pasa si dos compran a la vez? | Massimo | Cada compra es una transacción que bloquea la fila del usuario con `FOR UPDATE`, así que la segunda espera a la primera y ve el saldo ya actualizado. Además, la BD no permite saldos negativos y la clave idempotente evita cobrar dos veces el mismo clic. |
| ¿Cómo evitan trampas? | Hector | El cliente solo envía intenciones; el servidor valida con Zod cada mensaje y verifica turno, fase y saldo. La baraja y la carta oculta solo existen en el servidor, y también hay un límite de 20 mensajes por segundo. |
| ¿Qué pasa si alguien se desconecta? | Nahum | El cliente se reconecta solo (1, 2, 4… hasta 10 s) y recupera la sesión con su token. En el servidor el asiento se guarda 60 s; si le toca turno mientras está fuera, se planta automáticamente. |

## 6. Checklist previo (30 min antes)

- [ ] Las 3 laptops cargadas y con cargador.
- [ ] `docker compose up -d` y servidor arriba (`bun run start`) en la laptop A; las otras abren `http://<IP de A>:3000`.
- [ ] Usuarios de demo creados (`bun run db:reset` + 2 usuarios para B y C; uno con el límite diario casi agotado para el paso 7).
- [ ] DevTools → Red (WS) lista en la laptop A.
- [ ] Hotspot del celular probado y video de respaldo (T-53) en la USB.
- [ ] Diapositivas abiertas en la laptop A, en modo presentación.
