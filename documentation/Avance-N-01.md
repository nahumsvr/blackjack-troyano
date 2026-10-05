# Avance-N-01 — Nahum

Fecha: domingo 4 (22:13) a lunes 5 de octubre de 2026. Contexto: PLAN.md, TAREAS.md, ESTADO.md, CLAUDE.md, Avance-H-01.md, Avance-M-01.md y Avance-M-02.md. Se trabajó en las tareas de Nahum (`client/`), en el gate de T-02 (la protección de `main` requería la cuenta administradora de Nahum) y en el seguimiento del proyecto.

## 1. Cómo encontré el proyecto (dom 4 oct, 22:13)

- **`main` en GitHub** (`2f96038`) tenía fusionados los PRs #1 (T-01), #2 (T-02) y #3 (T-06). El `main` local estaba atrasado.
- **`main` sin protección:** la API respondía 404 y había commits de documentación hechos directo a `main`. T-02 no podía cerrarse sin la cuenta administradora de Nahum.
- **`shared/` vacío en `main`:** el contrato (T-03) de Massimo todavía no estaba publicado. Llegó después en el PR #4, abierto y sin revisión.
- **Cliente inexistente:** solo había `client/src/index.ts` provisional. Ninguna de las 17 tareas de Nahum tenía código.
- **Calendario:** el congelamiento (dom 4 oct, 22:00) ya había pasado. Avance contable: 1/57 (solo T-01). Semáforo 🔴.

## 2. Qué se hizo en cada tarea

Cada PR tiene commits atómicos: cada commit compila y pasa sus pruebas. Todo el cliente se verificó en el navegador contra el mock (`?mock=1`), porque el servidor todavía no tiene enrutador, autenticación ni mesa.

### T-02 · Protección de `main` (gate pendiente de Hector) — ✅ hecha

- **Protección aplicada** con `.github/proteccion-main.json`, más historial lineal:
  - 1 aprobación de otro dev, que también aplica a administradores;
  - sin force-push ni borrado.
- **Repositorio:** solo fusiones con squash y borrado automático de la rama al fusionar, para mantener el árbol limpio.
- **Verificación:** un push directo de prueba a `main` fue rechazado con `GH006: Protected branch update failed … Changes must be made through a pull request`. `main` no cambió.

### T-10 · Esqueleto del cliente — PR #6 ✅ fusionado (gate pendiente)

- **Contenido:**
  - Vite 7 + React 19 + Tailwind 4 (sin archivo de configuración), con versiones fijas;
  - proxy de `/ws` a `:3000` y `vite --host`;
  - `config.ts` construye la URL del WebSocket desde el host, así sirve igual en desarrollo y cuando Bun sirva el build (T-38);
  - `LimiteErrores` mínimo.
- **Verificación:** typecheck, build y la `bienvenida` del servidor de T-06 a través del proxy.
- **Pendiente:** abrir la app desde otra laptop por IP. Por eso queda sin marcar en TAREAS aunque está fusionada.

### T-11 · Capa de red y store — PR #7

- **`Transporte`:** interfaz común de la conexión real y del mock.
- **`Conexion`:**
  - reconexión a los 1, 2, 4, 8 y 10 s;
  - `reqId` con timeout de 8 s;
  - nada se encola sin conexión;
  - validación Zod de entrada y salida.
- **Reloj:** desfase con el servidor por `ping`/`pong` (algoritmo de Cristian).
- **Token:** en `localStorage`, con respaldo en memoria si el navegador lo bloquea.
- **Reductor puro y controlador:**
  - al conectar envía `reanudar` y `ping`;
  - `SESION_INVALIDA` y `NO_AUTENTICADO` cierran la sesión;
  - `NO_ESTAS_EN_MESA` deja la mesa en modo espectador.
- **Verificación:** 45 pruebas. La reconexión se probó reiniciando el servidor de T-06; las esperas medidas fueron 2, 4 y 8 s.
- Usa el `shared/` del PR #4 tal cual.

### T-12 · Mock del servidor — PR #8

