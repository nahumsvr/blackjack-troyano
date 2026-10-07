# Blackjack Troyano

Proyecto de blackjack multijugador en desarrollo. La meta es que varias personas jueguen en mesas compartidas desde el navegador, con un servidor que controle las partidas y una economía de fichas simuladas. El alcance previsto incluye registro, lobby, rondas de blackjack, billetera, tienda e inventario.

## Estado actual

El repositorio ya tiene un monorepo con **Bun workspaces** (`server`, `client` y `shared`) y un servidor WebSocket básico. Al conectarse a `ws://localhost:3000/ws`, el servidor envía a todas las conexiones del lobby un mensaje con el número de sockets abiertos:

```json
{"type":"bienvenida","conectados":1}
```

El conteo se actualiza cuando alguien se conecta o desconecta. Esta rama de integración compone registro, login, reanudar, logout, lobby, partidas, compras e historial reales. Conserva el cliente y las integraciones de economía y producción de los compañeros. Después de compilar, Bun sirve la página y sus assets desde `client/dist` en el mismo puerto que `/ws`.

Al 6 de octubre, el lobby/motor y las integraciones de economía/producción aún esperan las PR #22 y #28–#33 para llegar a `main`. La integración local pasó typecheck, build y 326 pruebas con PostgreSQL 16.15, sin fallos ni omisiones; las pruebas LAN y la aceptación de la entrega siguen pendientes. [Estado y entrega de Hector](documentation/Entrega-Hector-2026-10-06.md).

El cliente React (Vite + Tailwind) tiene:
- acceso y lobby;
- mesa animada con temporizador, reparto desde el zapato del dealer y panel de acciones;
- resultado de la ronda;
- billetera e historial en un menú lateral;
- reconexión automática.

El modo `http://localhost:5173/?mock=1` permite recorrer la interfaz sin backend. En la URL sin `?mock=1`, esta rama usa PostgreSQL y los handlers reales de lobby, juego y economía. La comprobación de todo el recorrido en tres laptops sigue pendiente.

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

`bun run dev` inicia el servidor en `0.0.0.0:3000` y el cliente en `http://localhost:5173`. Vite redirige `/ws` al servidor y también acepta conexiones desde otra laptop por la IP de la máquina. Para detener ambos procesos, usa `Ctrl+C`.

Para recorrer la interfaz sin backend, abre `http://localhost:5173/?mock=1`. La barra morada de arriba permite:
- recorrer las 6 fases de la mesa;
- forzar cada resultado de la ronda;
- simular una caída de red.

Cualquier usuario válido entra. El usuario `existe` y la contraseña `incorrecta` simulan los errores del servidor.

Para comprobar el WebSocket manualmente, abre [`scripts/verificar-ws.html`](scripts/verificar-ws.html) como archivo local en tres pestañas y pulsa **Conectar** en cada una. Deja `127.0.0.1:3000` como servidor si haces la prueba en la misma computadora, o escribe la IP de la computadora que ejecuta Bun si pruebas desde otra en la misma red. Las tres pestañas deben mostrar `Conectados: 3`; al cerrar una, las otras deben mostrar `Conectados: 2`.

## Bots para probar el juego (T-26)

Con el servidor arrancado, ejecuta en otra terminal:

```bash
bun run bots 4 --mesa mesa-1
```

Registra cuatro cuentas nuevas, las sienta y juega **diez rondas por bot**: apuesta 10, pide mientras su total sea menor de 17 y se planta al llegar a 17. Solo actúa con los snapshots del servidor. Muestra resultado y pago de cada ronda, termina con código 0 y libera las conexiones; ante un rechazo, desconexión o falta de respuesta termina con código 1. Las cuentas e historial quedan en la base.

Para aportar tres jugadores extra durante la demo, usa `bun run bots 3 --mesa mesa-1 --rondas 0` y detén el grupo con `Ctrl+C`. Para otra laptop añade `--url ws://IP_DEL_SERVIDOR:3000/ws`. Admite de uno a cinco bots; la mesa debe tener suficientes asientos libres. Si ya hay una ronda en curso o quedan menos de 1 s de apuestas, esperan la siguiente para apostar; un bot sin fichas deja la mesa y el resto sigue jugando. Los valores por defecto están en `server/src/config.ts`.

## Verificaciones

```bash
bun run typecheck
bun run test
```

Las pruebas del transporte cubren conexiones, validación y respuestas correlacionadas. El protocolo tiene ejemplos válidos e inválidos; economía y autenticación se prueban contra una base separada configurada con `TEST_DATABASE_URL` (consulta el manual). Sin esa variable, sus pruebas SQL se omiten. Las pruebas del cliente (`client/test/`) cubren conexión, reloj, estado, validaciones, mock y animaciones.

El entorno objetivo se verificó el 4 de octubre: Compose levanta PostgreSQL 16.15. Con Bun 1.3.13 en un clon limpio, `db:reset` crea siete tablas y 14 artículos, `typecheck` pasa y la suite completa (70 pruebas, incluida la economía) termina sin fallos. Las restricciones de saldo e inventario se comprobaron directamente en SQL.

La corrida histórica del 5 oct, basada en `main` (`831dcd2`) más cambios locales del empaquetador, pasó instalación con lockfile fijo, typecheck, 203 pruebas con PostgreSQL 16.15 y build con Bun 1.4.2. Durante la revisión del PR #23 se repitieron esas comprobaciones en la misma copia extraída con **Bun 1.3.13**: 203 pruebas / 3,402 aserciones, cero fallos u omisiones, typecheck/build correctos. La rama documental, después de incorporar Carta/Baraja de PR #25, pasó 208 pruebas con esa misma versión objetivo. [Evidencia histórica](documentation/Revision-PR-23.md). La integración actual tiene [su propia evidencia](documentation/Entrega-Hector-2026-10-06.md); ninguna de estas corridas acredita instalación independiente ni el ZIP final.

## Organización

| Ruta | Función actual |
| --- | --- |
| `server/` | Servidor Bun, esquema/seed SQL, acceso a la base y módulos de economía. |
| `client/` | Cliente React + Vite + Tailwind: capa de red, estado, pantallas, componentes de la mesa y servidor falso (`?mock=1`). |
| `shared/` | Esquemas Zod, tipos y errores comunes del protocolo. |
| `scripts/` | Arranque, reinicio de la base, empaquetado y verificación manual del transporte. |
| `docs/` | Manuales y arquitectura para la entrega. |
| `documentation/` | Plan, convenciones, tareas y seguimiento del equipo. |

`bun run empaquetar` genera `blackjack-equipo.zip` con fuentes, manuales y `.env.example`, sin dependencias, credenciales locales ni builds. Para producción, con `.env` y la base ya preparados:

```bash
bun run build
bun run start
```

Abre `http://localhost:3000` o `http://<IP-del-servidor>:3000` desde otra laptop. HTTP y `/ws` usan el mismo puerto; no hace falta Vite. El ZIP omite `dist`, así que hay que compilar después de descomprimir. Si no hay build, `/` devuelve 404 con la indicación de compilar; las rutas ajenas al build también devuelven 404. La prueba LAN de producción es el criterio pendiente de T-38.

El diseño previsto y las tareas pendientes están en [`PLAN.md`](documentation/PLAN.md) y [`TAREAS.md`](documentation/TAREAS.md). [`ESTADO.md`](documentation/ESTADO.md) registra el avance del equipo.
