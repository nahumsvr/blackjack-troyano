# ESTADO — ¿Dónde vamos?

_Última actualización: jue 1 oct 2026_

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

- T-01 pendiente de publicacion y revision; aun no fusionada en main.
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

| 2026-10-01 | Hector: T-01 preparada localmente en t-01-monorepo-bun. bun install en clon limpio y typecheck correctos. Sin tests aun. Pendiente PR; no se contabiliza como fusionada. |
| 2026-10-01 | Hector: plantilla T-02 preparada en t-02-plantilla-proteccion. Nahum aplicara la proteccion de main; pendiente comprobar rechazos y registrar PR. |
