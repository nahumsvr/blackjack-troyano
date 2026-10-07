# Blackjack Troyano

Proyecto de blackjack multijugador en desarrollo. La meta es que varias personas jueguen en mesas compartidas desde el navegador, con un servidor que controle las partidas y una economía de fichas simuladas. El alcance previsto incluye registro, lobby, rondas de blackjack, billetera, tienda e inventario.

## Estado actual

Monorepo con **Bun workspaces** (`server`, `client` y `shared`). El servidor Bun atiende HTTP y WebSocket (`/ws`) en el puerto 3000. Ya funcionan registro, login, reanudar, logout, lobby con tres mesas, compra de fichas con límite diario, tienda, historial de movimientos y rondas completas en mesa (apuestas, turnos con reloj del servidor, dealer, pagos e historial de rondas). Después de compilar, Bun sirve el cliente desde `client/dist` en ese mismo puerto. Los bots de prueba (PR #33) siguen en revisión; el avance está en [`ESTADO.md`](documentation/ESTADO.md).

El cliente React (Vite + Tailwind) tiene:
- acceso y lobby;
- mesa animada con temporizador, reparto desde el zapato del dealer y panel de acciones;
- resultado de la ronda;
- billetera e historial en un menú lateral;
- reconexión automática.

Cerrar la pestaña reserva el asiento durante 60 segundos y planta al jugador si tiene el turno. Al volver con su sesión, recupera las cartas y la apuesta; si la reserva vence con una apuesta activa, el asiento se libera después de liquidarla. Otra pestaña del mismo usuario toma el asiento y la anterior sigue viendo la mesa como espectadora. Cerrar sesión o salir de la mesa conserva la salida explícita prevista en el protocolo. [Implementación y pruebas de T-36](documentation/Avance-H-T36.md).

El modo `http://localhost:5173/?mock=1` permite recorrer la interfaz sin backend. Sin `?mock=1`, el cliente usa el servidor real y PostgreSQL.

## Requisitos y arranque

- [Bun](https://bun.sh/) 1.3.13 (versión indicada en `package.json`).
- Docker Engine con Docker Compose v2 o compatible; la base usa PostgreSQL 16.
- `psql` es opcional para inspeccionar la base desde el equipo anfitrión.
- `zip` y `unzip` son opcionales; solo hacen falta para generar el archivo de entrega.

Desde la raíz del repositorio:

```bash
cp .env.example .env
docker compose up -d --wait
bun install
bun run db:reset
bun run dev
```

Después de copiar `.env`, los cuatro comandos levantan la base, instalan dependencias, cargan el esquema y arrancan desarrollo. **`db:reset` borra los datos del proyecto**: muestra el destino y exige escribir el nombre de la base (`blackjack` por defecto). Para automatizarlo de forma explícita: `bun run db:reset --confirm blackjack`. Las tablas ajenas al proyecto se conservan; una dependencia externa impide el reinicio y revierte la transacción.

El [manual de instalación](docs/manual-instalacion.md) detalla los requisitos, la configuración, la conexión desde otra laptop y los problemas habituales.

`bun run dev` inicia el servidor en `0.0.0.0:3000` y el cliente en `http://localhost:5173`. Vite redirige `/ws` al servidor y también acepta conexiones desde otra laptop por la IP de la máquina. Para detener ambos procesos, usa `Ctrl+C`.

Para iniciar solo el servidor, ejecuta `cd server` y `bun run dev`. El comando carga explícitamente el `.env` de la raíz del repositorio, donde se configura `DATABASE_URL`.

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

Abre `http://localhost:3000` o `http://<IP-del-servidor>:3000` desde otra laptop. HTTP y `/ws` usan el mismo puerto; no hace falta Vite. El ZIP omite `dist`, así que hay que compilar después de descomprimir. Si no hay build, `/` devuelve 404 con la indicación de compilar; las rutas ajenas al build también devuelven 404.

En la máquina servidor, desde la misma copia del proyecto donde se ejecutó `bun run build` (requiere `client/dist` local) y con producción arrancada, `bun run verificar:produccion http://<IP-del-servidor>:3000` comprueba HTML, assets y una ronda por `/ws`. Registra tres cuentas de bots y requiere tres asientos disponibles en `mesa-1`; conserva sus movimientos e historial. La aceptación desde otra laptop se realiza aparte: abrir la URL sin `?mock=1`, registrarse y terminar una ronda. Ver [evidencia de T-38](docs/evidencia/t38/README.md).

El diseño previsto y las tareas pendientes están en [`PLAN.md`](documentation/PLAN.md) y [`TAREAS.md`](documentation/TAREAS.md). [`ESTADO.md`](documentation/ESTADO.md) registra el avance del equipo.