- **`ServidorFalso`:** mismas validaciones del contrato (fase, turno, saldo, límite diario, clave repetida) y latencia simulada.
- **Fixtures:** las 6 fases, comprobadas contra los esquemas de `shared`.
- **Validación de formularios** con los esquemas del contrato.
- **Pantallas base:** acceso, lobby, mesa e historial.
- **Barra del modo mock:** fases y caída simulada.
- **Verificación:** recorrido completo sin backend; un doble clic en comprar cobra una sola vez; apuestas inválidas no se envían.

### T-27 · Componentes de la mesa — PR #9 (avance)

- **Componentes:** `Carta` (CSS), `Ficha` (SVG), `Asiento`, `ManoDealer` y `MesaVisual`. Paño ovalado con el dealer al centro y los asientos en elipse.
- **Color por asiento:** azul, rosa, naranja, lima y violeta.
- **Pendiente:** página de prueba con las 52 cartas.

### T-30 y T-41 · Billetera e historial — PR #10 (avance)

- **Menú lateral** con pestañas Billetera e Historial, accesible desde el lobby y desde la mesa.
  - Es un diálogo modal: Esc y foco gestionados, inerte cuando está cerrado.
- **Botón de fichas** en el encabezado.
- **Historial compacto** con "Ver más" (`antesDe`, `hayMas`).
- **Pendiente:** probar contra el servidor real (T-24 y `movimientos.listar` conectados al enrutador).

### T-28 · Pantalla de mesa — PR #11 (avance; incluye la animación de cartas de T-27)

- **Temporizador circular:** verde → ámbar → rojo en los últimos 5 s; barra de tiempo en el asiento en turno.
- **Reparto animado:**
  - las cartas vuelan del zapato del dealer boca abajo hasta cada jugador, en orden de casino, y se descubren al llegar;
  - el total va en la esquina superior derecha de la última carta.
- **Jugador propio** abajo al centro y más grande. La mesa gira sin cambiar el orden de los asientos.
- **Selector de fichas** 10/50/100/500 y botones de juego.
- **Panel centrado** con solo las acciones posibles en cada fase, y pistas en el paño ("Haz tu apuesta", "¡Te toca!").
- **Verificación:** 101 pruebas.
- **Pendiente:** prueba con 3 pestañas reales (requiere T-18).

### T-29 · Resultado y avisos — PR #12 (avance)

- **Pantalla de resultado** con fondo translúcido. Entra desde abajo creciendo y sale al revés.
  - Victoria: rayos, confeti, fichas volando y conteo de la ganancia.
  - Empate: chispas y frase de ánimo.
  - Derrota: viñeta y frase de aliento.
- **Píldora** para reabrir el resultado; avisos y saldo animados.
- **Mock:** botones para forzar cada resultado.
- **Verificación:** 116 pruebas.
- **Pendiente:** probar con el servidor real (requiere T-18 y T-20).

### T-42 · Indicadores de conexión (parcial, dentro de T-12 a T-28)

- **Hecho:** indicador propio (conectado / reconectando) en el encabezado y marca de "Desconectado" en el asiento de los demás.
- **Pendiente:** la prueba de apagar el Wi-Fi con 3 laptops (requiere T-36). No tiene PR propio.

### Seguimiento — PR #13

- **`ESTADO.md` recalculado:** 8/57 (14 %), semáforo, bloqueos y "hoy le toca".
- **`TAREAS.md`, en el formato del equipo** (nota con fecha bajo cada tarea):
  - T-02 marcada hecha.
  - T-04, T-05, T-23, T-24, T-25 y T-34 marcadas según Avance-M-02, que indicaba marcarlas al fusionarse el PR #4.
  - T-10 desmarcada mientras falte su gate.
  - T-12 desmarcada: su criterio pide ver la tienda en el mock y esa pantalla es T-39, que está pospuesta.
  - Notas de avance en T-11, T-12, T-13, T-27–T-30, T-41, T-42 y T-47.
  - T-39 y T-40 marcadas como ⏸ pospuestas, pendiente de la decisión de corte del equipo.
  - T-38 marcada como desbloqueada.
