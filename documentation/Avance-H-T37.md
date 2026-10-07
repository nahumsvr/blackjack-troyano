# T-37 — Endurecimiento WebSocket

6 de octubre de 2026, CDMX · Hector · Rama `t-37-endurecimiento-websocket`.

Implementación sobre T-36 (PR #37). PR #45 de T-37 abierto contra `main`, con solicitud de revisión a Nahum; pendiente aprobación y fusión. El avance aceptado de `main` permanece igual hasta fusionar este PR.

## Comportamiento

- Admite 20 mensajes por conexión en una ventana móvil de 1,000 ms, incluidos `ping`, binarios y mensajes inválidos. El control ocurre al recibir el frame, antes de la cola y de SQL.
- Una conexión mantiene como máximo 20 operaciones pendientes; las consultas lentas no generan una cola ilimitada. El exceso recibe `DEMASIADAS_SOLICITUDES`; después de 40 rechazos consecutivos se bloquea y cierra (1008), acotando parseo y respuestas. La admisión normal reinicia los rechazos.
- Registro/login comparten un presupuesto global de 20 accesos por ventana y cuatro operaciones simultáneas. Abrir sockets no multiplica la cuota de hash/verify; una operación conserva su plaza hasta terminar aunque su socket cierre.
- Quince segundos sin completar operaciones cierran el transporte. No se cancela ni se repite un commit en curso; los frames que esperan en la cola cerrada no ejecutan sus handlers.
- Al vencer la ventana y liberarse capacidad, la conexión puede volver a enviar. La correlación del rechazo usa exclusivamente `ReqIdSchema` y texto de tamaño válido.
- `ERROR_INTERNO` conserva `reqId` sin revelar la excepción. El log añade conexión, usuario, mesa y tipo; no copia el frame. Fallos del logger o al enviar el error quedan aislados.
- Los handlers existentes rechazan las intenciones de espectadores con `NO_ESTAS_EN_MESA`, incluso después de esperar la cola. La prueba verifica cartas, turno, saldo SQL y movimientos.

Los límites están en `server/src/config.ts`. `extraerReqId` de shared centraliza la correlación; requiere revisión de Massimo. No se cambian esquemas del protocolo, esquema SQL ni reglas de economía.

## Verificación reproducible

Validación anterior a la revisión de Massimo: con Bun 1.3.13 y PostgreSQL 16, typecheck y 372 pruebas aprobadas / 1 omitida / 4,682 aserciones, cero fallos. La validación actualizada se registra al final.

Configurar `TEST_DATABASE_URL` y ejecutar desde la raíz:

```bash
bun run typecheck
bun test ./server/test ./client/test
bun test ./server/test/endurecimiento.test.ts
```

Los directorios explícitos evitan otros checkouts de `preparacion-hector/`. Las pruebas SQL crean y eliminan schemas aleatorios; no se reinician los datos del proyecto.

Las fronteras de cuota se prueban con reloj manual. La integración envía 1,000 mensajes basura, comprueba rechazo y cierre del abusivo mientras tres jugadores terminan la ronda y guardan resultados SQL. No exige cantidades exactas de admisiones ni una ronda SQL en <1 s: esos resultados dependen de la velocidad de la máquina. La duración observada es evidencia de rendimiento, no una aserción determinista.

## Revisión de código al finalizar

Autorrevisión del diff completo frente a AGENTS.md, PLAN y el criterio de T-37, realizada el 6 de octubre:

- Control de ritmo anterior a validación de sesión/SQL; ventana y cola acotadas, limpieza por cierre y orden conservado entre intenciones del mismo socket.
- Errores de dominio compartidos, `reqId` validado y contexto del servidor; sin tipos duplicados del protocolo ni `any` nuevo.
- Autoridad del asiento comprobada antes y después de esperar; la espectadora no cambia la mano ni genera débitos.
- Constantes, cabeceras y documentación del enrutador conformes; el helper de correlación vive en shared. No se modifica store, el esquema ni el cliente.
- Se corrigieron una expectativa con el código de error mal escrito y el conteo de movimientos de la prueba para descontar las apuestas de una ronda anterior.

Resultado: sin hallazgos pendientes en la autorrevisión. La aprobación requerida de otro desarrollador corresponde al PR posterior.

## Revisión de Massimo atendida — 6 oct

| Comentario | Resolución |
|---|---|
| Más sockets multiplican los hashes | Cuota y concurrencia globales antes del handler; pruebas con conexiones independientes. |
| Parseo/respuestas ilimitadas tras saturar | Cierre tras cuarenta rechazos; después de bloquear no se parsean más frames. |
| Prueba sensible al reloj y SQL | Cuotas con reloj inyectado; integración verifica progreso y resultados sin umbral de reloj de pared. |
| Cola colgada bloquea para siempre | Watchdog cierra sin liberar artificialmente la operación en vuelo; prueba de cierre y cola descartada. |
| Extracción duplicada de reqId | Helper compartido con pruebas de entradas inválidas, frontera y reqId vacío. |
| `filter` asigna en cada frame | Retirada de timestamps vencidos con `shift`, arreglo acotado. |
| Constantes sin intención explícita | Comentarios propios y límite de pendientes independiente de la cuota. |
| Casilla T-37 abierta | Marcada como hecha con PR #45 al cumplir el criterio y terminar las correcciones, conforme a la instrucción de cierre de tarea. La aprobación/fusión sigue pendiente y no se atribuye a main avance aún no integrado. |

Se detectó y reprodujo un fallo de Bun 1.3.13: después de un cierre iniciado por el servidor,
`pendingWebSockets` conserva un contador obsoleto aunque ambos callbacks hayan terminado.
El apagado espera los hooks reales y las peticiones HTTP pendientes. La aplicación sigue
esperando al gestor para liquidar antes de cerrar SQL. La limpieza de las pruebas de abuso
y watchdog comprueba que el apagado vuelve a terminar.

Validación actualizada: typecheck correcto; suite completa **377 correctas, 1 omitida,
0 fallos, 4,734 aserciones en 39 archivos**, con Bun 1.3.13 y PostgreSQL. Después de
inyectar el reloj también en la integración, 80 pruebas de endurecimiento, protocolo,
mesas, transporte y producción correctas. El caso SQL de ráfaga y ronda tardó 297 ms
en esa ejecución; es una observación de esta máquina, no una garantía temporal universal.
Code review local: sin hallazgos pendientes tras revisar cuotas, callbacks, timers,
operaciones tardías y apagado. El registro de seis usuarios del test de asientos ahora
se prepara secuencialmente; las seis intenciones de unirse siguen compitiendo simultáneamente.
