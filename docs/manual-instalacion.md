# Manual de instalación

Cómo instalar y ejecutar Blackjack Troyano desde el repositorio o desde `blackjack-equipo.zip`, y cómo conectarse desde otras laptops de la misma red.

## Ruta rápida (demo en red local)

```bash
cp .env.example .env
docker compose up -d --wait
bun install
bun run db:reset --confirm blackjack
bun run build
bun run start
```

Abre `http://<IP-del-servidor>:3000` en cada laptop (ver [cómo conocer la IP](#conexión-desde-otra-laptop)). Las secciones siguientes explican cada paso.

## Requisitos

- Bun 1.3.13 (la versión fijada en `package.json`).
- Docker Engine y Docker Compose v2 o compatible (`docker compose version`). El servicio usa la imagen `postgres:16`.
- Git para clonar, o un descompresor ZIP si recibiste `blackjack-equipo.zip`.
- Opcional: `psql` para consultas SQL desde el anfitrión. También puedes usar el cliente incluido en el contenedor.
- Opcional: `zip` y `unzip`, solo para generar el ZIP de entrega con `bun run empaquetar`.

Abre una terminal en la raíz del clon o del archivo descomprimido: allí deben estar `package.json`, `docker-compose.yml` y `.env.example`. El ZIP incluye las fuentes; instala las dependencias después de descomprimirlo.

## Configuración y arranque

1. Copia la configuración: `cp .env.example .env` (en `cmd` de Windows: `copy .env.example .env`). Conserva los valores locales o cambia usuario, contraseña, base y puerto. Si los cambias, ajusta también `DATABASE_URL`; codifica los caracteres especiales de la contraseña para una URL.
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

## Desarrollo

`bun run dev` inicia el servidor en `0.0.0.0:3000` y el cliente Vite en el puerto 5173, también abierto a la red. Desde la misma laptop abre `http://localhost:5173`; desde otra, `http://<IP-del-equipo>:5173`. Vite redirige `/ws` al servidor, así que el navegador solo necesita llegar al puerto 5173. Bun acepta WebSocket en `/ws` y, si existe `client/dist`, sirve ese build en `/`.

Para recorrer la interfaz sin servidor, abre `http://localhost:5173/?mock=1`. Así se usa un servidor falso: la barra morada cambia de fase, fuerza resultados y simula una caída de red. En producción puedes usar `http://localhost:3000/?mock=1`.

Abre `scripts/verificar-ws.html` como archivo local en tres pestañas. Pulsa **Conectar** con `127.0.0.1:3000` si estás en la misma laptop. Desde otra laptop en la misma red, copia ese archivo y escribe la IP del equipo que ejecuta el servidor seguida de `:3000`, por ejemplo `192.168.1.42:3000`. Las tres pestañas deben mostrar `Conectados: 3`.

PostgreSQL se publica únicamente en `127.0.0.1`; las otras laptops se conectan al servidor Bun. Si la red escolar aísla dispositivos, usa una red compartida o hotspot. El equipo servidor debe permitir TCP 3000 (WebSocket) y TCP 5173 (cliente en desarrollo) en su firewall para la prueba LAN. Detén desarrollo con `Ctrl+C`.

## Verificaciones y empaquetado

```bash
bun run typecheck
bun run test
bun run empaquetar
```

Las pruebas de economía y autenticación necesitan una **base exclusiva de pruebas**, configurada con `TEST_DATABASE_URL`. Cada suite crea un esquema aleatorio, aplica `schema.sql` y `seed.sql` y elimina únicamente ese esquema al terminar. El usuario necesita permiso `CREATE SCHEMA`. Sin esa variable, esas pruebas aparecen explícitamente como omitidas.

Con las credenciales predeterminadas, crea la base de pruebas una vez y ejecuta:

```bash
docker compose exec postgres createdb -U blackjack blackjack_pruebas
TEST_DATABASE_URL=postgres://blackjack:blackjack_local@127.0.0.1:5432/blackjack_pruebas bun run test
```

Si modificaste `.env`, ajusta las credenciales y el puerto del ejemplo. El comando ejecuta todas las suites del proyecto; las suites SQL preparan sus propios datos y no requieren `db:reset`. Nunca apuntes pruebas a una base con datos que necesites conservar.

El empaquetador genera `blackjack-equipo.zip` en la raíz, comprueba que mide menos de 20 MB y valida su contenido. Incluye fuentes, `README.md`, `docs/`, los documentos de seguimiento y `.env.example`. Excluye `node_modules`, `.git`, `.env`, archivos de entorno locales, `dist`, cobertura y archivos ZIP previos.

## Producción: un solo puerto

Después de configurar `.env`, levantar PostgreSQL, instalar dependencias y preparar la base, ejecuta desde la raíz:

```bash
bun run build
bun run start
```

El primer comando genera `client/dist` con Vite. El segundo inicia Bun en `0.0.0.0:3000` y usa el build y la base existentes. Para abrirlo en la misma máquina usa `http://localhost:3000`; desde otra laptop, `http://<IP-del-equipo>:3000`. El cliente deriva `/ws` del host de la página. En producción basta permitir TCP 3000; Vite y TCP 5173 pertenecen al flujo de desarrollo.

El ZIP no contiene `dist`: compila tras cada instalación o actualización del código del cliente. Si el build falta, Bun responde «Cliente no compilado. Ejecuta bun run build.» con 404, y `/ws` sigue disponible. Un archivo desconocido devuelve 404; el servidor no lo sustituye por HTML. `Ctrl+C` detiene Bun y cierra su pool SQL.

## Conexión desde otra laptop

1. Conecta todas las laptops a la misma red (si la red escolar aísla dispositivos, usa el hotspot de un teléfono).
2. En el equipo servidor, consulta su IP: `ipconfig` en Windows (dirección IPv4), `ip -4 addr` en Linux o `ipconfig getifaddr en0` en macOS.
3. Comprueba primero en el propio servidor que `http://<IP>:3000` abre el juego; después ábrelo desde las demás laptops.

Si solo el propio servidor logra abrirlo, permite TCP 3000 en su firewall:

- Windows (PowerShell como administrador): `netsh advfirewall firewall add rule name="Blackjack" dir=in action=allow protocol=TCP localport=3000`
- Linux con ufw: `sudo ufw allow 3000/tcp`
- macOS: acepta el aviso «¿Permitir conexiones entrantes?» para `bun`.

## Problemas habituales

| Problema | Acción |
| --- | --- |
| Docker no puede conectarse a `/var/run/docker.sock` (`permission denied`) | Comprueba que Docker esté iniciado (`sudo systemctl start docker` en Linux). Si el error es de permisos, agrega tu usuario al grupo con `sudo usermod -aG docker $USER` y cierra e inicia sesión, o antepone `sudo` a los comandos `docker compose`. Si no quieres cerrar sesión, `newgrp docker` abre una terminal con el grupo aplicado. En Windows/macOS, abre Docker Desktop. |
| PostgreSQL no inicia por puerto ocupado | Cambia `POSTGRES_PORT` en `.env` y el puerto de `DATABASE_URL`, y vuelve a levantar Compose. |
| `db:reset` indica que falta `DATABASE_URL` | Comprueba que `.env` esté en la raíz y ejecuta el comando desde esa carpeta. |
| El servidor indica que falta `DATABASE_URL` | Comprueba que el `.env` de la raíz contiene una URL PostgreSQL válida. `bun run dev` dentro de `server/` carga ese archivo mediante `--env-file=../.env`. |
| PostgreSQL rechaza la contraseña tras editar `.env` | El volumen retiene sus credenciales originales; usa esas credenciales o cambia la contraseña dentro de PostgreSQL. |
| Bun no puede escuchar en `:3000` («Is port 3000 in use?») | Detén el otro proceso que usa ese puerto: `lsof -i :3000` en Linux/macOS o `netstat -ano \| findstr :3000` en Windows, y termina ese PID. |
| Otra laptop no puede conectarse | Revisa IP, firewall y aislamiento de la red (ver [Conexión desde otra laptop](#conexión-desde-otra-laptop)). |
| La página dice «Cliente no compilado» | Ejecuta `bun run build` y reinicia `bun run start`. |
| `db:reset` falla por dependencia externa | Revisa la tabla ajena que referencia el esquema; el script revierte los cambios para conservar los datos. |
