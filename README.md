# Blackjack Troyano

Proyecto de blackjack multijugador en desarrollo. La meta es que varias personas jueguen en mesas compartidas desde el navegador, con un servidor que controle las partidas y una economía de fichas simuladas. El alcance previsto incluye registro, lobby, rondas de blackjack, billetera, tienda e inventario.

## Estado actual

El repositorio ya tiene un monorepo con **Bun workspaces** (`server`, `client` y `shared`) y un servidor WebSocket básico. Al conectarse a `ws://localhost:3000/ws`, el servidor envía a todas las conexiones del lobby un mensaje con el número de sockets abiertos:

```json
{"type":"bienvenida","conectados":1}
```

El conteo se actualiza cuando alguien se conecta o desconecta. El contrato Zod, PostgreSQL y los módulos de economía están disponibles. El enrutador y la autenticación ya están conectados: registro, login, reanudación, logout y consulta de billetera funcionan contra PostgreSQL (PR #18 y #19). El lobby de mesas, las partidas y los handlers de compras e historial todavía están pendientes en `main`. La ruta HTTP `/` responde `404` (servir el cliente desde Bun es T-38).

El cliente React (Vite + Tailwind) tiene:
- acceso y lobby;
- mesa animada con temporizador, reparto desde el zapato del dealer y panel de acciones;
- resultado de la ronda;
- billetera e historial en un menú lateral;
- reconexión automática.

Para recorrer mesa, compras e historial completos se usa el servidor falso en `http://localhost:5173/?mock=1`. En la URL sin `?mock=1`, el acceso es real; tras entrar, `lobby.listar` todavía no tiene handler y devuelve `ERROR_INTERNO`. El lobby queda vacío y muestra «Ocurrió un error interno; intenta de nuevo»; no existe un aviso específico de función pendiente.

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

## Verificaciones

```bash
bun run typecheck
bun run test
```

Las pruebas del transporte cubren conexiones, validación y respuestas correlacionadas. El protocolo tiene ejemplos válidos e inválidos; economía y autenticación se prueban contra una base separada configurada con `TEST_DATABASE_URL` (consulta el manual). Sin esa variable, sus pruebas SQL se omiten. Las pruebas del cliente (`client/test/`) cubren conexión, reloj, estado, validaciones, mock y animaciones.

El entorno objetivo se verificó el 4 de octubre: Compose levanta PostgreSQL 16.15. Con Bun 1.3.13 en un clon limpio, `db:reset` crea siete tablas y 14 artículos, `typecheck` pasa y la suite completa (70 pruebas, incluida la economía) termina sin fallos. Las restricciones de saldo e inventario se comprobaron directamente en SQL.

La corrida histórica del 5 oct, basada en `main` (`831dcd2`) más cambios locales del empaquetador, pasó instalación con lockfile fijo, typecheck, 203 pruebas con PostgreSQL 16.15 y build con Bun 1.4.2. Durante la revisión del PR #23 se repitieron esas comprobaciones en la misma copia extraída con **Bun 1.3.13**: 203 pruebas / 3,402 aserciones, cero fallos u omisiones, typecheck/build correctos. La comprobación de `main` en `83165c6`, que incorpora Carta/Baraja de PR #25, pasó 208 pruebas con esa misma versión objetivo. [Evidencia de revisión](documentation/Revision-PR-23.md). Esto no acredita instalación independiente ni el ZIP final.

La auditoría del 6 oct sobre `main` en `04802be` pasó typecheck, **236 pruebas / 3,540 aserciones**, cero fallos/omisiones, y build del cliente con Bun 1.3.13/PostgreSQL 16.15. T-11 ya tiene [evidencia de reconexión con la misma sesión](docs/evidencia/t11/README.md) desde PR #34. Los PR #21 (economía WS) y #24 (producción) se fusionaron en la rama de #22, aún fuera de `main`; el [seguimiento y plan de integración](documentation/Avance-M-06.md) documenta los siguientes pasos.

## Organización

| Ruta | Función actual |
| --- | --- |
| `server/` | Servidor Bun, esquema/seed SQL, acceso a la base y módulos de economía. |
| `client/` | Cliente React + Vite + Tailwind: capa de red, estado, pantallas, componentes de la mesa y servidor falso (`?mock=1`). |
| `shared/` | Esquemas Zod, tipos y errores comunes del protocolo. |
| `scripts/` | Arranque, reinicio de la base, empaquetado y verificación manual del transporte. |
| `docs/` | Manuales y arquitectura para la entrega. |
| `documentation/` | Plan, convenciones, tareas y seguimiento del equipo. |

`bun run empaquetar` genera `blackjack-equipo.zip` con fuentes, manuales y `.env.example`, sin dependencias, credenciales locales ni builds. El cliente compila con `bun run --filter @blackjack/client build` (genera `client/dist`). El arranque de producción en un solo puerto (`build`/`start` en la raíz) depende de T-38.

El diseño previsto y las tareas pendientes están en [`PLAN.md`](documentation/PLAN.md) y [`TAREAS.md`](documentation/TAREAS.md). [`ESTADO.md`](documentation/ESTADO.md) registra el avance del equipo.
