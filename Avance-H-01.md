# Avance-H-01 — Hector

Fecha: 1 de octubre de 2026. Contexto: PLAN.md, TAREAS.md, ESTADO.md, CLAUDE.md y CHECKLIST_ENTREGA.md. Se trabajó únicamente en tareas de Hector.

## Avances publicados

| Tarea | PR | Avance | Pendiente |
|---|---|---|---|
| T-01 | [#1](https://github.com/nahumsvr/blackjack-troyano/pull/1) | Monorepo Bun con server, client y shared; TypeScript estricto, scripts raíz y .gitignore. Instalación y tipos correctos en clon limpio. | Revisión de Nahum/Massimo por las entradas mínimas de sus paquetes, una aprobación y fusión. |
| T-02 | [#2 — borrador](https://github.com/nahumsvr/blackjack-troyano/pull/2) | Plantilla de PR y JSON de protección preparados. | Nahum aplica la protección de main y verifica rechazo de push directo y de fusión sin una aprobación. |
| T-06 | [#3 — borrador](https://github.com/nahumsvr/blackjack-troyano/pull/3) | Bun.serve en 0.0.0.0:3000, upgrade /ws, topic lobby y conteo de sockets. Tipos y tres pruebas correctos. | Prueba visual en tres pestañas, revisión y fusión. |

T-02 y T-06 se comparan con la rama t-01-monorepo-bun para mostrar únicamente los cambios de cada tarea. Primero integrar T-01; después actualizar la base de los PRs dependientes a main. No se hizo push directo a main ni se fusionaron PRs. Los totales de ESTADO.md siguen contabilizando lo fusionado.

Las ramas publicadas son t-01-monorepo-bun, t-02-plantilla-proteccion y t-06-servidor-websocket. TAREAS.md y ESTADO.md registran el PR de cada tarea en su rama; las casillas pendientes no se presentan como terminadas.

## Qué se verificó

- T-01: bun install en clon limpio y bun run typecheck correctos en los tres paquetes y scripts. bun run dev inicia las entradas provisionales. En esta rama todavía no hay tests; bun run test permite esa ausencia explícitamente.
- T-06: bun run typecheck y bun test correctos. Tres sockets reales reciben conectados=3; al cerrar uno, los restantes reciben 2 en menos de 1 s. Las otras pruebas comprueban GET sin upgrade (426) y ruta distinta de /ws (404).
- No se han probado registro, economía, rondas ni cliente React: corresponden a tareas posteriores.

La caché de Bun se guarda dentro de node_modules mediante bunfig.toml. En las verificaciones iniciales la caché compartida entregaba paquetes incompletos; la instalación con caché local pasó desde un clon limpio.

## Prueba visual pendiente de T-06

En la rama t-06-servidor-websocket:

```powershell
bun install
bun run dev
```

Abrir scripts/verificar-ws.html en tres pestañas. Conectar cada una a 127.0.0.1:3000, o a la IP del servidor desde otra laptop. Las tres deben mostrar "Conectados: 3"; cerrar una debe actualizar las dos restantes a 2 en menos de 1 s.

El archivo es una herramienta de verificación de Hector; no implementa el cliente asignado a Nahum.

## Contrato y trabajo de otros integrantes

T-06 depende solamente de T-01, como indica TAREAS.md. Hector confirmó la bienvenida {type:"bienvenida", conectados:number}; se documentó en PLAN.md §3. conectados cuenta sockets, no usuarios autenticados. Massimo deberá incorporar su esquema Zod en T-03. No se implementó esa tarea ni la aplicación de Nahum.

## Protección de main — Nahum

La cuenta de trabajo y el conector tienen admin:false. Hector confirmó que Nahum aplicará la protección desde una cuenta administradora. El JSON preparado está en [.github/proteccion-main.json](https://github.com/nahumsvr/blackjack-troyano/blob/t-02-plantilla-proteccion/.github/proteccion-main.json), dentro de la rama de T-02.

Desde la raíz del repositorio, estando en esa rama y con la cuenta administradora:

```powershell
gh api --method PUT repos/nahumsvr/blackjack-troyano/branches/main/protection --input .github/proteccion-main.json
gh api repos/nahumsvr/blackjack-troyano/branches/main/protection
```

Estos comandos de configuración no se han ejecutado. La tarea sigue pendiente hasta comprobar la protección real: un push directo a main debe ser rechazado y un PR no debe fusionarse sin una aprobación de otro dev.

## Las 19 tareas de Hector

| Tarea | Dependencia declarada | Estado |
|---|---|---|
| T-01 | — | Implementada; PR #1 pendiente de revisión/fusión |
| T-02 | T-01 | Preparación publicada; protección pendiente, PR #2 |
| T-06 | T-01 | Implementada; prueba visual pendiente, PR #3 |
| T-07 | T-03, T-06 | Pendiente de contrato y revisión de T-06 |
| T-08 | T-05, T-07 | Pendiente de BD y enrutador |
| T-09 | T-08 | Pendiente de autenticación |
| T-15 | T-03 | Pendiente del contrato |
| T-16 | T-15 | Pendiente de Carta y Baraja |
| T-17 | T-16 | Pendiente de Mano y Dealer |
| T-18 | T-09, T-16 | Pendiente de mesas y manos |
| T-19 | T-18 | Pendiente de máquina de estados |
| T-20 | T-18, T-22 | Pendiente de máquina de estados e interfaz Billetera |
| T-21 | T-17, T-23 | Pendiente de reglas y BilleteraSQL |
| T-26 | T-20 | Pendiente de acciones |
| T-36 | T-19, T-08 | Pendiente de relojes y autenticación |
| T-37 | T-07 | Pendiente del enrutador |
| T-38 | T-10 | Pendiente de Vite |
| T-45 | T-43 | Pendiente del congelamiento |
| T-55 | T-54 | Pendiente del zip |

Se dejaron borradores locales de descripción de PR para las 19 tareas con sus criterios originales. Las 16 tareas restantes no están implementadas; no se añadieron extras ni se sustituyeron dependencias con contratos inventados.
