# Manual de instalación (borrador)

Este manual describe el código disponible. La interfaz React, el registro/login, las partidas y el arranque de producción todavía dependen de tareas del equipo. La comprobación independiente en otra laptop (T-14/T-48/T-55) está pendiente.

## Requisitos

- Bun 1.3.13, indicado en `package.json` y verificado con este manual; Bun 1.4.2 también funciona.
- Docker Engine y Docker Compose v2 o compatible (`docker compose version`). El servicio usa la imagen `postgres:16`.
- Git para clonar, o un descompresor ZIP si recibiste `blackjack-equipo.zip`.
- Opcional: `psql` para consultas SQL desde el anfitrión. También puedes usar el cliente incluido en el contenedor.

- `zip` y `unzip` para generar y validar el ZIP de entrega.

Abre una terminal en la raíz del clon o del archivo descomprimido: allí deben estar `package.json`, `docker-compose.yml` y `.env.example`. El ZIP incluye las fuentes; instala las dependencias después de descomprimirlo.

## Configuración y arranque

1. Copia la configuración: `cp .env.example .env`. Conserva los valores locales o cambia usuario, contraseña, base y puerto. Si los cambias, ajusta también `DATABASE_URL`; codifica los caracteres especiales de la contraseña para una URL.
2. Inicia PostgreSQL: `docker compose up -d --wait`.
3. Instala los workspaces: `bun install`.
4. Crea las tablas y carga el catálogo: `bun run db:reset`. Escribe el nombre de la base mostrado para confirmar (`blackjack` por defecto).
5. Inicia desarrollo: `bun run dev`.

`db:reset` elimina los datos de las siete tablas del proyecto. Para una ejecución sin terminal interactiva usa `bun run db:reset --confirm blackjack`, sustituyendo `blackjack` por el nombre exacto configurado. El borrado y la carga se hacen en una sola transacción; si fallan, los datos anteriores se conservan. No se eliminan otras tablas ni se usa `CASCADE`.

La base persiste en el volumen de Compose. `docker compose down` detiene el contenedor y conserva el volumen; `docker compose down -v` también elimina sus datos. Cambiar las variables de usuario/contraseña después de crear el volumen no cambia las credenciales almacenadas de PostgreSQL.

## Comprobar la base

El cliente del contenedor permite comprobar conectividad sin instalar `psql` en el anfitrión:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1"'
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM articulos"'
```

Las respuestas esperadas son `1` y `14`. Para listar las siete tablas:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
```

Con `psql` instalado y los valores predeterminados puedes usar:

```bash
psql 'postgres://blackjack:blackjack_local@127.0.0.1:5432/blackjack' -c 'SELECT 1'
```

## Desarrollo y conexión desde otra laptop

`bun run dev` inicia el servidor en `0.0.0.0:3000` y la entrada provisional del cliente. El cliente aún no abre una interfaz web; el endpoint `/` devuelve `404` y `/ws` acepta conexiones WebSocket.

Abre `scripts/verificar-ws.html` como archivo local en tres pestañas. Pulsa **Conectar** con `127.0.0.1:3000` si estás en la misma laptop. Desde otra laptop en la misma red, copia ese archivo y escribe la IP del equipo que ejecuta el servidor seguida de `:3000`, por ejemplo `192.168.1.42:3000`. Las tres pestañas deben mostrar `Conectados: 3`.

PostgreSQL se publica únicamente en `127.0.0.1`; las otras laptops se conectan al servidor Bun. Si la red escolar aísla dispositivos, usa una red compartida o hotspot. El equipo servidor debe permitir TCP 3000 en su firewall para la prueba LAN. Detén desarrollo con `Ctrl+C`.

## Verificaciones y empaquetado

```bash
bun run typecheck
bun run test
bun run empaquetar
```

