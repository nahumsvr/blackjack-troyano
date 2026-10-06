# Avance de Hector — autenticación y mesas del Hito 1

Fecha: 2026-10-05 CDMX. Base: `origin/main` con PR #18 (T-07) y PR #16 (tienda mock) fusionados.

T-07 ya cumple sus ataques de aceptación y está fusionada. T-08 implementa registro/login/reanudar/logout con PostgreSQL 16: Argon2id, tokens aleatorios de 32 bytes y siete días de vigencia. El registro confirma usuario, $10,000, 500 fichas, tres artículos gratuitos poseídos/equipados, movimiento y sesión en una transacción. Los errores de usuario repetido, contraseña incorrecta, token vencido o revocado llegan por el contrato existente; los hashes nunca viajan al cliente.

Las nueve pruebas nuevas usan PostgreSQL y WebSocket reales. Cubren recuperación con el mismo token tras cerrar la conexión y reiniciar el servidor, concurrencia de registros, orden de mensajes por socket, revocación en otra conexión y rollback de todas las escrituras ante un fallo SQL tardío. Se conecta también `billetera.consultar`, que el lobby de Nahum solicita al entrar.

Validación inicial: `bun run typecheck` correcto y `bun test` con `TEST_DATABASE_URL` → 202 pruebas, 0 fallos y ninguna omitida, Bun 1.3.13 / PostgreSQL 16.15. Las pruebas crean y eliminan esquemas propios. En Windows se capturan primero los rechazos SQL antes de las aserciones: el matcher async `.rejects` de Bun bloqueaba las transacciones en las pruebas existentes de economía. Se conservan los mismos códigos, saldos y verificaciones; la lógica de economía no cambia. Massimo debe revisar ese ajuste de pruebas en el PR.

Docker Desktop se recuperó renombrando únicamente sus directorios temporales de sockets con respaldo. El contenedor de pruebas `blackjack-hito1-postgres-1` usa puerto 55432 y una base aislada. No se aplicó restablecimiento de fábrica ni se eliminaron volúmenes.

Tras incorporar PR #16, la suite completa pasa con 203 pruebas y 0 fallos/omisiones. PR #17 solo añade el guion y seguimiento documental; se conserva en la base. T-08 publicada en [PR #19](https://github.com/nahumsvr/blackjack-troyano/pull/19).

T-08 aprobada y fusionada en main como PR #19 (`831dcd2`); su casilla ya cuenta como hecha.

## T-09 — mesas y ocupación

`GestorMesas` mantiene las tres mesas de config y cinco asientos por mesa. El servidor decide identidad y cosméticos desde la sesión SQL, publica `lobby` y `mesa.estado` sin reqId y correlaciona la respuesta directa. Un usuario ocupa un asiento y una conexión lo controla; una nueva pestaña toma ese asiento y la anterior conserva snapshots, con salida rechazada como `NO_ESTAS_EN_MESA`. Cerrar la pestaña antigua nunca libera el asiento del nuevo dueño. Logout, cierre y sesión inválida limpian el asiento y la suscripción antes de borrar identidad.

Ocho pruebas de mesas cubren snapshots sin alias mutable, tres usuarios/lista/ocupación en < 1 s, seis uniones simultáneas (cinco asientos + un `MESA_LLENA`), mesa inexistente, acceso sin sesión, asiento único, espectadores y limpieza. Un ensayo adicional importa `Conexion`, `ControladorJuego` y el reductor reales del cliente: tres sesiones ven ocupación y recuperan automáticamente los mismos tokens e identidades al reiniciar el servidor. No se cambian módulos del cliente, shared, tienda o esquema SQL.

Validación final: **212 pruebas, 0 fallos y 0 omisiones**, `bun run typecheck` en todos los paquetes/scripts y build Vite correctos. El arranque real con `bun run dev` sirve HTTP 200 en :5173; tres conexiones por el proxy de Vite verifican registro, lobby, unión, publicación y salida. Se creó `.env` local ignorado por Git, apuntando al contenedor aislado de esta sesión; se inicializó exclusivamente su `public` vacío, sin borrar datos. `docker compose up -d --wait` y `bun run dev` usan ahora ese entorno local.

La mesa permanece en ESPERANDO y no maneja apuestas ni rondas. La reserva del asiento por 60 s durante una partida corresponde a T-36; en Hito 1 un cierre libera el asiento. T-18 añadirá el motor de cada mesa sin importar store desde game.

T-09 publicada en [PR #22](https://github.com/nahumsvr/blackjack-troyano/pull/22). Se revisaron los nuevos PR #20 (empaquetado, sin solapamiento de lógica) y #21 (economía WS). #21 modifica auth/arranque/close de WS: al integrar ambos se debe conservar su cola por token, suscripciones de usuario y handlers de economía junto con los hooks de mesas de #22. Si #21 se fusiona primero, actualizar #22 sobre main, componer `crearManejadoresEconomia` en `iniciarAplicacion` y volver a verificar las suites de economía/auth/mesas; no sustituir un arranque por el otro. No hay cambios de contrato/esquema en #21.

Pendientes del hito: revisión/fusión de T-09; prueba visual de T-06 y checkpoint de T-13 con tres pestañas. La automatización del navegador no estuvo disponible por el fallo de ACL ya registrado; la evidencia automatizada del cliente y sockets no se presenta como verificación visual. Para Hito 2, el siguiente trabajo de Hector es T-15/T-16/T-17 y después T-18; no se implementó en esta sesión.
