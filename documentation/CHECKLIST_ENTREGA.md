# CHECKLIST DE ENTREGA — verificación contra la rúbrica

Se revisa completa el **lunes 5 oct** (T-44) y otra vez el **martes 6 oct** con el `.zip` final. Último repaso documental: 6 oct; las casillas de aceptación de la demo siguen pendientes de ejecución y firma.
Cada casilla la marca **alguien distinto de quien construyó esa parte**. Anotar quién probó y cuándo.

**Alcance de entrega — corte confirmado por Hector, 6 oct 2026 (PLAN §10, PR #47):** T-35/T-39/T-40 quedan fuera. `[CORTE]` identifica un requisito excluido de la aceptación interna: su casilla sigue abierta y no equivale a una prueba aprobada ni a cumplir la rúbrica original. T-44 revisa las casillas conservadas; estas requieren evidencia o issue con dueño y fecha. El backend de compras T-34 se conserva y se comprueba por WebSocket, sin exigir la UI cortada. El recorte y sus limitaciones se explican en el manual y la exposición.

---

## 1. Funcionamiento — 50 %

> Perfecto = 50 · con errores de validación = 35 · parcial pero jugable = 25. Cualquier casilla sin marcar aquí nos baja a 35.

### 1.1 Conexión y sesión
- [ ] 3 laptops distintas en la misma red abren `http://<ip>:3000` y se conectan
- [ ] Registro con usuario nuevo funciona; usuario repetido muestra "ese usuario ya existe"
- [ ] Contraseña incorrecta muestra error y no entra
- [ ] Usuario inválido (2 letras, espacios, emojis) y contraseña < 6 caracteres se rechazan
- [ ] Recargar la página mantiene la sesión (entra sin pedir contraseña)
- [ ] Cerrar sesión funciona y el token deja de servir
- [ ] Reiniciar el servidor: los clientes muestran "reconectando" y vuelven solos

### 1.2 Juego con 3+ jugadores
- [ ] 3 jugadores (3 laptops) en la misma mesa ven la misma carta repartida en < 1 s
- [ ] Se juegan 5 rondas seguidas sin recargar ni errores en la consola del servidor
- [ ] Con bots (`bun run bots 2`) + 3 humanos, la mesa llena (5) funciona; un 6º recibe "mesa llena"
- [ ] El As cuenta 1 u 11 correctamente (A+6 = 17 blando; A+6+10 = 17)
- [ ] Blackjack natural paga 3:2 (apuesta 100 → recibe 250)
- [ ] Empate devuelve la apuesta
- [ ] El dealer pide hasta 17 y se planta en 17
- [ ] La carta oculta del dealer **no** aparece en la pestaña de red del navegador antes de su turno
- [ ] La cuenta regresiva de apuestas (15 s) y de turno (20 s) se ve igual en las 3 pantallas
- [ ] Si un jugador no actúa en 20 s, se planta solo y el turno pasa
- [ ] Quien entra a media ronda espera a la siguiente sin romper nada
- [ ] Cada ronda terminada aparece en `rondas` y `rondas_jugadores` con resultados correctos

### 1.3 Validaciones del juego (el servidor rechaza con mensaje claro)
- [ ] Pedir / plantarse fuera de tu turno → "No es tu turno" (probado también desde la consola del navegador enviando el mensaje a mano)
- [ ] Apostar fuera de la fase de apuestas → error
- [ ] Apostar 0, -10, 10.5, 15 (no múltiplo de 10), 600 (> máximo), `"abc"` → error "cantidad inválida"
- [ ] Apostar más fichas de las que tienes → "fichas insuficientes"
- [ ] Apostar dos veces en la misma ronda → error
- [ ] Mensaje que no es JSON, `type` inventado, campos faltantes → error y el servidor sigue vivo
- [ ] Enviar 1,000 mensajes en 1 s desde una pestaña no afecta a las demás

### 1.4 Desconexión
- [ ] Cerrar la pestaña del jugador **en su turno** → se planta y la mesa sigue
- [ ] Cerrar la pestaña de un jugador que **aún no ha jugado** → se planta al llegar su turno
- [ ] Los demás ven al jugador como "desconectado"
- [ ] Reabrir antes de 60 s → recupera su asiento, sus cartas y su saldo
- [ ] Después de 60 s, el asiento se libera al terminar la ronda
- [ ] El mismo usuario en 2 pestañas: la nueva toma el asiento y la anterior ya no puede actuar
- [ ] Apagar el Wi-Fi de una laptop a media mano no congela la mesa de las otras dos

### 1.5 Economía
- [ ] Usuario nuevo tiene $10,000 y 500 fichas
- [ ] Comprar fichas descuenta dinero y suma fichas; se ve el disponible del día y la hora de reinicio
- [ ] Comprar hasta el límite (5,000) funciona; 10 más → "límite diario alcanzado"
- [ ] **Doble clic** rápido en "Comprar" cobra una sola vez
- [ ] **Dos pestañas del mismo usuario** comprando a la vez no pasan del límite ni dejan saldo negativo
- [ ] Dinero insuficiente → error, sin cambios en saldo
- [ ] Cantidades 0, negativas, decimales, no múltiplo de 10 y 1,000,000,000 → rechazadas
- [ ] Comprar fichas durante una mano no altera la mesa
- [ ] La suma de `movimientos` de cada usuario coincide con su saldo actual (consulta SQL de verificación)

### 1.6 Tienda e inventario
- [ ] Backend T-34 por WebSocket: comprar un artículo descuenta fichas y aparece en `inventario.listar`; compra desde la UI excluida por T-39
- [ ] Backend T-34 por WebSocket: dos compras simultáneas del mismo artículo → una compra, un error y un solo cobro; comprobar dos conexiones del mismo usuario
- [ ] Backend T-34 por WebSocket: comprar sin fichas suficientes → error sin cambiar saldo ni inventario
- [ ] [CORTE T-35/T-40] Equipar avatar/reverso: los otros jugadores de la mesa lo ven
- [ ] [CORTE T-35] Equipar durante reparto/turnos/dealer/pagos → "no puedes cambiarlo en medio de una mano"
- [ ] [CORTE T-35] Equipar algo que no tienes (mensaje manual) → error
- [ ] T-41: historial del cliente real muestra compra de fichas, apuestas y pagos cuando corresponda; compra de artículo preparada por WebSocket (T-34) también aparece, con saldos correctos y paginación sin duplicados

Probado por: ______ · Fecha: ______

---

## 2. Exposición — 20 %

> Perfecta = 20 · si solo uno la termina = 15 · mala o leyendo diapositivas = 10.

- [ ] **Los 3 hablan** y cada uno tiene su parte clara (guion en `docs/exposicion.md`)
- [ ] Duración **< 10 min** cronometrada en el ensayo 1 (____) y en el ensayo 2 (____)
- [ ] Nadie lee las diapositivas (≤ 25 palabras por diapositiva)
- [ ] Demo en vivo con 3 laptops: ronda completa, compra de fichas con límite, historial, catálogo de solo lectura y desconexión; explicar el corte de compra/equipamiento de artículos
- [ ] Plan B probado: hotspot del celular + video de respaldo en USB
- [ ] Laptops cargadas, servidor y BD levantados **antes** de pasar; usuarios de demo creados
- [ ] Respuestas preparadas: ¿por qué WebSocket?, ¿qué pasa si dos compran a la vez?, ¿cómo evitan trampas?, ¿qué pasa si alguien se desconecta?

---

## 3. Código fuente documentado — 10 %

- [ ] Cada archivo tiene comentario de cabecera (qué hace el módulo)
- [ ] Todas las clases y funciones exportadas tienen JSDoc (`@param`, `@returns`, `@throws` cuando aplica) — servidor
- [ ] Ídem en `shared/`
- [ ] Hooks, store y pantallas principales del cliente comentados
- [ ] Comentarios explican el **por qué** en las partes difíciles (transacciones, límite diario, máquina de estados, reconexión)
- [ ] Sin código muerto, `console.log` de depuración ni `TODO` sin resolver
- [ ] `bun run typecheck` y `bun test` en verde

Revisado por: ______ (distinto del autor)

---

## 4. Manuales de usuario e instalación — 10 %

- [ ] `docs/manual-instalacion.md`: requisitos con versiones, pasos, `.env`, Docker, BD, arranque, conexión desde otra laptop, problemas comunes
- [ ] Manual de instalación **probado por alguien que no lo escribió**, en una máquina limpia: ______
- [ ] `docs/manual-usuario.md` con capturas: registro, lobby, jugar, comprar fichas, catálogo de solo lectura, historial y desconexión; explica el corte de compra/equipamiento y de inventario editable
- [ ] Manual de usuario **probado por alguien que no lo escribió**: ______; juega una ronda, compra fichas y consulta el historial siguiendo solo el manual (T-49)
- [ ] Las capturas corresponden a la versión final

---

## 5. Documentación de arquitectura — 10 %

- [ ] **Base de datos:** descripción de cada tabla y columna, restricciones, diagrama ER
- [ ] **Scripts:** `server/db/schema.sql` y `server/db/seed.sql` incluidos y referenciados en el documento
- [ ] **Diseño de clases:** diagrama de clases actualizado al código real
- [ ] **Diagrama de dependencias** entre módulos/paquetes
- [ ] Protocolo de mensajes y máquina de estados de la mesa
- [ ] Diagramas visibles sin herramientas especiales (exportados también como imagen o PDF dentro de `docs/`)

---

## 6. Entrega

- [ ] Archivo **`.zip`** (NO `.rar`) generado con `bun run empaquetar`
- [ ] Sin `node_modules`, `.env`, `dist`, `.git`
- [ ] Incluye `README`, `docs/`, `server/db/*.sql`, `.env.example`, `docker-compose.yml`
- [ ] **Descomprimido y probado desde cero en otra computadora** siguiendo solo el manual: ______
- [ ] Subido antes de las **11:00** del mié 7 oct (límite 13:00) y descargado de nuevo para verificar