Las pruebas de economía necesitan una **base exclusiva de pruebas**, configurada con `TEST_DATABASE_URL`. La suite crea un esquema aleatorio, aplica `schema.sql` y `seed.sql` y elimina únicamente ese esquema al terminar. El usuario necesita permiso `CREATE SCHEMA`. Sin esa variable, esas pruebas aparecen explícitamente como omitidas.

Con las credenciales predeterminadas, crea la base de pruebas una vez y ejecuta:

```bash
docker compose exec postgres createdb -U blackjack blackjack_pruebas
TEST_DATABASE_URL=postgres://blackjack:blackjack_local@127.0.0.1:5432/blackjack_pruebas bun test server/test/economia.test.ts
```

Si modificaste `.env`, ajusta las credenciales y el puerto del ejemplo. Esta suite prepara sus propios datos; no requiere `db:reset`. Nunca apuntes pruebas a una base con datos que necesites conservar.

El empaquetador genera `blackjack-equipo.zip` en la raíz, comprueba que mide menos de 20 MB y valida su contenido. Incluye fuentes, `README.md`, `docs/`, los documentos de seguimiento y `.env.example`. Excluye `node_modules`, `.git`, `.env`, archivos de entorno locales, `dist`, cobertura y archivos ZIP previos.

Los comandos previstos `bun run build` y `bun run start` todavía no existen. T-38 incorporará el build del cliente y su servicio desde Bun; hasta entonces, usa el flujo de desarrollo y la página de comprobación del transporte.

## Problemas habituales

| Problema | Acción |
| --- | --- |
| Docker no puede conectarse a `/var/run/docker.sock` (`permission denied`) | Comprueba que Docker esté iniciado (`sudo systemctl start docker` en Linux). Si el error es de permisos, agrega tu usuario al grupo con `sudo usermod -aG docker $USER` y cierra e inicia sesión, o antepone `sudo` a los comandos `docker compose`. Si no quieres cerrar sesión, `newgrp docker` abre una terminal con el grupo aplicado. En Windows/macOS, abre Docker Desktop. |
| PostgreSQL no inicia por puerto ocupado | Cambia `POSTGRES_PORT` en `.env` y el puerto de `DATABASE_URL`, y vuelve a levantar Compose. |
| `db:reset` indica que falta `DATABASE_URL` | Comprueba que `.env` esté en la raíz y ejecuta el comando desde esa carpeta. |
| PostgreSQL rechaza la contraseña tras editar `.env` | El volumen retiene sus credenciales originales; usa esas credenciales o cambia la contraseña dentro de PostgreSQL. |
| Bun no puede escuchar en `:3000` | Detén el otro proceso que usa ese puerto. |
| Otra laptop no puede conectarse | Revisa IP, puerto, firewall y aislamiento de la red. Primero comprueba la conexión en el propio servidor. |
| `db:reset` falla por dependencia externa | Revisa la tabla ajena que referencia el esquema; el script revierte los cambios para conservar los datos. |

## Evidencia local y pendientes

El esquema, el catálogo y el reinicio se verificaron en una instancia temporal de PostgreSQL **18.6**, con Bun 1.4.2. Se comprobaron las siete tablas, los 14 artículos, las restricciones de saldo y duplicados, la clave de idempotencia, la confirmación obligatoria y la conservación de datos ante fallos.

**Entorno objetivo (4 oct):** `docker compose up -d --wait` levantó PostgreSQL **16.15** sano y `psql $DATABASE_URL -c 'select 1'` respondió. Con **Bun 1.3.13** en un clon limpio, `db:reset` creó siete tablas y 14 artículos, y `typecheck` y la suite completa con `TEST_DATABASE_URL` (70 pruebas, 381 aserciones) pasaron sin fallos. El puerto 5432 estaba ocupado por otro PostgreSQL, así que se usó `POSTGRES_PORT=5433` como se indica en *Problemas habituales*.

Este manual todavía no acredita instalación independiente en otra laptop ni juego con tres usuarios.
