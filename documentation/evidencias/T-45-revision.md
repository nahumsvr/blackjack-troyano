# T-45 — preparación y revisión de documentación

Fecha: 2026-10-06 CDMX. Autor: Hector. Base: `main` `8bfe554`.
Rama: `t-45-jsdoc-servidor`. Revisión local realizada por Codex; no sustituye la revisión de Massimo.

## Alcance

Se revisaron los 18 archivos de `server/src/game`, `server/src/ws` y `server/src/auth`.
Se completaron descripciones, parámetros, retornos y errores propagados; se separaron
las etiquetas que compartían línea para que TypeScript las interprete individualmente.
Se documentaron las interfaces de reloj, callbacks de sesión, servicios de mesa y fábrica.
Las fábricas de handlers distinguen creación de ejecución: los errores de las intenciones
los responde el enrutador. El apagado exige esperar pagos e historial antes de cerrar SQL.

## Validación

- Auditoría con la API de TypeScript 5.9.3: **116 declaraciones públicas**, cero omisiones.
  Incluye exportaciones, constructores, métodos y getters públicos, firmas de interfaces,
  callbacks públicos y la fábrica de mesas. Verifica descripción, cada `@param` y `@returns`
  en las firmas; los errores y efectos secundarios se revisaron leyendo la implementación.
- Los 18 archivos tienen cabecera de propósito.
- Comparación del código mediante el printer de TypeScript sin comentarios contra la base:
  misma estructura ejecutable en los 18 archivos, normalizando CRLF/LF de Windows.
- `bun run typecheck`: correcto en shared, server, client y scripts.
- `bun test ./server/test ./client/test`, con `TEST_DATABASE_URL` y Bun 1.3.13:
  **363 correctas, 1 omitida, 0 fallos; 4,619 aserciones en 38 archivos**.
  La prueba omitida corresponde a un enlace a archivo del empaquetador en Windows.
- `git diff --check`: sin errores.

## Code review

Se verificó que los comentarios coincidan con el comportamiento: copia de contenedores
frente a manos compartidas, retorno sin valor, UUID nulo en ESPERANDO, plazo de fase
frente a reservas, cola que absorbe rechazos y errores de suministro propagados al dealer.
Se corrigieron las descripciones ambiguas y los errores transitorios omitidos.
No quedaron hallazgos pendientes en el diff de T-45; no hubo cambios de lógica,
protocolo, esquema ni configuración.

## Cierre pendiente

T-43 todavía no está acreditada ni existe el tag `v0.9-congelado` al preparar este trabajo.
T-45 sigue abierta. Tras el congelamiento, reauditar la versión final y los cambios
posteriores a esta base, incluidos los PR de T-37/T-38, y obtener la revisión de Massimo.
Esta evidencia no acredita pruebas de aceptación en tres laptops ni aprobación de otro dev.

## Correcciones de revisión de PR #48 (2026-10-07 CDMX)

La auditoría inicial no detectó frases absorbidas por etiquetas ni todas las diferencias
entre comentarios y comportamiento. Esta revisión corrige los diez puntos recibidos:

| Comentario | Resolución |
|---|---|
| Descripción de pedir/apuesta absorbida por @param | Frases movidas antes del primer parámetro, como sugirió el revisor. |
| Apagado promete reintentos inexistentes | Documentación de Mesa, GestorMesas, aplicación y guardarRonda ajustada: un único intento adicional al cerrar; cualquier fallo SQL puede rechazar. No se agrega una política nueva de reintentos. |
| esperarOperaciones no liquida rondas | JSDoc indica su alcance y remite expresamente a cerrar(), según la alternativa propuesta. |
| Fallo de alCerrar interrumpe revocación | Identidad retirada en finally; invalidación continúa con las demás pestañas y registra cada fallo. |
| NO_AUTENTICADO omitido | Añadido a registrar/login/validar en Sesiones. |
| Fallo de alAutenticar deja identidad vinculada | Revierte identidad, suscripciones, registro de conexiones y timer antes de propagar el error. |
| Error del logger/envío rechaza manejar | Aislamiento dentro del enrutador, como alternativa sugerida; compatible con el arreglo de T-37. |
| barajar perdió su precondición | Restaurada la prohibición de rebarajar durante una mano; describe el uso condicional antes del reparto. |
| Dealer.jugar no se usa en producción | Mesa delega en Dealer.jugar y publica tras cada carta incorporada. |
| Faltan @throws en fábricas | Restauradas etiquetas con ErrorJuego y códigos, aclarando que ocurren al ejecutar handlers. |

Este seguimiento incluye correcciones de comportamiento, no solo comentarios. No cambia
el contrato, el esquema SQL ni los pagos. Se añadieron regresiones de revocación en dos
pestañas con callback fallido, vinculación fallida seguida de reanudación y logger fallido.

Validación de las correcciones: `bun run typecheck` correcto; suite completa con PostgreSQL
y Bun 1.3.13: **366 correctas, 1 omitida por plataforma, 0 fallos**, 4,627 aserciones
en 38 archivos. Las 23 pruebas de enrutador/Dealer también pasan por separado.
Code review final: se verificaron limpieza en finally, continuidad de revocación,
correlación de errores, publicación posterior a cada carta y alcance real del apagado.
Sin hallazgos pendientes en este diff; la aprobación externa y reauditoría tras T-43 siguen pendientes.
