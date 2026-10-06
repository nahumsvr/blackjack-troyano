# Correcciones de la revisión del PR #23

Revisión de Nahum del 6 oct 2026 a las 03:24 UTC (**5 oct, 21:24 CDMX**). La rama se actualizó sobre `main` en `af772d8`, que incorpora Carta/Baraja de PR #25 y Mano/Dealer de PR #27, fusionado durante esta revisión. Se conservan las decisiones de alcance del líder.

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
| Resumen omitía PR #16/#17 | Se añaden ambos, además de PR #25/#27, sin cerrar criterios que requieren aprobación independiente. |
| Fecha/hito confundían UTC con CDMX | Registro normalizado y ordenado por fecha local. A las 03:24 UTC del 6 aún era el 5 en CDMX: H4, con semáforo rojo por hitos incumplidos. |

## Evidencia del entorno objetivo

Se descargó Bun 1.3.13 aislado, sin modificar la versión global. Las pruebas usaron PostgreSQL 16.15 en la base exclusiva `blackjack_pruebas`, con puerto local 5433 por el conflicto documentado. No se ejecutó `db:reset`; cada suite eliminó su schema aleatorio.

| Código comprobado | Resultado con Bun 1.3.13 |
|---|---|
| Copia extraída de la corrida histórica basada en `831dcd2`, más cambios locales del empaquetador | Instalación con lockfile fijo, typecheck, 203 pruebas / 3,402 aserciones y build correctos; cero fallos/omisiones |
| Primera comprobación de PR #23 sobre `83165c6` (incluye Carta/Baraja) | Instalación con lockfile fijo, typecheck, 208 pruebas / 3,438 aserciones y build correctos; cero fallos/omisiones |

| Rama actual de PR #23 sobre `af772d8` (incluye también Mano/Dealer) | Typecheck, 224 pruebas / 3,497 aserciones y build del cliente correctos; cero fallos/omisiones |

Estas comprobaciones resuelven la diferencia de versiones señalada. No convierten la copia histórica en el ZIP final ni acreditan instalación independiente o juego con tres laptops. T-15/T-16 sí se marcan: su código está fusionado y sus pruebas verifican cartas únicas/umbral de rebarajado y dieciséis casos de manos/dealer del criterio.

En la primera revisión, la base era 15/57 (Hector 6/19, H1 9/14, H2 5/19). PR #26 conserva sus capturas y añade T-06 al incorporarse; la cuenta actual se registra en la segunda revisión siguiente.

## Segunda revisión — 6 oct 2026 CDMX

Se conservaron los cambios remotos que integran `main` en `c2daf78` (PR #20). Se elimina la duplicación de filas T-07/T-15/T-16, se ordena todo el registro por fecha local y se incluye PR #20 en el resumen. Verificación directa: las filas de datos son únicas y sus fechas no decrecen.

Hoy corresponde H5, martes 6; la conversión UTC de la revisión anterior del lunes permanece como dato histórico. El encabezado de pendientes se actualiza a la fecha actual.

T-54 se marca por su código fusionado y criterio comprobado: Bun 1.3.13 generó `blackjack-equipo.zip`, 124 archivos/272,903 bytes, y `unzip -t` del sistema pasó. La base documental cuenta16/57 (28 %), Massimo8/19 (42 %), H5 1/5. T-06 añade una tarea en su PR de evidencia; T-48/T-55 no se cierran.

Gate de la rama actual con PR #20: Bun 1.3.13/PostgreSQL 16.15, typecheck y **234 pruebas /3,526 aserciones**, cero fallos/omisiones. El build del cliente ya fue comprobado sobre `af772d8`; PR #20 solo añade empaquetado/seguimiento, sin modificar el cliente.
