/**
 * Datos de ejemplo del modo mock (`?mock=1`): un usuario, su billetera, el lobby,
 * un snapshot de mesa por cada una de las 6 fases, el resultado de una ronda,
 * historial, catálogo e inventario. Todos cumplen el contrato de `@blackjack/shared`
 * (lo verifica `test/mock.test.ts`), así que la UI se prueba con datos realistas sin servidor.
 */
import type {
  ArticuloCatalogo,
  Asiento,
  BilleteraEstado,
  CartaVisible,
  Equipado,
  FaseMesa,
  MesaEstado,
  MesaResumen,
  Movimiento,
  Resultado,
  ResultadoJugador,
} from "@blackjack/shared";

/** Id del usuario del mock (siempre se sienta en el asiento 0). */
export const ID_DEMO = 1;
/** Token de sesión del mock (64 hex). */
export const TOKEN_DEMO = "d3".repeat(32);
/** Mesa con snapshots de ejemplo. */
export const MESA_DEMO = "mesa-1";
/** Mesa que el mock reporta llena (para probar `MESA_LLENA`). */
export const MESA_LLENA = "mesa-3";
/** Nombre que el mock trata como ya registrado (para probar `USUARIO_EXISTE`). */
export const USUARIO_EXISTENTE = "existe";
/** Contraseña que el mock trata como incorrecta (para probar `CREDENCIALES_INVALIDAS`). */
export const CONTRASENA_INCORRECTA = "incorrecta";

/** Artículos equipados al registrarse. */
export const EQUIPADO_INICIAL: Equipado = { avatar: "avatar_basico", reverso: "reverso_clasico", tema: "tema_verde" };

/** Límite diario de compra de fichas que simula el mock. */
const LIMITE_DIARIO = 5000;

/**
 * Próxima medianoche de CDMX (UTC−6 todo el año desde 2023) en ISO.
 * @param ahora - Momento de referencia.
 * @returns Fecha ISO del reinicio del límite diario.
 */
export function siguienteReinicio(ahora: Date = new Date()): string {
  const reinicio = new Date(ahora);
  reinicio.setUTCHours(6, 0, 0, 0);
  if (reinicio.getTime() <= ahora.getTime()) reinicio.setUTCDate(reinicio.getUTCDate() + 1);
  return reinicio.toISOString();
}

/**
 * Billetera inicial de un usuario nuevo ($10,000 y 500 fichas).
 * @returns Billetera nueva (copia independiente).
 */
export function billeteraInicial(): BilleteraEstado {
  return { dinero: 10000, fichas: 500, compradoHoy: 0, disponibleHoy: LIMITE_DIARIO, limiteDiario: LIMITE_DIARIO, reinicioEn: siguienteReinicio() };
}

/** Lobby con una mesa en juego, una vacía y una llena. */
export const LOBBY_DEMO: MesaResumen[] = [
  { id: MESA_DEMO, nombre: "Mesa 1", ocupados: 3, capacidad: 5, fase: "TURNOS" },
  { id: "mesa-2", nombre: "Mesa 2", ocupados: 0, capacidad: 5, fase: "ESPERANDO" },
  { id: MESA_LLENA, nombre: "Mesa 3", ocupados: 5, capacidad: 5, fase: "APUESTAS" },
];

/**
 * Atajo para escribir cartas.
 * @param rango - Rango de la carta.
 * @param palo - Palo de la carta.
 * @returns Carta visible.
 */
function c(rango: CartaVisible["rango"], palo: CartaVisible["palo"]): CartaVisible {
  return { rango, palo };
}

/**
 * Atajo para escribir asientos.
 * @param indice - Posición en la mesa.
 * @param usuarioId - Id del jugador.
 * @param usuario - Nombre visible.
 * @param datos - Apuesta, cartas, total, estado y conexión.
 * @returns Asiento ocupado.
 */
function asiento(
  indice: Asiento["indice"],
  usuarioId: number,
  usuario: string,
  datos: Pick<Asiento, "apuesta" | "cartas" | "total" | "estado"> & { conectado?: boolean },
): Asiento {
  return { indice, usuarioId, usuario, avatar: "avatar_basico", reverso: "reverso_clasico", conectado: datos.conectado ?? true, ...datos };
}

/** Duración simulada de cada reloj, en ms. */
const RELOJ_MS: Record<FaseMesa, number | null> = {
  ESPERANDO: null,
  APUESTAS: 15000,
  REPARTO: null,
  TURNOS: 20000,
  DEALER: null,
  PAGOS: 5000,
};

/**
 * Snapshot de ejemplo de la mesa demo en una fase. Incluye los casos que la UI debe dibujar:
 * carta oculta del dealer, blackjack, jugador pasado, desconectado y quien espera la siguiente ronda.
 * @param fase - Fase deseada.
 * @param ahora - Epoch ms para calcular `finEn`.
 * @returns Snapshot nuevo (copia independiente).
 */
