# Correcciones de la revisión del PR #23

Revisión de Nahum del 6 oct 2026 a las 03:24 UTC (**5 oct, 21:24 CDMX**). La rama se actualizó sobre `main` en `83165c6`, que incorpora Carta/Baraja de PR #25. Se conservan las decisiones de alcance del líder.

| Observación | Corrección o comprobación |
|---|---|
| Dependencia auth/router invertida | El flowchart muestra AUTH → ROUTER. Se elimina la dependencia de clase Enrutador → Sesiones: el adaptador es la función `crearEnrutadorAutenticado`. |
| Aviso de lobby incorrecto | README/manual indican `ERROR_INTERNO` y el texto público real; no existe un mensaje específico de función pendiente. |
| Bun probado diferente al fijado | Se repitió instalación, typecheck, suite SQL y build con Bun 1.3.13 en la copia extraída y en esta rama. |
| Comando de tests inconsistente | El manual usa `bun run test`, igual que README/package.json, y describe todas las suites. |
| Cierre de arquitectura desactualizado | Enumera enrutador/auth/baraja y sus pruebas reales; lo pendiente corresponde a clases de mesa, integración y aceptación. |
| Validación de 16 KB/auth presentada como futura | Se atribuye a T-07/T-08 ya implementadas; ritmo 20/s y permisos de juego conservan su estado pendiente. |
| T-08 hecha junto a preparación pendiente | Las notas previas se identifican como preparación histórica; el cierre es la fusión de PR #19. |
| T-11 decía que reanudar no existía | T-08 ya está fusionada; T-11 requiere su criterio del cliente sobre código integrado. |
| Resumen omitía PR #16/#17 | Se añaden ambos, además del nuevo PR #25, sin cerrar criterios que requieren aprobación independiente. |
| Fecha/hito confundían UTC con CDMX | Registro normalizado y ordenado por fecha local. A las 03:24 UTC del 6 aún era el 5 en CDMX: H4, con semáforo rojo por hitos incumplidos. |

## Evidencia del entorno objetivo

Se descargó Bun 1.3.13 aislado, sin modificar la versión global. Las pruebas usaron PostgreSQL 16.15 en la base exclusiva `blackjack_pruebas`, con puerto local 5433 por el conflicto documentado. No se ejecutó `db:reset`; cada suite eliminó su schema aleatorio.

| Código comprobado | Resultado con Bun 1.3.13 |
|---|---|
| Copia extraída de la corrida histórica basada en `831dcd2`, más cambios locales del empaquetador | Instalación con lockfile fijo, typecheck, 203 pruebas / 3,402 aserciones y build correctos; cero fallos/omisiones |
| Rama de PR #23 actualizada sobre `83165c6` (incluye Carta/Baraja) | Instalación con lockfile fijo, typecheck, 208 pruebas / 3,438 aserciones y build correctos; cero fallos/omisiones |

Estas comprobaciones resuelven la diferencia de versiones señalada. No convierten la copia histórica en el ZIP final ni acreditan instalación independiente o juego con tres laptops. T-15 sí se marca: su código está fusionado y sus cinco pruebas verifican el criterio de cartas únicas y umbral de rebarajado.

Antes de integrar la documentación, actualizar PR #26 sobre esta rama y conservar sus capturas/criterios sin reintroducir los textos anteriores. La nueva cuenta base es 14/57 (Hector 5/19, H1 9/14, H2 4/19); la evidencia T-06 de #26 añade una tarea más al incorporarse.