- **Documentación existente:**
  - `README.md`: estado actual, `bun run dev` con el cliente y `?mock=1`, pruebas del cliente y build.
  - `docs/manual-instalacion.md`: cliente en el puerto 5173, uso desde otra laptop y firewall.
  - `docs/arquitectura.md`: fila de `client/`.
- **Este documento.**

## 3. Tareas que desbloqueé

| Tarea | Dueño | Por qué queda desbloqueada |
|---|---|---|
| T-02 | Hector | La protección era lo único que faltaba; ya está aplicada y verificada. |
| T-38 (servir `client/dist`) | Hector | Dependía de T-10, que ya está en `main`. |
| T-13 (lado del cliente) | Nahum | Acceso y lobby listos contra el mock; solo espera al servidor (T-08/T-09). |
| T-31 (integración en 3 laptops) | Massimo | Cuando se fusione el PR #11 queda cubierta su dependencia de T-28. |
| T-49, T-51 (manual y diapositivas) | Nahum | La interfaz está casi final; se pueden tomar capturas desde el mock. |
| Revisión del contrato | Massimo / Hector | El cliente usa `shared/` tal cual. Sirve como comprobación de que el contrato alcanza para dibujar todas las fases. |

## 4. Tareas que me bloquean

| Mi tarea | La bloquea | Dueño | Qué falta |
|---|---|---|---|
| T-13 | T-08, T-09 (y T-07) | Hector | Registro, login, `reanudar` y lobby en el servidor real. |
| T-28 | T-18 (y T-07, T-09) | Hector | Máquina de estados de la mesa enviando `mesa.estado`. |
| T-29 | T-18, T-20 | Hector | Rondas completas con `ronda.resultado`. |
| T-30 | T-24 conectado al enrutador (T-07) | Massimo / Hector | `fichas.comprar` y `billetera` por WebSocket. |
| T-41 | T-34 conectado al enrutador (T-07) | Massimo / Hector | `movimientos.listar` por WebSocket. |
| T-42 | T-36 | Hector | Manejo de desconexiones en el servidor. |
| T-10 (gate) | — | Nahum | Probar desde otra laptop en la misma red. |
| T-39, T-40 | T-34/T-35 + integración T-31 | Massimo / equipo | Pospuestas según el plan; se retoman solo si el núcleo integra. |
| Fusión de #7–#12 | Revisión de otro dev | Hector / Massimo | Una aprobación por PR, en orden. |

## 5. Cómo lo dejé (lun 5 oct)

- **`main`:** protegida, con solo squash. Contiene T-01–T-06, el PR #4 (contrato, BD y economía) y T-10.
- **PRs abiertos y apilados, todos sin conflictos:**

| PR | Rama | Apunta a | Commits | Pruebas del cliente |
|---|---|---|---|---|
| #7 | `t-11-capa-red` | `main` | 8 | 45 |
| #8 | `t-12-mock` | #7 | 6 | 70 |
| #9 | `t-27-componentes-mesa` | #8 | 5 | 77 |
| #10 | `t-30-billetera-historial` | #9 | 4 | 77 |
| #11 | `t-28-pantalla-mesa` | #10 | 7 | 101 |
| #12 | `t-29-resultado-avisos` | #11 | 7 | 116 |
| #13 | `seguimiento-5-oct-nahum` | #12 | solo documentación | — |

- **Comprobaciones:** en todas las ramas, `bun run typecheck` y `bun run build` dan verde y `bun test` da 0 fallos. Las pruebas de Massimo que necesitan PostgreSQL se omiten sin `TEST_DATABASE_URL`.
- **Avance contable:** 8/57 (14 %). Hector 2/19, Massimo 6/19, Nahum 0/17. Ninguna tarea de Nahum cuenta todavía, porque sus PRs no están fusionados o les falta un gate.
- **Respaldo:** las ramas anteriores a la reorganización quedaron solo en la laptop de Nahum, como `respaldo/*`.
- **Conocido:** con `bun run dev`, tras cambiar mucho de rama, Tailwind puede dejar de aplicar estilos en desarrollo. Se arregla reiniciando el servidor; el build no tiene el problema.

## 6. Cómo seguir con el desarrollo

### Fusionar la pila del cliente (en orden)

