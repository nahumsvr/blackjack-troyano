/** T-21: resultados, salida, reintentos y plazo de resultados después de confirmar persistencia. */
import { expect, test } from "bun:test";
import { ErrorJuego, MensajeServidorSchema } from "@blackjack/shared";
import { EQUIPADO_INICIAL, REINTENTO_PAGOS_MS, REINTENTOS_PAGOS_MAX, TIEMPO_RESULTADOS_MS } from "../src/config";
import { Mesa } from "../src/game/Mesa";
import type { ResultadoMesa, RondaTerminada } from "../src/game/RondaTerminada";
import { BilleteraMemoria, crearZapatoFijo, TiempoManual } from "./soporteMesa";

function preparar() {
  const tiempo = new TiempoManual();
  const billetera = new BilleteraMemoria();
  const resultados: ResultadoMesa[] = [];
  const guardadas: RondaTerminada[] = [];
  const errores: unknown[] = [];
  const servicios = {
    billetera,
    guardarRonda: async (ronda: RondaTerminada) => { guardadas.push(ronda); },
    publicarResultado: (mensaje: ResultadoMesa) => { MensajeServidorSchema.parse(mensaje); resultados.push(mensaje); },
    registrarError: (error: unknown) => { errores.push(error); },
  };
  const mesa = new Mesa("mesa-1", "Mesa 1", () => {}, crearZapatoFijo(["A", "10", "10", "10", "K", "8", "7", "7"]), tiempo.reloj, servicios);
  for (let id = 1; id <= 3; id++) mesa.unirse({ id, usuario: `jugador${id}` }, EQUIPADO_INICIAL);
  async function repartir() {
    for (let id = 1; id <= 3; id++) await mesa.apostar(id, 10);
    tiempo.avanzar(0); await mesa.esperarOperaciones();
  }
  async function terminar() { await repartir(); await mesa.plantarse(2); await mesa.plantarse(3); await mesa.esperarOperaciones(); }
  return { mesa, tiempo, billetera, resultados, guardadas, errores, servicios, repartir, terminar };
}

test("liquida tres participantes, incluido quien salió; publica resultados y espera 5 s", async () => {
  const { mesa, tiempo, billetera, resultados, guardadas, repartir } = preparar();
  const rondaId = mesa.rondaId;
  await repartir();
  mesa.salir(1);
  await mesa.plantarse(2); await mesa.plantarse(3); await mesa.esperarOperaciones();
  expect(resultados).toHaveLength(1);
  expect(resultados[0]).toMatchObject({ rondaId, resultados: [
    { usuarioId: 1, resultado: "blackjack", pago: 25 },
    { usuarioId: 2, resultado: "gana", pago: 20 },
    { usuarioId: 3, resultado: "empate", pago: 10 },
  ] });
  expect(guardadas[0]?.jugadores).toHaveLength(3);
  expect(await Promise.all([1, 2, 3].map(async (id) => (await billetera.consultar(id)).fichas))).toEqual([515, 510, 500]);
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_RESULTADOS_MS);
  tiempo.avanzar(TIEMPO_RESULTADOS_MS - 1); await mesa.esperarOperaciones();
  expect(mesa.fase).toBe("PAGOS");
  tiempo.avanzar(1); await mesa.esperarOperaciones();
  expect(mesa.fase).toBe("APUESTAS");
  expect(mesa.rondaId).not.toBe(rondaId);
  expect(mesa.snapshot().asientos[0]).toBeNull();
  expect(tiempo.maximo).toBe(1);
});

test("historial lento mantiene finEn null y no permite finalizar pagos por adelantado", async () => {
  const { mesa, tiempo, resultados, servicios, terminar } = preparar();
  let liberar!: () => void;
  const bloqueo = new Promise<void>((resolver) => { liberar = resolver; });
  let inicio!: () => void;
  const iniciada = new Promise<void>((resolver) => { inicio = resolver; });
  servicios.guardarRonda = async () => { inicio(); await bloqueo; };
  const fin = terminar();
  await iniciada;
  tiempo.avanzar(TIEMPO_RESULTADOS_MS * 2);
  expect(mesa.snapshot()).toMatchObject({ fase: "PAGOS", finEn: null });
  expect(() => mesa.finalizarPagos()).toThrow(new ErrorJuego("ERROR_INTERNO"));
  expect(resultados).toEqual([]);
  liberar(); await fin;
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_RESULTADOS_MS);
});

test("si falla el historial reintenta sin duplicar pagos ni perder cartas", async () => {
  const { mesa, tiempo, billetera, resultados, errores, servicios, terminar } = preparar();
  const guardar = servicios.guardarRonda;
  let intentos = 0;
  servicios.guardarRonda = async (ronda) => { if (++intentos === 1) throw new Error("SQL temporal"); await guardar(ronda); };
  await terminar();
  const cartas = mesa.snapshot().asientos[0]!.cartas;
  expect(mesa.snapshot()).toMatchObject({ fase: "PAGOS", finEn: null });
  expect(resultados).toEqual([]);
  expect(errores).toHaveLength(1);
  tiempo.avanzar(REINTENTO_PAGOS_MS); await mesa.esperarOperaciones();
  expect(resultados).toHaveLength(1);
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect(mesa.snapshot().asientos[0]!.cartas).toEqual(cartas);
  expect(tiempo.maximo).toBe(1);
});

