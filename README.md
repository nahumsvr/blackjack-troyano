# Blackjack Troyano

Proyecto de blackjack multijugador en desarrollo. La meta es que varias personas jueguen en mesas compartidas desde el navegador, con un servidor que controle las partidas y una economía de fichas simuladas. El alcance previsto incluye registro, lobby, rondas de blackjack, billetera, tienda e inventario.

## Estado actual

El repositorio ya tiene un monorepo con **Bun workspaces** (`server`, `client` y `shared`) y un servidor WebSocket básico. Al conectarse a `ws://localhost:3000/ws`, el servidor envía a todas las conexiones del lobby un mensaje con el número de sockets abiertos:

```json
{"type":"bienvenida","conectados":1}
```

El conteo se actualiza cuando alguien se conecta o desconecta. El proyecto incluye el contrato Zod compartido, PostgreSQL con esquema y catálogo inicial, y módulos de economía que se prueban directamente contra la base. Su integración con el enrutador WebSocket está pendiente. Todavía no hay interfaz React, autenticación ni partidas. La ruta HTTP `/` responde `404`.

## Requisitos y arranque

- [Bun](https://bun.sh/) 1.3.13 (versión indicada en `package.json`).
- Docker Engine con Docker Compose v2 o compatible; la base usa PostgreSQL 16.
- `psql` es opcional para inspeccionar la base desde el equipo anfitrión.

- `zip` y `unzip` para generar y verificar el archivo de entrega.

Desde la raíz del repositorio:

```bash
cp .env.example .env
docker compose up -d --wait
bun install
bun run db:reset
bun run dev
```

Después de copiar `.env`, los cuatro comandos levantan la base, instalan dependencias, cargan el esquema y arrancan desarrollo. **`db:reset` borra los datos del proyecto**: muestra el destino y exige escribir el nombre de la base (`blackjack` por defecto). Para automatizarlo de forma explícita: `bun run db:reset --confirm blackjack`. Las tablas ajenas al proyecto se conservan; una dependencia externa impide el reinicio y revierte la transacción.

El [manual de instalación](docs/manual-instalacion.md) detalla los requisitos, la configuración, la conexión desde otra laptop y los problemas habituales. Es un borrador: la instalación independiente en la laptop de Nahum está pendiente.

`bun run dev` inicia el servidor en `0.0.0.0:3000` y la entrada provisional del cliente. La entrada del cliente solo imprime un mensaje en la consola; aún no abre una página web. Para detener ambos procesos, usa `Ctrl+C`.

Para comprobar el WebSocket manualmente, abre [`scripts/verificar-ws.html`](scripts/verificar-ws.html) como archivo local en tres pestañas y pulsa **Conectar** en cada una. Deja `127.0.0.1:3000` como servidor si haces la prueba en la misma computadora, o escribe la IP de la computadora que ejecuta Bun si pruebas desde otra en la misma red. Las tres pestañas deben mostrar `Conectados: 3`; al cerrar una, las otras deben mostrar `Conectados: 2`.

## Verificaciones

```bash
bun run typecheck
bun run test
```

Las pruebas del transporte cubren el conteo de conexiones WebSocket y las respuestas HTTP de `/ws` y de una ruta inexistente. El protocolo tiene ejemplos válidos e inválidos; las pruebas de economía requieren una base de pruebas separada (consulta el manual).

El entorno objetivo se verificó el 4 de octubre: Compose levanta PostgreSQL 16.15. Con Bun 1.3.13 en un clon limpio, `db:reset` crea siete tablas y 14 artículos, `typecheck` pasa y la suite completa (70 pruebas, incluida la economía) termina sin fallos. Las restricciones de saldo e inventario se comprobaron directamente en SQL.

## Organización

| Ruta | Función actual |
| --- | --- |
| `server/` | Servidor Bun, esquema/seed SQL, acceso a la base y módulos de economía. |
| `client/` | Entrada provisional del futuro cliente. |
| `shared/` | Esquemas Zod, tipos y errores comunes del protocolo. |
| `scripts/` | Arranque, reinicio de la base, empaquetado y verificación manual del transporte. |
| `docs/` | Manuales y arquitectura para la entrega. |
| `documentation/` | Plan, convenciones, tareas y seguimiento del equipo. |

`bun run empaquetar` genera `blackjack-equipo.zip` con fuentes, manuales y `.env.example`, sin dependencias, credenciales locales ni builds. El proyecto aún no tiene scripts `build`/`start`; el arranque de producción depende de T-38.

El diseño previsto y las tareas pendientes están en [`PLAN.md`](documentation/PLAN.md) y [`TAREAS.md`](documentation/TAREAS.md). [`ESTADO.md`](documentation/ESTADO.md) registra el avance del equipo.
