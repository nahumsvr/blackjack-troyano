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

## Aceptación

Después de la corrección, el usuario confirmó que la prueba solicitada funcionó desde dos dispositivos distintos y autorizó enviar el PR. Code review final del diff realizado sin hallazgos pendientes. T-38 mantiene su casilla abierta hasta la fusión del PR.

## Comentarios de PR #46 atendidos (2026-10-06)

- Prueba pura `client/test/identificadores.test.ts`: 256 UUID únicos con formato v4 y reqId aceptado por shared, con `randomUUID` ausente; ejecutada sin PostgreSQL.
- Integración trasladada a `server/test/lanHttpReal.test.ts`; el proceso cliente conserva su helper sin importar internos del servidor. Cantidad mínima, saldos iniciales, tasa y cantidad de mesas se derivan de configuración.
- `verificar:produccion` recorre todos los archivos de `client/dist/assets`, comprueba MIME, caché correspondiente al nombre y hash. Regresiones cubren un SVG no referenciado, su alteración remota y ausencia del build local.
- README y evidencia aclaran que el comando se ejecuta en la máquina servidor, desde la copia que generó el build. El despliegue actual sirve desde la raíz del origen HTTP, como exige PLAN §1.
- TAREAS y ESTADO conservan un estado vigente: aceptación LAN completada, pendiente aprobación/fusión; no se cierra la casilla de T-38 antes de la fusión.
- Verificación del diff corregido: `bun run build` correcto; suite de servidor/cliente con PostgreSQL y Bun 1.3.13: 368 pruebas correctas, 0 fallos y 1 omitida por enlaces a archivo en Windows.
