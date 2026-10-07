# X-1 · Doblar apuesta — revisión local

Fecha: 2026-10-07 · Responsable: Hector (asistido por Codex).
Rama: `extras-x1-x5`, base `origin/main` en `6b047e0`.

## Resultado

Implementación y revisión local completas. No sustituye la aprobación de otro dev.
El PR conjunto se abrirá al integrar X-2…X-5; Massimo revisará el contrato y la
economía, y Nahum el cliente. X-1 conserva su casilla abierta hasta esa integración.

## Comportamiento revisado

- `doblar` acepta únicamente `type` y `reqId` opcional; usuario y cantidad vienen del servidor.
- Valida propietario tras la cola, fase, plazo, turno, conexión, dos cartas y saldo.
- Cobra otra apuesta igual usando la transacción existente con `FOR UPDATE` y movimiento `apuesta`.
- Da una carta, planta o marca PASADO y avanza; doble clic cobra una vez.
- Admite total 1,000 al doblar 500, sin ampliar el límite de apuesta inicial.
- Victoria/empate/pérdida y blackjack del dealer usan el total doblado; tres cartas nunca son natural.
- Historial y resultado público conservan apuesta y pago completos; dealer sigue oculto hasta DEALER.
- Corrige la carrera de salir/desconectar durante SQL: no avanza hasta resolver el débito.
- Si el cobro falla después de desconectar, planta la apuesta original.
- El reloj comparte cola y conserva un único timeout; un vencimiento viejo no salta el siguiente turno.
- El cliente bloquea acciones mientras doblar está pendiente y solo envía la intención.
- El mock reproduce el segundo débito y la terminación del turno.

## Verificación

- `bun run typecheck`: correcto en shared, servidor, cliente y scripts.
- `TEST_DATABASE_URL=… bun test ./server/test ./client/test`: **399 correctas, 1 omitida, 0 fallos**;
  5,424 aserciones, 43 archivos, Bun 1.3.13 y PostgreSQL de pruebas.
- La omisión corresponde a enlaces simbólicos de archivo en Windows.
- Prueba WS/SQL X-1: tres jugadores, traspaso de propietario, dos solicitudes de doblar,
  dos movimientos de -500, pago +2,000 e historial con apuesta 1,000.
- `git diff --check`: correcto.
- Build independiente y revisión visual del botón no verificados en esta sesión;
  la solicitud de ejecución de `bun run build` fuera del sandbox fue rechazada.

Cambios de protocolo a declarar en el PR: nueva intención `doblar` y error
`NO_PUEDES_DOBLAR`. No cambia el esquema SQL ni los campos del snapshot.
