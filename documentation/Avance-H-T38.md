# T-38: producción y registro desde la LAN

## Cambios

- Revisado el servidor estático integrado en `main` por PR #24/#22: `client/dist`, GET/HEAD, rutas confinadas al build, MIME, caché y `/ws` en el puerto 3000.
- Corregido el registro por HTTP en una IP: `crypto.randomUUID` no está disponible en ese contexto. Un helper criptográfico genera UUID v4 para peticiones, compras y rondas del mock sin cambiar protocolo ni esquema SQL.
- Añadida una regresión aislada del cliente sin `randomUUID`, con registro y dos compras contra servidor y PostgreSQL reales.
- Añadido `verificar:produccion` para comprobar el build servido y una ronda real con tres bots; evidencia en `docs/evidencia/t38/`.

## Comprobaciones y code review

- `bun run build`: correcto; JavaScript `index-BLieM9lE.js`.
- `bun run typecheck`: correcto en shared, servidor, cliente y scripts.
- `bun run start`: servidor real en `0.0.0.0:3000`.
- Suite de servidor/cliente con PostgreSQL: 364 correctas, 0 fallos, 1 omitida por enlaces a archivo en Windows; regresión individual repetida: 1 correcta.
- Verificación por `http://192.168.100.6:3000`: HTML y assets correctos; tres bots completan la misma ronda.
- Code review: UUID conserva versión/variante y aleatoriedad criptográfica; reqId y claves cumplen Zod; dos compras generan dos movimientos distintos; no quedan llamadas a `randomUUID` en el cliente. Sin hallazgos pendientes en los cambios revisados. La carpeta `client/` requiere revisión de Nahum en el PR.

## Aceptación pendiente

El usuario confirmó acceso a la página desde dos dispositivos y reportó el fallo de registro que motivó esta corrección. Falta confirmar registro y ronda desde el otro dispositivo después de recargar. T-38 mantiene su casilla abierta hasta aceptación y fusión del PR.