1. Un dev distinto de Nahum aprueba #7 y lo fusiona con **squash**. GitHub borra la rama y redirige #8 a `main`.
2. Nahum rebasa la rama siguiente quitando los commits que ya entraron con el squash, y la vuelve a publicar:

   ```bash
   git fetch origin
   git rebase --onto origin/main <punta-anterior-de-la-rama-fusionada> <rama-siguiente>
   bun run typecheck && bun test
   git push --force-with-lease origin <rama-siguiente>
   ```

   Se hizo así con #7–#12 tras fusionar #6, sin conflictos. Solo se reescriben ramas de PR; `main` no lo permite.
3. Repetir hasta #13. Al fusionar cada PR, cambiar en TAREAS.md "avance en PR #N" por la marca correspondiente cuando se cumpla su criterio.

### Próximas tareas de Nahum (en orden)

1. **T-10 (gate):** `bun run dev` y abrir `http://<IP>:5173` desde otra laptop de la misma red.
2. **T-27:** página de prueba con las 52 cartas, visible solo en mock (por ejemplo, `?mock=1&cartas=1`).
3. **T-33:** guion de la exposición (`docs/exposicion.md`).
4. **T-49 y T-51:** borradores del manual y de las diapositivas, con capturas del mock.
5. **Con T-07, T-08 y T-09 en `main`:** probar T-13 contra el servidor real, con 3 pestañas y 3 usuarios.
6. **Con T-18 y T-20:** verificar T-28 y T-29 con 3 pestañas reales y hacer la integración T-31 con el equipo.

### Cómo probar el cliente

```bash
bun install
bun run dev
```

Abrir `http://localhost:5173/?mock=1`.

**Datos del mock:**
- Cualquier usuario válido entra.
- El usuario `existe` simula "usuario repetido".
- La contraseña `incorrecta` simula credenciales inválidas.
- La mesa 3 está llena.

**La barra morada (solo en mock):**
- Recorre las 6 fases.
- `Resultado:` fuerza blackjack, gana, empate, pierde o pasado.
- `Simular caída` corta la conexión 3 s.

Sin `?mock=1`, el cliente se conecta al servidor real por `/ws`.

### Lo que el cliente espera del servidor (para Hector y Massimo)

- **`reqId`:**
  - Toda petición con `reqId` debe recibir una respuesta directa que repita ese `reqId`: el mensaje de éxito o un `error`.
  - Sin respuesta en 8 s, el cliente muestra "sin respuesta" y vuelve a habilitar el botón.
- **`error`:**
  - Con `SESION_INVALIDA` o `NO_AUTENTICADO`, el cliente borra el token y vuelve al acceso.
  - Con `NO_ESTAS_EN_MESA`, pasa a modo espectador.
- **`mesa.estado`:**
  - Va "plano": los campos de `MesaEstado` van al nivel superior, como define el contrato.
  - Al volver a `APUESTAS`, el cliente borra el resultado anterior.
- **`ronda.resultado`:** lleva un `rondaId` nuevo en cada ronda.
- **`finEn`:** epoch ms del servidor. El cliente corrige el desfase con `ping`/`pong` (campo `t`).
- **Duración de fase (opcional):** un campo `duracionMs` en el snapshot daría la proporción exacta del temporizador a quien entra a media fase. Hoy se usa lo que faltaba cuando el cliente vio la fase.
- **Del contrato:** el cliente importa `LIMITES_CANTIDAD`, `CantidadApuestaSchema` y `CantidadCompraSchema` de `shared/`. Renombrarlos rompe la validación del cliente.

### Decisiones pendientes del equipo

- **Trabajo visual tras el congelamiento:** las animaciones, el temporizador y el selector de fichas (#11 y #12) se hicieron después del 4 oct, 22:00. Son parte de T-27–T-29 y no de los extras prohibidos, pero el equipo debe aceptar fusionarlos.
- **Criterio de corte (PLAN §10):** sigue pendiente desde la auditoría del 4 oct.
- **Tareas de Massimo por confirmar:** T-03, T-14 y T-22 están en `main`, pero no se marcaron sin su verificación.