export function mesaEnFase(fase: FaseMesa, ahora: number = Date.now()): MesaEstado {
  const duracion = RELOJ_MS[fase];
  const base = { id: MESA_DEMO, nombre: "Mesa 1", fase, finEn: duracion === null ? null : ahora + duracion };
  const luis = asiento(4, 4, "luis", { apuesta: 0, cartas: [], total: 0, estado: "ESPERANDO_RONDA", conectado: false });
  switch (fase) {
    case "ESPERANDO":
      return { ...base, turnoDe: null, dealer: { cartas: [], total: null }, asientos: [null, null, null, null, null] };
    case "APUESTAS":
      return {
        ...base,
        turnoDe: null,
        dealer: { cartas: [], total: null },
        asientos: [
          asiento(0, ID_DEMO, "demo", { apuesta: 0, cartas: [], total: 0, estado: "SIN_APUESTA" }),
          asiento(1, 2, "ana", { apuesta: 50, cartas: [], total: 0, estado: "APOSTADO" }),
          null,
          asiento(3, 3, "beto", { apuesta: 0, cartas: [], total: 0, estado: "SIN_APUESTA" }),
          luis,
        ],
      };
    case "REPARTO":
      return {
        ...base,
        turnoDe: null,
        dealer: { cartas: [c("10", "♠"), { oculta: true }], total: null },
        asientos: [
          asiento(0, ID_DEMO, "demo", { apuesta: 100, cartas: [c("A", "♠"), c("6", "♥")], total: 17, estado: "APOSTADO" }),
          asiento(1, 2, "ana", { apuesta: 50, cartas: [c("A", "♣"), c("K", "♥")], total: 21, estado: "BLACKJACK" }),
          null,
          asiento(3, 3, "beto", { apuesta: 100, cartas: [c("K", "♦"), c("Q", "♣")], total: 20, estado: "APOSTADO" }),
          luis,
        ],
      };
    case "TURNOS":
      return {
        ...base,
        turnoDe: ID_DEMO,
        dealer: { cartas: [c("10", "♠"), { oculta: true }], total: null },
        asientos: [
          asiento(0, ID_DEMO, "demo", { apuesta: 100, cartas: [c("A", "♠"), c("6", "♥")], total: 17, estado: "JUGANDO" }),
          asiento(1, 2, "ana", { apuesta: 50, cartas: [c("A", "♣"), c("K", "♥")], total: 21, estado: "BLACKJACK" }),
          null,
          asiento(3, 3, "beto", { apuesta: 100, cartas: [c("K", "♦"), c("Q", "♣")], total: 20, estado: "APOSTADO" }),
          luis,
        ],
      };
    case "DEALER":
    case "PAGOS":
      return {
        ...base,
        turnoDe: null,
        dealer: { cartas: [c("10", "♠"), c("7", "♦")], total: 17 },
        asientos: [
          asiento(0, ID_DEMO, "demo", { apuesta: 100, cartas: [c("A", "♠"), c("6", "♥")], total: 17, estado: "PLANTADO" }),
          asiento(1, 2, "ana", { apuesta: 50, cartas: [c("A", "♣"), c("K", "♥")], total: 21, estado: "BLACKJACK" }),
          null,
          asiento(3, 3, "beto", { apuesta: 100, cartas: [c("K", "♦"), c("Q", "♣"), c("5", "♠")], total: 25, estado: "PASADO" }),
          luis,
        ],
      };
  }
}

/** Apuesta del usuario demo en la ronda de ejemplo. */
const APUESTA_DEMO = 100;
/** Pago (apuesta incluida) que recibiría el usuario demo con cada resultado: 3:2, 1:1, devolución o nada. */
const PAGO_DEMO: Record<Resultado, number> = { blackjack: 250, gana: 200, empate: 100, pierde: 0, pasado: 0 };

/**
 * Resultado de una ronda de ejemplo con el resultado elegido para el usuario demo
 * (el panel del mock permite ver así cada variante de la pantalla de resultado).
 * @param resultado - Resultado del usuario demo.
 * @param rondaId - UUID de la ronda (uno nuevo por ronda, como haría el servidor).
 * @returns Datos de `ronda.resultado` sin `type`.
 */
export function resultadoDemo(
  resultado: Resultado,
  rondaId: string,
): { rondaId: string; dealer: { cartas: CartaVisible[]; total: number }; resultados: ResultadoJugador[] } {
  return {
    rondaId,
    dealer: { cartas: [c("10", "♠"), c("7", "♦")], total: 17 },
    resultados: [
      { usuarioId: ID_DEMO, resultado, apuesta: APUESTA_DEMO, pago: PAGO_DEMO[resultado] },
      { usuarioId: 2, resultado: "blackjack", apuesta: 50, pago: 125 },
      { usuarioId: 3, resultado: "pasado", apuesta: 100, pago: 0 },
    ] satisfies ResultadoJugador[],
  };
}

