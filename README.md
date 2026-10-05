# Blackjack Troyano

Proyecto de blackjack multijugador en desarrollo. La meta es que varias personas jueguen en mesas compartidas desde el navegador, con un servidor que controle las partidas y una economía de fichas simuladas. El alcance previsto incluye registro, lobby, rondas de blackjack, billetera, tienda e inventario.

## Estado actual

El repositorio ya tiene un monorepo con **Bun workspaces** (`server`, `client` y `shared`) y un servidor WebSocket básico. Al conectarse a `ws://localhost:3000/ws`, el servidor envía a todas las conexiones del lobby un mensaje con el número de sockets abiertos:

```json
{"type":"bienvenida","conectados":1}
```

El conteo se actualiza cuando alguien se conecta o desconecta. Por ahora, `client` y `shared` son estructuras iniciales: todavía no hay interfaz React, validación de mensajes, autenticación, base de datos ni partidas. La ruta HTTP `/` tampoco sirve una aplicación; responde `404`.

## Requisitos y arranque

- [Bun](https://bun.sh/) 1.3.13 (versión indicada en `package.json`).

Desde la raíz del repositorio:

```bash
bun install
bun run dev
```

`bun run dev` inicia el servidor en `0.0.0.0:3000` y la entrada provisional del cliente. La entrada del cliente solo imprime un mensaje en la consola; aún no abre una página web. Para detener ambos procesos, usa `Ctrl+C`.

Para comprobar el WebSocket manualmente, abre [`scripts/verificar-ws.html`](scripts/verificar-ws.html) como archivo local en tres pestañas y pulsa **Conectar** en cada una. Deja `127.0.0.1:3000` como servidor si haces la prueba en la misma computadora, o escribe la IP de la computadora que ejecuta Bun si pruebas desde otra en la misma red. Las tres pestañas deben mostrar `Conectados: 3`; al cerrar una, las otras deben mostrar `Conectados: 2`.

## Verificaciones

```bash
bun run typecheck
bun run test
```

Las pruebas actuales cubren el conteo de conexiones WebSocket y las respuestas HTTP de `/ws` y de una ruta inexistente.

## Organización

| Ruta | Función actual |
| --- | --- |
| `server/` | Servidor Bun con endpoint `/ws` y pruebas del transporte. |
| `client/` | Entrada provisional del futuro cliente. |
| `shared/` | Paquete compartido inicial; los esquemas y tipos del protocolo están pendientes. |
| `scripts/` | Arranque simultáneo de los workspaces y página de verificación manual. |

El diseño previsto y las tareas pendientes están en [`PLAN.md`](documentation/PLAN.md) y [`TAREAS.md`](documentation/TAREAS.md). [`ESTADO.md`](documentation/ESTADO.md) registra el avance del equipo.
