# T-37 — Endurecimiento WebSocket

6 de octubre de 2026, CDMX · Hector · Rama `t-37-endurecimiento-websocket`.

Implementación sobre T-36 (PR #37). PR #45 de T-37 abierto contra `main`, con solicitud de revisión a Nahum; pendiente aprobación y fusión. El avance aceptado de `main` permanece igual hasta fusionar este PR.

## Comportamiento

- Admite 20 mensajes por conexión en una ventana móvil de 1,000 ms, incluidos `ping`, binarios y mensajes inválidos. El control ocurre al recibir el frame, antes de la cola y de SQL.
- Una conexión mantiene como máximo 20 operaciones pendientes; las consultas lentas no generan una cola ilimitada. El exceso recibe `DEMASIADAS_SOLICITUDES`, sin cerrar la conexión ni consumir la cuota de otros sockets.
- Al vencer la ventana y liberarse capacidad, la conexión puede volver a enviar. La correlación del rechazo usa exclusivamente `ReqIdSchema` y texto de tamaño válido.
- `ERROR_INTERNO` conserva `reqId` sin revelar la excepción. El log añade conexión, usuario, mesa y tipo; no copia el frame. Fallos del logger o al enviar el error quedan aislados.
- Los handlers existentes rechazan las intenciones de espectadores con `NO_ESTAS_EN_MESA`, incluso después de esperar la cola. La prueba verifica cartas, turno, saldo SQL y movimientos.

Los límites están en `server/src/config.ts`. No se cambian tipos del protocolo, esquema SQL ni reglas de economía.

## Verificación reproducible

Con Bun 1.3.13 y PostgreSQL 16: `bun run typecheck` correcto y **372 pruebas aprobadas / 1 omitida / 4,682 aserciones**, cero fallos, en 39 archivos. Incluye diez rondas con cuatro bots y conciliación SQL.

Configurar `TEST_DATABASE_URL` y ejecutar desde la raíz:

```bash
bun run typecheck
bun test ./server/test ./client/test
bun test ./server/test/endurecimiento.test.ts
```

Los directorios explícitos evitan otros checkouts de `preparacion-hector/`. Las pruebas SQL crean y eliminan schemas aleatorios; no se reinician los datos del proyecto.

Nueve casos nuevos cubren la frontera del segundo, ventana móvil, frames inválidos, aislamiento por socket, correlación acotada, cola bloqueada, excepción async, logger defectuoso, ráfaga y espectador. El caso de ráfaga envía 1,000 mensajes basura en menos de 1 s: 20 reciben `MENSAJE_INVALIDO` y 980 `DEMASIADAS_SOLICITUDES`; tres conexiones autenticadas terminan una ronda dentro de ese mismo segundo, conservan sockets abiertos y guardan tres resultados en PostgreSQL.

## Revisión de código al finalizar

Autorrevisión del diff completo frente a AGENTS.md, PLAN y el criterio de T-37, realizada el 6 de octubre:

- Control de ritmo anterior a validación de sesión/SQL; ventana y cola acotadas, limpieza por cierre y orden conservado entre intenciones del mismo socket.
- Errores de dominio compartidos, `reqId` validado y contexto del servidor; sin tipos duplicados del protocolo ni `any` nuevo.
- Autoridad del asiento comprobada antes y después de esperar; la espectadora no cambia la mano ni genera débitos.
- Constantes, cabeceras y documentación del enrutador conformes; no se modifica `shared/`, `store/`, el esquema ni el cliente.
- Se corrigieron una expectativa con el código de error mal escrito y el conteo de movimientos de la prueba para descontar las apuestas de una ronda anterior.

Resultado: sin hallazgos pendientes en la autorrevisión. La aprobación requerida de otro desarrollador corresponde al PR posterior.
