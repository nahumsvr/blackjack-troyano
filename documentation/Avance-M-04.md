# Avance de Massimo — empaquetado y documentación (5 oct 2026 CDMX)

Trabajo adelantado desde `main` en `831dcd2`, después de fusionar T-08 (PR #19). La autenticación y el enrutador ya están disponibles; las mesas y partidas todavía no lo están.

## Empaquetado T-54

- `.gitignore` omite `.empaquetar-*`, que puede quedar tras una interrupción del empaquetador.
- El script exige también lockfile, configuración de Bun, Compose y ambos scripts SQL antes de producir el ZIP.
- La corrida histórica del **5 oct CDMX**, basada en `main` **`831dcd2`** más cambios locales del empaquetador, produjo un archivo ZIP real: 115 archivos, 255,142 bytes; `unzip` confirmó su integridad. Sin `.env`, `.git`, `node_modules` ni `dist`.
- Se extrajo en una carpeta temporal independiente y `bun install --frozen-lockfile` instaló las dependencias sin modificar el lockfile.
- En esa copia extraída de la corrida del **5 oct**, typecheck, 203 pruebas con PostgreSQL 16.15 (3,402 aserciones, cero fallos) y build del cliente pasaron. Bun usado: 1.4.2; Bun 1.3.13 tiene evidencia anterior en Avance-M-02/03.

Las cifras de 115 archivos, 255,142 bytes y 203 pruebas pertenecen únicamente a esa corrida histórica: **no son evidencia de aceptación del ZIP final** y no cierran T-54, T-48 ni T-55. Regenerar y verificar el artefacto final después de integrar las siguientes tareas y coordinar la instalación independiente.

### Corrección de revisión del PR #20 (5 oct CDMX)

La selección usa rutas lógicas POSIX para el listado y comparaciones del ZIP; las operaciones de disco conservan `node:path.join` nativo. El parser admite listados con LF o CRLF. Los requisitos y sus alternativas se declaran una sola vez y de ellos se deriva la selección raíz: se acepta `bun.lock` o `bun.lockb`, y cualquiera de `compose.yaml`, `compose.yml`, `docker-compose.yaml` o `docker-compose.yml`.

Diez pruebas automáticas generan ZIPs reales en fixtures temporales. Comprueban fuentes anidadas con `/`, contenido/exclusiones, las alternativas de lockfile/Compose, rechazo de enlaces y error ante schema, manual, lockfile o Compose ausentes. Ante estos fallos se conserva el ZIP anterior. Los fixtures no usan ni reinician PostgreSQL.

Validación de esta corrección: `bun run typecheck` y suite completa en verde con Bun 1.4.2 y PostgreSQL 16.15 mediante `TEST_DATABASE_URL`, **213 pruebas, 3,431 aserciones y cero fallos**. La BD no se reinició; las suites SQL emplearon schemas aislados. Este resultado corresponde al código de la revisión, no a una instalación del ZIP final.

Estas pruebas se ejecutaron en **Linux**: verifican la representación portable de rutas y el empaquetado observado allí; **no acreditan ejecución nativa en Windows**, instalación del ZIP final ni los gates de T-54/T-55.

## Auditoría adelantada T-46

Se revisaron 26 declaraciones públicas de clases, funciones, constructores y métodos en `shared/`, `server/src/db/` y `server/src/store/`. Todas tienen JSDoc. Esto no marca T-46 como hecha: su revisión por Hector y dependencia T-43 siguen pendientes; volver a incluir los nuevos handlers en esa revisión cuando estén integrados.

## Próximos pasos

1. Revisar e integrar los handlers WebSocket de economía en su PR propio; incluir revisión de Hector por los cambios de auth/servidor.
2. Actualizar README, manual y arquitectura para reflejar T-07/T-08 ya fusionadas.
3. Hector: T-09 y motor T-15–T-21; con `GestorMesas` se desbloquean T-35 y las pruebas de rondas.
4. Con T-38 disponible, cerrar manual, regenerar ZIP y coordinar la instalación independiente y T-55.

Se conserva el alcance aprobado. Las casillas cuyo criterio requiere otras personas o módulos siguen abiertas.
