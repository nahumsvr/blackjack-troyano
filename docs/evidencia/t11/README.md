# Verificación visual T-11 — 6 oct 2026 CDMX

Prueba manual en el navegador, sin `?mock=1`: servidor Bun (`:3000`) y cliente Vite (`:5173`) de la rama `t-11-verificacion-reanudar` (basada en `main` `001bbb4`), con PostgreSQL 16 en Docker. Usuario nuevo `nahum` registrado desde la pantalla de acceso.

## Pasos y resultado

| # | Paso | Captura | Resultado |
|---|---|---|---|
| 1 | Registro y llegada al lobby | [t11-1-conectado.png](t11-1-conectado.png) | Indicador «Conectado», «Hola, nahum», 500 fichas. |
| 2 | `Ctrl+C` al servidor, sin recargar la página | [t11-2-reconectando.png](t11-2-reconectando.png) | Indicador «Reconectando…» (punto ámbar); usuario y saldo siguen en pantalla. |
| 3 | Se vuelve a lanzar el servidor | [t11-3-reconectado.png](t11-3-reconectado.png) | Vuelve solo a «Conectado», mismo usuario y mismas 500 fichas, sin pasar por el login. |

Cumple el criterio de T-11: con la app abierta, al reiniciar el servidor el cliente muestra «reconectando» y vuelve solo, con la misma sesión, sin recargar.

## Aclaración: «Cargando mesas…» y el aviso rojo

En las tres capturas el lobby queda en «Cargando mesas…» y en la tercera aparece «Ocurrió un error interno; intenta de nuevo». No es un fallo de la sesión ni de T-11: `main` aún no tiene el handler de `lobby.listar` (lo aporta T-09, PR #22, sin fusionar), así que el servidor responde `ERROR_INTERNO`. El aviso sale en la captura 3 porque el lobby vuelve a pedirse tras cada reconexión (`PantallaLobby.tsx`), por diseño. La pantalla de mesas conectada al servidor real es T-13.

## Complemento automatizado

`client/test/reconexionReal.test.ts` repite el mismo escenario con las clases reales del cliente contra el servidor autenticado y PostgreSQL 16, y comprueba además que `reanudar` se envió y que una intención protegida funciona tras reconectar. Las capturas muestran la interfaz; la prueba, el protocolo.
