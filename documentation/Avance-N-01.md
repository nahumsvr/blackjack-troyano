# Avance-N-01 — Nahum (cliente)

Fecha: lunes 5 de octubre de 2026. Contexto: PLAN.md, TAREAS.md, ESTADO.md, CLAUDE.md y la auditoría de Massimo del 4 oct. Se trabajó en `client/`, en la protección de `main` (gate de T-02) y en la documentación de seguimiento.

## Resumen

- **Protección de `main` aplicada y verificada:**
  - 1 aprobación de otro dev, también para administradores;
  - historial lineal; sin force-push ni borrado;
  - el repositorio solo permite fusionar con squash y borra la rama al fusionar.
  - Un push directo de prueba fue rechazado ("Changes must be made through a pull request").
- **T-10 (PR #6)** ya está en `main`.
- **El resto del cliente está publicado en PRs apilados**, cada uno con commits atómicos: cada commit compila y pasa sus pruebas.
- **Todo se verificó contra el mock** (`?mock=1`), porque el servidor todavía no tiene enrutador, autenticación ni mesa.

## PRs del cliente (en orden de fusión)

| PR | Rama | Tarea | Contenido |
|---|---|---|---|
| #6 ✅ | — | T-10 | Vite + React + Tailwind, proxy `/ws`, `vite --host`. Fusionado. |
| #7 | `t-11-capa-red` | T-11 | `Transporte`, `Conexion` (reconexión, `reqId`, validación Zod), desfase de reloj, token, reductor, controlador y store. |
| #8 | `t-12-mock` | T-12 | Validación de formularios, `ServidorFalso` con las 6 fases, componentes y pantallas base, modo `?mock=1`. |
| #9 | `t-27-componentes-mesa` | T-27 (avance) | Color por asiento, `Carta`, `Ficha`, `Asiento`, `ManoDealer` y `MesaVisual`. |
| #10 | `t-30-billetera-historial` | T-30 y T-41 (avance) | Historial compacto y menú lateral de billetera e historial, accesible desde lobby y mesa. |
| #11 | `t-28-pantalla-mesa` | T-28 (avance) | Temporizador circular, cartas que vuelan del zapato y se descubren, total sobre la última carta, jugador propio al centro, selector de fichas y panel de acciones. |
| #12 | `t-29-resultado-avisos` | T-29 (avance) | Pantalla de resultado animada por tono, píldora para reabrirla, avisos y saldo animados, resultados forzables en el mock. |

**Cómo se fusionan:** cada PR apunta al anterior. Al fusionar uno con squash:
1. GitHub borra su rama y redirige el siguiente PR a `main`.
2. Ese siguiente PR todavía contiene los commits originales del anterior, así que se rebasa:

```bash
git fetch origin
git rebase --onto origin/main <punta-anterior-de-la-rama-fusionada> <rama-siguiente>
git push --force-with-lease origin <rama-siguiente>
```

Así se hizo con #7–#12 tras fusionar #6, sin conflictos. Solo se reescriben ramas de PR; `main` no admite force-push.

## Cómo probarlo

```bash
bun install
bun run dev
```

Abrir `http://localhost:5173/?mock=1`. Sin `?mock=1`, el cliente intenta conectarse al servidor real por `/ws`.

**Datos del mock:**
- Cualquier usuario válido entra.
- El usuario `existe` simula "usuario repetido".
- La contraseña `incorrecta` simula credenciales inválidas.
- La mesa 3 está llena.
- Solo la mesa 1 tiene juego simulado.

**La barra morada de arriba (solo en mock):**
- Fases: ESPERANDO, APUESTAS, REPARTO, TURNOS, DEALER y PAGOS.
- `Resultado:` fuerza blackjack, gana, empate, pierde o pasado, con su animación y el pago.
- `Simular caída` corta la conexión 3 s para ver la reconexión.

**Comprobaciones:**
- `bun run typecheck`: verde en los 3 paquetes.
- `bun test`: 116 pruebas del cliente en la punta de la pila; las de PostgreSQL de Massimo se omiten sin base de datos.
- `bun run build`: verde.

**Nota:** si `bun run dev` muestra la página sin estilos después de cambiar mucho de rama, reinicia el servidor de desarrollo. Tailwind pierde su escaneo de clases; no es un fallo del código y el build no tiene ese problema.

## Qué se verificó (en el navegador, contra el mock)

- **Reconexión:** se probó reiniciando el servidor de T-06. La pantalla muestra "Reconectando…" y vuelve sola; las esperas medidas fueron 2, 4 y 8 s.
- **Validación local:**
  - usuario de 2 letras y contraseña de 5 caracteres no se envían;
  - apuestas 0, -10, 10.5, 15, 600 y "abc" no se envían;
  - compras inválidas no se envían.
- **Doble clic:** al comprar fichas cobra una sola vez (clave nueva por clic).
- **Mesa:**
  - Pedir y Plantarse solo se activan en tu turno;
  - la carta oculta se dibuja con el reverso y el total del dealer muestra "?";
  - el resultado desaparece al empezar la siguiente ronda.
- **Pantalla de resultado:**
  - 5 variantes, que se cierran con Continuar, Esc o tocando el fondo;
  - el foco pasa a "Continuar" al abrirse.
- **Celular (375 px):** sin desplazamiento horizontal.
- **Consola:** sin errores ni advertencias.

**No se ha probado:**
- Nada contra el servidor real más allá de la bienvenida de T-06.
- El modo "reducir movimiento": no se pudo emular.

## Qué falta por tarea

| Tarea | Falta para cumplir "hecho" |
|---|---|
| T-10 | Abrir la app desde otra laptop por IP (`vite --host` ya escucha en la red). |
| T-11 / T-12 | Revisión y fusión de #7 y #8. |
| T-13 | Acceso y lobby contra el servidor real. Requiere T-08 y T-09. |
| T-27 | Página de prueba con las 52 cartas (solo en mock). |
| T-28 | Prueba con 3 pestañas reales. Requiere T-18. |
| T-29 | Resultado con el servidor real y un `pedir` fuera de turno desde la consola. Requiere T-18 y T-20. |
| T-30 / T-41 | Compra con límite e historial contra el servidor real. Requieren T-24, T-34 y el enrutador. |
| T-42 | Indicador ya hecho; falta la prueba de apagar el Wi-Fi con 3 laptops. Requiere T-36. |
| T-33, T-47, T-49, T-51, T-53 | Documentación y exposición. T-47 (JSDoc) se fue cumpliendo al programar. |
| T-39, T-40 | Pospuestas (no eliminadas), según el plan. |

## Lo que el cliente espera del servidor (para Hector y Massimo)

- **`reqId`:**
  - Toda petición con `reqId` debe recibir una respuesta directa que repita ese `reqId`: el mensaje de éxito o un `error`.
  - Si no llega en 8 s, el cliente muestra "sin respuesta" y vuelve a habilitar el botón.
- **`error`:**
  - Con `SESION_INVALIDA` o `NO_AUTENTICADO`, el cliente borra el token y vuelve a la pantalla de acceso.
  - Con `NO_ESTAS_EN_MESA`, deja la mesa en modo espectador.
- **`mesa.estado`:**
  - Llega "plano": los campos de `MesaEstado` van al nivel superior, como define el contrato.
  - Al volver a `APUESTAS`, el cliente borra el resultado anterior.
- **`ronda.resultado`:** debe llevar un `rondaId` nuevo en cada ronda; el cliente lo usa para decidir si ya mostró ese resultado.
- **`finEn`:** epoch ms del servidor. El cliente corrige el desfase con `ping`/`pong` (campo `t`).
- **Duración de fase (opcional):** el contrato solo trae `finEn`, así que la barra del temporizador toma como total lo que faltaba cuando el cliente vio la fase. Un campo `duracionMs` en el snapshot daría la proporción exacta a quien entra a media fase.
- **Del contrato:** el cliente importa `LIMITES_CANTIDAD`, `CantidadApuestaSchema` y `CantidadCompraSchema` de `shared/`. Si cambian de nombre, se rompe la validación del cliente.

## Decisiones y riesgos

- **Trabajo después del congelamiento:** las animaciones, el temporizador y el selector de fichas (#11 y #12) se hicieron el 5 oct. Son parte de T-27–T-29, no extras de la lista prohibida, pero el equipo debe aceptar fusionarlos.
- **Tamaño de los PRs:** #7, #8, #11 y #12 pasan de las 400 líneas recomendadas. Para facilitar la revisión están en commits atómicos, y se pueden revisar commit por commit.
- **Ramas de respaldo:** las anteriores a la reorganización quedaron solo en la laptop de Nahum (`respaldo/*`), por si hiciera falta recuperar algo.

## Siguiente paso sugerido

1. Revisar y fusionar #7 → #12 en orden, rebasando el siguiente tras cada squash.
2. T-27: página de las 52 cartas. T-33: guion.
3. En cuanto existan T-07, T-08 y T-09, probar T-13 contra el servidor real.
