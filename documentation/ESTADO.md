# ESTADO — ¿Dónde vamos?

_Última actualización: dom 4 oct 2026_

## Sesión local del 4 de octubre

T-03 y la base de datos/economía avanzaron localmente; contrato, SQL y servicios están verificados. No se crearon PR nuevos ni se fusionaron estas tareas. Véase [Avance-M-01.md](Avance-M-01.md) para archivos, evidencia y pendientes.

El historial local ya contiene las fusiones de PR #1, #2 y #3. Las notas anteriores que los indican abiertos están desactualizadas. Los contadores de abajo son históricos y requieren auditar sus criterios antes de recalcular: no se comprobó protección efectiva de main (T-02) ni el gate visual de tres pestañas de T-06 en esta sesión. Las casillas nuevas se conservan abiertas hasta sus gates y revisión/fusión.

**Bloqueos actuales:** acceso al daemon Docker para PostgreSQL 16; revisión/fusión de la base local; T-07/T-08/T-18 y cliente para integrar economía; T-35 espera GestorMesas. Pruebas locales con Bun 1.4.2/PostgreSQL 18.6; objetivo documentado Bun 1.3.13/PostgreSQL 16. El juego de tres usuarios y la fecha de congelamiento requieren evaluación del líder con este estado real.

## Hito actual

**Hito 1 — mié 30 sep:** monorepo, Docker, esquema de BD, tipos compartidos, login y 3 pestañas conectadas al lobby.

Estado: 🔴 **Atrasados** (Hito 1 no completado en main al 30 sep; T-01 verificada localmente, pendiente PR).

> Semáforo: 🟢 a tiempo · 🟡 en riesgo (una tarea del camino crítico con > medio día de atraso) · 🔴 atrasados (el hito no se cumple en su fecha)

## Avance

| Dev | Completadas | Total | % |
|---|---|---|---|
| Hector | 0 | 19 | 0 % |
| Nahum | 0 | 17 | 0 % |
| Massimo | 0 | 19 | 0 % |
| Equipo | 0 | 2 | 0 % |
| **Total** | **0** | **57** | **0 %** |

Avance por hito: H1 0/14 · H2 0/19 · H3 0/10 · H4 0/8 · H5 0/5 · Entrega 0/1

## Bloqueos activos

- T-01 publicada en PR #1; pendiente revision y fusion en main.
- T-02: la proteccion de main la configurara Nahum con permisos administrativos.
- T-07 y T-15 dependen de T-03; T-08 tambien de T-05; ambas son entregas de Massimo. T-06 depende solo de T-01.

## Hoy le toca a…

- **Hector:** T-01 monorepo con workspaces → T-02 repo en GitHub con `main` protegida.
- **Nahum:** leer `PLAN.md` §3 (protocolo) y bocetar login, lobby y mesa; mañana T-10 → T-12.
- **Massimo:** T-03 contrato `shared/` (puede empezar en una carpeta aparte y moverlo cuando T-01 esté en `main`).

## Registro diario

| Fecha | Nota |
|---|---|
| 2026-09-29 | Plan aprobado: `PLAN.md`, `TAREAS.md`, `ESTADO.md`, `CHECKLIST_ENTREGA.md`, `CLAUDE.md` creados. 57 tareas, 0 % completado. |

| 2026-10-01 | Hector: T-01 preparada localmente en t-01-monorepo-bun. bun install en clon limpio y typecheck correctos. Sin tests aun. PR #1 abierto; no se contabiliza como fusionada. |
| 2026-10-01 | Hector: plantilla T-02 publicada en PR #2 (borrador). Nahum aplicara la proteccion de main; pendiente comprobar rechazos. |
| 2026-10-01 | Hector: T-06 publicada en PR #3 (borrador). Tipos y 3 pruebas WebSocket correctos. Pendiente verificacion visual y revision; bienvenida confirmada y documentada en PLAN.md. Avance-H-01.md publicado para contexto del equipo. |

| 2026-10-04 | Massimo: T-03, T-04/T-05, T-22–T-25 y servicios T-34 preparados localmente; suite conjunta typecheck + 70 tests/381 aserciones con PostgreSQL real. README/manual/arquitectura y empaquetador preparados parcialmente. Sin PR/fusión; Docker PG16, router/game/client, revisiones y pruebas independientes pendientes. Ver Avance-M-01.md. |
