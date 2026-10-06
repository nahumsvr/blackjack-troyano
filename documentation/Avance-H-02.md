# Avance de Hector — autenticación del Hito 1

Fecha: 2026-10-05 CDMX. Base: `origin/main` con PR #18 (T-07) y PR #16 (tienda mock) fusionados.

T-07 ya cumple sus ataques de aceptación y está fusionada. T-08 implementa registro/login/reanudar/logout con PostgreSQL 16: Argon2id, tokens aleatorios de 32 bytes y siete días de vigencia. El registro confirma usuario, $10,000, 500 fichas, tres artículos gratuitos poseídos/equipados, movimiento y sesión en una transacción. Los errores de usuario repetido, contraseña incorrecta, token vencido o revocado llegan por el contrato existente; los hashes nunca viajan al cliente.

Las nueve pruebas nuevas usan PostgreSQL y WebSocket reales. Cubren recuperación con el mismo token tras cerrar la conexión y reiniciar el servidor, concurrencia de registros, orden de mensajes por socket, revocación en otra conexión y rollback de todas las escrituras ante un fallo SQL tardío. Se conecta también `billetera.consultar`, que el lobby de Nahum solicita al entrar.

Validación inicial: `bun run typecheck` correcto y `bun test` con `TEST_DATABASE_URL` → 202 pruebas, 0 fallos y ninguna omitida, Bun 1.3.13 / PostgreSQL 16.15. Las pruebas crean y eliminan esquemas propios. En Windows se capturan primero los rechazos SQL antes de las aserciones: el matcher async `.rejects` de Bun bloqueaba las transacciones en las pruebas existentes de economía. Se conservan los mismos códigos, saldos y verificaciones; la lógica de economía no cambia. Massimo debe revisar ese ajuste de pruebas en el PR.

Docker Desktop se recuperó renombrando únicamente sus directorios temporales de sockets con respaldo. El contenedor de pruebas `blackjack-hito1-postgres-1` usa puerto 55432 y una base aislada. No se aplicó restablecimiento de fábrica ni se eliminaron volúmenes.

Tras incorporar PR #16, la suite completa pasa con 203 pruebas y 0 fallos/omisiones. PR #17 solo añade el guion y seguimiento documental; se conserva en la base. T-08 publicada en [PR #19](https://github.com/nahumsvr/blackjack-troyano/pull/19).

Pendientes del hito: T-09 (asientos y publicaciones del lobby); prueba visual de T-06 y checkpoint de T-13 con tres pestañas del cliente. T-08 permanece sin marcar hasta revisión y fusión en main.