/** Resultado de la ronda de ejemplo (coincide con el snapshot de `PAGOS`). */
export const RESULTADO_DEMO = resultadoDemo("empate", "6f1c2b7e-0d4a-4c8e-9b1a-2e3f4a5b6c7d");

/**
 * Historial de ejemplo, del más reciente al más antiguo, con saldos coherentes.
 * @returns 12 movimientos (ids "12" a "1").
 */
export function movimientosDemo(): Movimiento[] {
  const cambios: Array<Pick<Movimiento, "tipo" | "deltaDinero" | "deltaFichas" | "referencia">> = [
    { tipo: "registro", deltaDinero: 10000, deltaFichas: 500, referencia: null },
    { tipo: "compra_fichas", deltaDinero: -1000, deltaFichas: 1000, referencia: null },
    { tipo: "apuesta", deltaDinero: 0, deltaFichas: -100, referencia: `ronda:${RESULTADO_DEMO.rondaId}` },
    { tipo: "pago", deltaDinero: 0, deltaFichas: 200, referencia: `ronda:${RESULTADO_DEMO.rondaId}` },
    { tipo: "compra_articulo", deltaDinero: 0, deltaFichas: -150, referencia: "articulo:avatar_robot" },
    { tipo: "apuesta", deltaDinero: 0, deltaFichas: -50, referencia: "ronda:1b2c3d4e-0000-4000-8000-000000000001" },
    { tipo: "pago", deltaDinero: 0, deltaFichas: 125, referencia: "ronda:1b2c3d4e-0000-4000-8000-000000000001" },
    { tipo: "apuesta", deltaDinero: 0, deltaFichas: -100, referencia: "ronda:1b2c3d4e-0000-4000-8000-000000000002" },
    { tipo: "compra_fichas", deltaDinero: -500, deltaFichas: 500, referencia: null },
    { tipo: "apuesta", deltaDinero: 0, deltaFichas: -200, referencia: "ronda:1b2c3d4e-0000-4000-8000-000000000003" },
    { tipo: "pago", deltaDinero: 0, deltaFichas: 400, referencia: "ronda:1b2c3d4e-0000-4000-8000-000000000003" },
    { tipo: "apuesta", deltaDinero: 0, deltaFichas: -100, referencia: "ronda:1b2c3d4e-0000-4000-8000-000000000004" },
  ];
  let dinero = 0;
  let fichas = 0;
  const inicio = Date.parse("2026-10-05T15:00:00.000Z");
  const filas = cambios.map((cambio, posicion): Movimiento => {
    dinero += cambio.deltaDinero;
    fichas += cambio.deltaFichas;
    const id = String(posicion + 1);
    return { id, ...cambio, dineroDespues: dinero, fichasDespues: fichas, creadoEn: new Date(inicio + posicion * 60_000).toISOString() };
  });
  return filas.reverse();
}

/** Catálogo de `seed.sql` (PLAN.md §1); los gratuitos vienen poseídos. */
export function catalogoDemo(): ArticuloCatalogo[] {
  const articulos: Array<Omit<ArticuloCatalogo, "poseido">> = [
    { id: "avatar_basico", tipo: "avatar", nombre: "Básico", precio: 0 },
    { id: "avatar_gato", tipo: "avatar", nombre: "Gato", precio: 100 },
    { id: "avatar_robot", tipo: "avatar", nombre: "Robot", precio: 150 },
    { id: "avatar_pirata", tipo: "avatar", nombre: "Pirata", precio: 200 },
    { id: "avatar_corona", tipo: "avatar", nombre: "Corona", precio: 300 },
    { id: "reverso_clasico", tipo: "reverso", nombre: "Clásico azul", precio: 0 },
    { id: "reverso_rojo", tipo: "reverso", nombre: "Rojo casino", precio: 150 },
    { id: "reverso_neon", tipo: "reverso", nombre: "Neón", precio: 250 },
    { id: "reverso_oro", tipo: "reverso", nombre: "Oro", precio: 300 },
    { id: "reverso_pixel", tipo: "reverso", nombre: "Pixel art", precio: 400 },
    { id: "tema_verde", tipo: "tema", nombre: "Paño verde", precio: 0 },
    { id: "tema_azul", tipo: "tema", nombre: "Paño azul", precio: 500 },
    { id: "tema_rojo", tipo: "tema", nombre: "Paño vino", precio: 750 },
    { id: "tema_noche", tipo: "tema", nombre: "Noche", precio: 1000 },
  ];
  return articulos.map((articulo) => ({ ...articulo, poseido: articulo.precio === 0 }));
}
