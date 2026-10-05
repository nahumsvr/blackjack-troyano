# ESTADO — ¿Dónde vamos?

_Última actualización: dom 4 oct 2026, 23:30 CDMX (auditoría de Massimo; detalle en [Avance-M-02.md](Avance-M-02.md))_

## Resumen

El congelamiento de features (dom 4 oct, 22:00) pasó sin que el Hito 1 esté completo en `main`. Solo T-01 cumple su criterio con PR fusionado. El camino crítico **T-01 → T-03 → T-07 → T-18 → T-20 → T-31** está detenido en T-03: el contrato, la BD y la economía están en el **PR #4**, que sigue abierto y sin revisión. Hasta que se fusione, no se desbloquean T-07, T-15, T-11 ni T-12.

Fuera de `main` hay trabajo verificado (T-03, T-04/T-05, T-22–T-25 y T-34; ver [Avance-M-01.md](Avance-M-01.md)). En GitHub no hay avances publicados de enrutador, autenticación, juego ni cliente. Si existen avances locales sin publicar, conviene subirlos para auditarlos.

## Hito actual

**Por calendario: Hito 3 — dom 4 oct** (tienda, inventario, desconexiones, validaciones y congelamiento). Mañana inicia el Hito 4 (lun 5 oct: solo pruebas, bugs y documentación).

Estado: 🔴 **Atrasados**. No se cumplieron el Hito 1 (30 sep), el Hito 2 (3 oct) ni el Hito 3/congelamiento (4 oct 22:00).

> Semáforo: 🟢 a tiempo · 🟡 en riesgo (una tarea del camino crítico con > medio día de atraso) · 🔴 atrasados (el hito no se cumple en su fecha)

**Decisión pendiente del líder:** el cronograma restante (Hito 4 lun 5, Hito 5 mar 6 y entrega mié 7 a las 13:00) ya no deja margen. PLAN §10 indica aplicar el **criterio de corte** en este orden: extras → temas de mesa → cosméticos visibles para otros → tienda completa. Sugerencia: el equipo debe decidir antes de seguir si mueve el congelamiento, aplica los cortes 1–4 desde ahora y si reasigna tareas del camino crítico (PLAN §9: "se reasigna en la revisión diaria"). Esta auditoría no toma esa decisión.

## Avance

Solo se cuentan tareas con PR fusionado en `main` y criterio de "hecho" comprobado.

| Dev | Completadas | Total | % |
|---|---|---|---|
| Hector | 1 | 19 | 5 % |
| Nahum | 0 | 17 | 0 % |
| Massimo | 0 | 19 | 0 % |
| Equipo | 0 | 2 | 0 % |
| **Total** | **1** | **57** | **2 %** |

Avance por hito: H1 1/14 (7 %) · H2 0/19 · H3 0/10 · H4 0/8 · H5 0/5 · Entrega 0/1

Preparadas fuera de `main` (no cuentan): T-03, T-04, T-05, T-14, T-22, T-23, T-24, T-25, T-34 (PR #4); borradores de T-32, T-46, T-48, T-50 y T-54 (PR #4). Fusionadas con un gate pendiente: T-02 (protección) y T-06 (prueba visual).

## Bloqueos activos

- **PR #4 sin revisión** (T-03, T-04/T-05, T-22–T-25, T-34): bloquea T-07 y T-15 (Hector) y T-11 y T-12 (Nahum). T-08 también depende de T-05. Requiere la aprobación de otro dev. Es grande (~1,900 líneas), así que conviene revisarlo por carpeta: Hector `shared/` + `store/`, y Nahum `shared/` desde el punto de vista del cliente.
- **T-02 — `main` sin protección:** la API de GitHub devuelve `protected:false` y no hay rulesets. Tres commits de documentación entraron directo a `main`. Requiere una cuenta administradora (Nahum) y el JSON de `.github/proteccion-main.json`.
- **T-06 — prueba visual:** falta abrir `scripts/verificar-ws.html` en tres pestañas y anotar el resultado.
- ~~**T-04 — PostgreSQL 16 sin Docker.**~~ Resuelto el 4 oct a las 23:45: T-04, T-05 y la suite de economía pasan en el entorno objetivo (Bun 1.3.13 + PostgreSQL 16.15). Solo falta fusionar el PR #4.
- **T-35** espera `GestorMesas` (T-09/T-18). **T-31** espera T-20, T-21, T-28 y T-24.

## Hoy le toca a… (lun 5 oct)

- **Hector:** revisar el PR #4 (`shared/` y `store/`) → T-07 enrutador → T-15 Carta/Baraja. Hacer la prueba visual de T-06. T-07 y T-15 están en el camino crítico.
- **Nahum:** aplicar la protección de `main` (T-02) → T-10 Vite/React (desbloqueada: solo depende de T-01) → T-12 mock tras fusionar el PR #4. T-33 guion no tiene dependencias.
- **Massimo:** conseguir la aprobación y fusión del PR #4 (ya con evidencia en el entorno objetivo) → preparar los handlers de economía para conectarlos al enrutador de T-07 → coordinar la decisión de corte con el equipo.

## Registro diario

| Fecha | Nota |
|---|---|
| 2026-09-29 | Plan aprobado: `PLAN.md`, `TAREAS.md`, `ESTADO.md`, `CHECKLIST_ENTREGA.md`, `CLAUDE.md` creados. 57 tareas, 0 % completado. |
| 2026-10-01 | Hector: T-01 preparada localmente en t-01-monorepo-bun. bun install en clon limpio y typecheck correctos. Sin tests aun. PR #1 abierto; no se contabiliza como fusionada. |
| 2026-10-01 | Hector: plantilla T-02 publicada en PR #2 (borrador). Nahum aplicara la proteccion de main; pendiente comprobar rechazos. |
| 2026-10-01 | Hector: T-06 publicada en PR #3 (borrador). Tipos y 3 pruebas WebSocket correctos. Pendiente verificacion visual y revision; bienvenida confirmada y documentada en PLAN.md. Avance-H-01.md publicado para contexto del equipo. |
| 2026-10-04 | Massimo: T-03, T-04/T-05, T-22–T-25 y servicios T-34 preparados localmente; suite conjunta typecheck + 70 tests/381 aserciones con PostgreSQL real. README/manual/arquitectura y empaquetador preparados parcialmente. Ver Avance-M-01.md. |
| 2026-10-04 | Massimo: trabajo anterior publicado en PR #4 (abierto, sin revisión). |
| 2026-10-04 | T-01 hecha por Hector (PR #1); auditoría en clon limpio de main. T-02: main sin protección. T-06: falta prueba visual. Congelamiento no alcanzado; avance 1/57 (2 %). Ver Avance-M-02.md. |
| 2026-10-04 | Massimo: entorno objetivo verificado (Bun 1.3.13 + PostgreSQL 16.15, clon limpio). Gates de T-04 y T-05 cumplidos y 70 pruebas sin fallos; se cuentan al fusionarse el PR #4. |