test("un pago con commit pero sin respuesta se reconoce en el reintento", async () => {
  const { mesa, tiempo, billetera, resultados, terminar } = preparar();
  const pagar = billetera.acreditarPago.bind(billetera);
  let fallo = false;
  billetera.acreditarPago = async (...args) => {
    const saldo = await pagar(...args);
    if (!fallo) { fallo = true; throw new Error("Respuesta perdida después del commit"); }
    return saldo;
  };
  await terminar();
  expect(resultados).toHaveLength(0);
  tiempo.avanzar(REINTENTO_PAGOS_MS); await mesa.esperarOperaciones();
  expect(resultados).toHaveLength(1);
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect((await billetera.consultar(1)).fichas).toBe(515);
});

test("un fallo al publicar resultados reintenta el evento sin volver a pagar ni guardar", async () => {
  const { mesa, tiempo, billetera, guardadas, resultados, servicios, terminar } = preparar();
  const publicar = servicios.publicarResultado;
  let fallar = true;
  servicios.publicarResultado = (mensaje) => {
    if (fallar) { fallar = false; throw new Error("Transporte temporal"); }
    publicar(mensaje);
  };
  await terminar();
  expect(resultados).toHaveLength(0);
  tiempo.avanzar(REINTENTO_PAGOS_MS); await mesa.esperarOperaciones();
  expect(resultados).toHaveLength(1);
  expect(guardadas).toHaveLength(1);
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_RESULTADOS_MS);
});

test("cerrar completa pagos parciales sin esperar el reintento ni duplicar créditos", async () => {
  const { mesa, tiempo, billetera, guardadas, resultados, terminar } = preparar();
  const pagar = billetera.acreditarPago.bind(billetera);
  let fallar = true;
  billetera.acreditarPago = async (usuarioId, cantidad, rondaId) => {
    if (usuarioId === 2 && fallar) { fallar = false; throw new Error("SQL temporal"); }
    return pagar(usuarioId, cantidad, rondaId);
  };
  await terminar();
  expect(billetera.pagos).toEqual([1]);
  expect(tiempo.pendientes.size).toBe(1);
  const rondaId = mesa.rondaId;
  await mesa.cerrar();
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect(guardadas).toHaveLength(1);
  expect(guardadas[0]?.id).toBe(rondaId!);
  expect(resultados).toHaveLength(0);
  expect(tiempo.pendientes.size).toBe(0);
  expect((await billetera.consultar(1)).fichas).toBe(515);
});

test("cerrar completa una liquidación en cola aunque detener preceda su ejecución", async () => {
  const { mesa, tiempo, billetera, guardadas, resultados, repartir } = preparar();
  await repartir();
  await mesa.plantarse(2);
  mesa.salir(3);
  mesa.detener();
  await mesa.cerrar();
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect(guardadas).toHaveLength(1);
  expect(resultados).toHaveLength(0);
  expect(tiempo.pendientes.size).toBe(0);
});

test("cerrar reconoce un pago con respuesta perdida y reporta un fallo persistente", async () => {
  const { mesa, tiempo, billetera, guardadas, terminar, servicios } = preparar();
  const pagar = billetera.acreditarPago.bind(billetera);
  let fallar = true;
  billetera.acreditarPago = async (...argumentos) => {
    const saldo = await pagar(...argumentos);
    if (fallar) { fallar = false; throw new Error("Respuesta perdida"); }
    return saldo;
  };
  await terminar();
  servicios.guardarRonda = async () => { throw new Error("SQL no disponible"); };
  await expect(mesa.cerrar()).rejects.toThrow("SQL no disponible");
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect((await billetera.consultar(1)).fichas).toBe(515);
  expect(guardadas).toHaveLength(0);
  expect(tiempo.pendientes.size).toBe(0);
});

test("un fallo persistente agota los reintentos, registra la ronda y libera la mesa sin perder pagos confirmados", async () => {
  const { mesa, tiempo, billetera, resultados, errores, servicios, repartir } = preparar();
  servicios.guardarRonda = async () => { throw new ErrorJuego("ERROR_INTERNO"); };
  const rondaId = mesa.rondaId;
  await repartir();
  mesa.salir(1);
  await mesa.plantarse(2); await mesa.plantarse(3); await mesa.esperarOperaciones();
  for (let intento = 1; intento < REINTENTOS_PAGOS_MAX; intento++) {
    expect(mesa.fase).toBe("PAGOS");
    tiempo.avanzar(REINTENTO_PAGOS_MS); await mesa.esperarOperaciones();
  }
  expect(mesa.fase).toBe("PAGOS");
  expect(errores).toHaveLength(REINTENTOS_PAGOS_MAX);
  tiempo.avanzar(REINTENTO_PAGOS_MS); await mesa.esperarOperaciones();
  expect(mesa.fase).toBe("APUESTAS");
  expect(mesa.rondaId).not.toBe(rondaId);
  expect(mesa.snapshot().asientos[0]).toBeNull();
  expect(String(errores.at(-1))).toContain(`ronda ${rondaId}`);
  expect(resultados).toEqual([]);
  expect(billetera.pagos).toEqual([1, 2, 3]);
  expect(tiempo.maximo).toBe(1);
});
