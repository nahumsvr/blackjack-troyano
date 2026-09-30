# CLAUDE.md — Convenciones del repo Blackjack multijugador

Proyecto universitario (Sistemas Distribuidos, Parcial 1). Equipo: **Hector** (juego/servidor), **Nahum** (cliente), **Massimo** (contrato/economía/docs). Entrega: **mié 7 oct 2026, 13:00 CDMX**, en `.zip`.

Documentos de referencia (léelos antes de trabajar):
- `PLAN.md` — arquitectura, protocolo, BD, clases, máquina de estados, cronograma, criterio de corte.
- `TAREAS.md` — tareas con dueño, dependencias y criterio de "hecho".
- `ESTADO.md` — avance y bloqueos.
- `CHECKLIST_ENTREGA.md` — verificación final contra la rúbrica.

**Prioridad absoluta:** que funcione sin errores de validación. No agregues features fuera de `TAREAS.md`; los extras (doblar, split, seguro, chat, ranking) no se empiezan antes del congelamiento (dom 4 oct 22:00). No cambies el protocolo ni el esquema sin actualizar `PLAN.md` y avisar en el PR.

## Stack

- **Bun** (runtime, servidor, tests, gestor de paquetes). `Bun.serve` con WebSocket nativo y pub/sub (`ws.subscribe` / `server.publish`), un topic por mesa. **Sin Socket.IO, sin Express.**
- **PostgreSQL 16** en Docker Compose, con el cliente integrado `import { sql } from "bun"`. **Sin ORM**; SQL plano.
- **React + Vite + TypeScript + Tailwind** en el cliente.
- **Zod** en `shared/` para esquemas y validación.
- Contraseñas con `Bun.password.hash` / `Bun.password.verify`.
- TypeScript en todo, con `strict: true`.

## Estructura

```
server/src/{index.ts, config.ts, ws/, auth/, game/, store/, db/}
server/db/{schema.sql, seed.sql, consultas.sql}
server/test/
client/src/{net/, state/, screens/, components/, mock/}
shared/          # protocolo (Zod), tipos, códigos de error
scripts/         # bots.ts, empaquetar.ts, db-reset.ts
docs/            # manuales, arquitectura, exposición
```

Dueños: `server/src/{ws,game,auth}` → Hector · `client/` → Nahum · `shared/`, `server/db`, `server/src/{store,db}` → Massimo. Tocar la carpeta de otro requiere su revisión en el PR.

## Reglas de arquitectura (obligatorias)

1. **El servidor es la única fuente de verdad.** El cliente solo envía intenciones (`apostar`, `pedir`…) y dibuja el estado recibido. Toda validación (turno, saldo, fase) ocurre en el servidor. El cliente puede deshabilitar botones, pero nunca decide.
2. **Los tipos de los mensajes viven en `shared/`** como uniones discriminadas por `type`. Cliente y servidor importan los mismos esquemas; no se duplican tipos.
3. **Todo mensaje entrante se valida en runtime** con Zod. Inválido → mensaje `error` con `codigo` y `mensaje`. Nada tumba el servidor: el enrutador tiene `try/catch` global.
4. **Las partidas en curso viven en memoria.** Postgres guarda usuarios, dinero, compras, inventario e historial de rondas terminadas.
5. **Dinero y fichas son enteros** (`bigint`/`int` en SQL, `z.number().int()` en TS). Nunca flotantes.
6. **Toda operación de dinero va en una transacción SQL** con `SELECT … FOR UPDATE` sobre la fila del usuario y un `INSERT` en `movimientos` (libro contable, solo inserciones).

Además:
- La carta oculta del dealer nunca se incluye en un snapshot antes de la fase `DEALER`.
- Los relojes son del servidor (`finEn` en epoch ms); un solo `setTimeout` activo por mesa.
- `game/` no importa `store/`: recibe la interfaz `Billetera` inyectada.
- Valores configurables solo en `server/src/config.ts` y `seed.sql`; nada de números mágicos.

## Convenciones de código

