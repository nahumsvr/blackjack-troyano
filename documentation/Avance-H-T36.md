# T-36 — Desconexión y recuperación de asiento

6 de octubre de 2026, CDMX · Hector · Rama `t-36-desconexion-reconexion` · [PR #37](https://github.com/nahumsvr/blackjack-troyano/pull/37), en borrador.

La rama integra el motor, relojes, acciones y liquidación disponibles en #29–#33, la corrección de espectadores de #22 y el seguimiento de `main`. Esas dependencias deben fusionarse antes de aceptar T-36 en `main`.

## Comportamiento

- Cerrar el socket del dueño publica `conectado=false` y lo planta inmediatamente si tenía el turno; si su turno llega después, se planta al llegar.
- El servidor reserva el asiento por `RESERVA_ASIENTO_MS = 60_000`, definido en `config.ts`. `reanudar` recupera asiento, cartas, apuesta y saldo confirmado; no devuelve un turno ya terminado ni modifica el plazo del jugador siguiente.
- Sin apuesta ni débito en vuelo, el asiento se libera exactamente al vencer la reserva. Con una apuesta, se conserva hasta terminar PAGOS. Una desconexión durante un débito retiene el asiento hasta que SQL confirme o rechace la operación.
- Otra pestaña autenticada toma la propiedad; la anterior conserva snapshots y sus intenciones de juego reciben `NO_ESTAS_EN_MESA`. Su salida/cierre no afecta a la nueva dueña.
- `logout` y sesión revocada/caducada producen salida explícita. El cierre del transporte conserva la reserva; sus dos hooks de limpieza no renuevan el plazo.
- `RelojMesa` comparte un solo timeout entre la fase y todas las reservas. `finEn` sigue describiendo la fase; cancelar/reconectar invalida callbacks antiguos y detener cancela todos los vencimientos.

No se modifica el protocolo, el esquema SQL ni la economía. La carta oculta sigue siendo `{oculta:true}` hasta DEALER/PAGOS. El servidor conserva toda la autoridad sobre asientos, turnos y saldos.

## Verificación reproducible

Comprobado con Bun 1.3.13 y PostgreSQL 16.15: `bun run typecheck` correcto y **357 pruebas / 4,564 aserciones**, cero fallos u omisiones, en 38 archivos. Incluye diez rondas con cuatro bots, 40 resultados persistidos y conciliación del libro contable.

Configurar `TEST_DATABASE_URL` para PostgreSQL 16 y ejecutar desde la raíz:

```bash
bun run typecheck
bun test ./server/test ./client/test
```

Los directorios explícitos evitan recorrer los otros checkouts existentes en `preparacion-hector/`. Las pruebas SQL crean schemas aleatorios y los eliminan al terminar; no se usa `db:reset`.

`server/test/desconexion.test.ts` agrega 12 casos: turno actual/futuro, apuesta previa o ausente, reserva exacta de 60 s, vencimiento durante una mano, reconexión y callback antiguo, varias reservas/apagado, propiedad/índice de mesas, débito pendiente confirmado o rechazado y dos recorridos con tres sockets y PostgreSQL reales. El cierre en turno tiene una aserción de menos de 1 s; la recuperación contrasta mano y saldo con SQL y continúa hasta guardar tres resultados de ronda.

La aceptación visual y de Wi-Fi con tres laptops de T-42/T-31 y la revisión final por otro integrante siguen pendientes. T-36 se registra como implementada y conserva su casilla abierta hasta revisión y fusión.