- Nombres de dominio **en español** (`Mesa`, `Baraja`, `apostar`, `fichas`), sin acentos ni ñ en identificadores (`contrasena`). Clases en `PascalCase`, funciones y variables en `camelCase`, constantes de config en `MAYUSCULAS`, tablas y columnas SQL en `snake_case`.
- Un archivo por clase en `game/` y `store/`.
- Sin `any`; si es inevitable, comentario explicando por qué.
- Errores de dominio: lanzar `ErrorJuego(codigo)` con códigos de `shared/errores.ts`; el enrutador los convierte en mensajes `error`.
- **Comentarios (el código documentado vale 10 %):**
  - Comentario de cabecera en cada archivo: qué contiene y cómo encaja en la arquitectura.
  - **JSDoc obligatorio** en toda clase, método público y función exportada: descripción, `@param`, `@returns`, `@throws` (con el código de error).
  - Comentarios de "por qué" en lógica delicada (transacciones, límite diario, máquina de estados, reconexión). No comentar lo obvio.
  - Ejemplo:
    ```ts
    /**
     * Registra la apuesta del jugador y descuenta sus fichas en la BD.
     * @param usuarioId - Jugador que apuesta; debe estar sentado en esta mesa.
     * @param cantidad - Fichas a apostar (entero, múltiplo de 10, entre APUESTA_MIN y APUESTA_MAX).
     * @throws ErrorJuego FASE_INCORRECTA | YA_APOSTASTE | FICHAS_INSUFICIENTES
     */
    ```
- Tests con `bun test` junto a la lógica pura (`server/test/`): reglas del juego y economía son obligatorios.

## Flujo de Git

- `main` protegida: nada de push directo; todo por PR con **1 aprobación de otro dev**.
- Una rama por tarea: `t-XX-descripcion-corta` (ej. `t-18-maquina-estados-mesa`).
- PRs pequeños (idealmente < 400 líneas). Título: `T-XX · descripción`. En la descripción: qué se hizo, cómo probarlo, criterio de "hecho" cumplido.
- Commits en español, en imperativo: `Agrega validación de turno en pedir`.
- Antes de pedir revisión: `bun run typecheck` y `bun test` en verde.
- El PR incluye marcar la tarea en `TAREAS.md` y la línea en `ESTADO.md`.
- Tras el congelamiento (tag `v0.9-congelado`) solo se fusionan correcciones de bugs y documentación.

## Comandos

```bash
docker compose up -d          # levanta Postgres
bun install                   # instala dependencias de todos los workspaces
bun run db:reset              # aplica schema.sql + seed.sql (¡borra datos!)
bun run dev                   # servidor (:3000) + cliente Vite (:5173, --host)
bun test                      # pruebas
bun run typecheck             # tipos en los 3 paquetes
bun run build && bun run start  # producción: un solo puerto 3000 que sirve el cliente
bun run bots 3 --mesa mesa-1  # 3 jugadores falsos para pruebas
bun run empaquetar            # genera el .zip de entrega
```

(Los scripts se crean en T-01, T-05, T-26 y T-54; si alguno aún no existe, revisa `TAREAS.md`.)

## Rutina de seguimiento

Cuando alguien pida **"¿dónde vamos?"** o **"actualiza el estado"**:

1. Lee `TAREAS.md`, `ESTADO.md` y el historial reciente (`git log --oneline -30`, ramas y PRs fusionados; `gh pr list --state all` si está disponible).
2. Marca `[x]` en `TAREAS.md` las tareas cuyo PR ya está fusionado en `main` y cuyo criterio de "hecho" se cumple. Si hay duda, pregunta; no marques por suposición.
3. Recalcula en `ESTADO.md`: completadas/total por dev, total y por hito; porcentajes redondeados.
4. Compara contra el cronograma de `PLAN.md` §8 y actualiza el semáforo: 🟢 a tiempo · 🟡 en riesgo (tarea del camino crítico T-01 → T-03 → T-07 → T-18 → T-20 → T-31 con más de medio día de atraso, o hito a < 1 día con < 70 % hecho) · 🔴 atrasados (el hito no se cumplió en su fecha).
5. Actualiza "Bloqueos activos" (tareas cuya dependencia no está hecha) y "Hoy le toca a…" (siguientes tareas desbloqueadas de cada dev, priorizando las 🔓).
6. Agrega una línea al registro diario con la fecha.
7. Responde con un resumen corto: estado del hito, % por dev, qué sigue para cada uno y qué está en riesgo. Si el riesgo lo amerita, sugiere aplicar el **criterio de corte** de `PLAN.md` §10.

**Al terminar cualquier tarea:** marca su check en `TAREAS.md` (con número de PR) y agrega una línea al registro de `ESTADO.md` (`AAAA-MM-DD · T-XX hecha por <dev>`).
