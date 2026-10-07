/** X-1: dinero, pagos y carreras de doblar con reloj y zapato deterministas. */
import { expect, test } from "bun:test";
import { ErrorJuego, MensajeClienteSchema, MensajeServidorSchema } from "@blackjack/shared";
import { EQUIPADO_INICIAL, TIEMPO_TURNO_MS } from "../src/config";
import { Mesa } from "../src/game/Mesa";
import type { RondaTerminada } from "../src/game/RondaTerminada";
import { BilleteraMemoria, crearZapatoFijo, TiempoManual } from "./soporteMesa";

async function preparar(carta: "2" | "K" | "A" = "2", apuesta = 100) {
  const tiempo = new TiempoManual();
  const billetera = new BilleteraMemoria();
  const rondas: RondaTerminada[] = [];
  billetera.fichas.set(1, 2000);
  const mesa = new Mesa("mesa-1", "Mesa 1", (mensaje) => {
    expect(MensajeServidorSchema.safeParse(mensaje).success).toBe(true);
  }, crearZapatoFijo(["10", "9", "10", "9", "8", "7", carta]), tiempo.reloj,
  { billetera, guardarRonda: async (ronda) => { rondas.push(ronda); } });
  mesa.unirse({ id: 1, usuario: "uno" }, EQUIPADO_INICIAL);
  mesa.unirse({ id: 2, usuario: "dos" }, EQUIPADO_INICIAL);
  await mesa.apostar(1, apuesta); await mesa.apostar(2, 10);
  tiempo.avanzar(0); await mesa.esperarOperaciones();
  return { mesa, tiempo, billetera, rondas };
}

test("doblar acepta solo la intención sin cantidad ni identidad elegidas por el cliente", () => {
  expect(MensajeClienteSchema.safeParse({ type: "doblar", reqId: "x1" }).success).toBe(true);
  for (const extra of [{ cantidad: 100 }, { usuarioId: 2 }]) {
    expect(MensajeClienteSchema.safeParse({ type: "doblar", ...extra }).success).toBe(false);
  }
});

test.each([100, 500])("doblar %i da una carta, planta y paga la apuesta total sin natural", async (apuesta) => {
  const { mesa, billetera, rondas, tiempo } = await preparar("2", apuesta);
  await mesa.doblar(1);
  expect(mesa.snapshot().asientos[0]).toMatchObject({ apuesta: apuesta * 2, total: 21, estado: "PLANTADO" });
  expect(mesa.snapshot().asientos[0]?.cartas).toHaveLength(3);
  expect(mesa.snapshot().turnoDe).toBe(2);
  expect(mesa.snapshot().dealer.cartas[1]).toEqual({ oculta: true });
  expect((await billetera.consultar(1)).fichas).toBe(2000 - apuesta * 2);
  await mesa.plantarse(2); await mesa.esperarOperaciones();
  expect(rondas[0]?.jugadores[0]).toMatchObject({ apuesta: apuesta * 2, pago: apuesta * 4, resultado: "gana" });
  expect((await billetera.consultar(1)).fichas).toBe(2000 + apuesta * 2);
  tiempo.avanzar(5000); await mesa.esperarOperaciones();
  expect(mesa.snapshot().asientos[0]).toMatchObject({ apuesta: 0, cartas: [] });
  mesa.detener();
});

test("pasarse doblando conserva la pérdida total", async () => {
  const { mesa, billetera, rondas } = await preparar("K");
  await mesa.doblar(1);
  expect(mesa.snapshot().asientos[0]).toMatchObject({ total: 29, estado: "PASADO", apuesta: 200 });
  await mesa.plantarse(2); await mesa.esperarOperaciones();
  expect(rondas[0]?.jugadores[0]).toMatchObject({ resultado: "pasado", pago: 0, apuesta: 200 });
  expect((await billetera.consultar(1)).fichas).toBe(1800);
  mesa.detener();
});

test("saldo insuficiente, turno ajeno y pedir antes de doblar no cobran", async () => {
  const { mesa, billetera } = await preparar();
  const antes = mesa.snapshot();
  expect(await mesa.doblar(2).catch((error: unknown) => error)).toEqual(new ErrorJuego("NO_ES_TU_TURNO"));
  billetera.fichas.set(1, 99);
  expect(await mesa.doblar(1).catch((error: unknown) => error)).toEqual(new ErrorJuego("FICHAS_INSUFICIENTES"));
  expect(mesa.snapshot()).toEqual(antes);
  expect(billetera.debitos).toEqual([1, 2]);
  mesa.detener();
  const siguiente = await preparar("A");
  await siguiente.mesa.pedir(1);
  expect(await siguiente.mesa.doblar(1).catch((error: unknown) => error)).toEqual(new ErrorJuego("NO_PUEDES_DOBLAR"));
  expect(siguiente.billetera.debitos).toEqual([1, 2]);
  siguiente.mesa.detener();
});

test("doblar después de vencer el plazo no cobra", async () => {
  const { mesa, billetera, tiempo } = await preparar();
  tiempo.avanzar(TIEMPO_TURNO_MS);
  expect(await mesa.doblar(1).catch((error: unknown) => error)).toBeInstanceOf(ErrorJuego);
  expect(billetera.debitos).toEqual([1, 2]);
  mesa.detener();
});

test("un fallo de cobro después de desconectar planta la apuesta original", async () => {
  const { mesa, billetera } = await preparar();
  const inicio = Promise.withResolvers<void>();
  const bloqueo = Promise.withResolvers<void>();
  billetera.debitarApuesta = async () => { inicio.resolve(); await bloqueo.promise; throw new ErrorJuego("FICHAS_INSUFICIENTES"); };
  const accion = mesa.doblar(1).catch((error: unknown) => error);
  await inicio.promise; mesa.marcarDesconectado(1); bloqueo.resolve();
  expect(await accion).toEqual(new ErrorJuego("FICHAS_INSUFICIENTES"));
  expect(mesa.snapshot().asientos[0]).toMatchObject({ apuesta: 100, estado: "PLANTADO" });
  expect(mesa.snapshot().asientos[0]?.cartas).toHaveLength(2);
  expect(mesa.snapshot().turnoDe).toBe(2);
  mesa.detener();
});

test("doble clic cobra una sola vez y bloquea pedir o volver a doblar", async () => {
  const { mesa, billetera } = await preparar();
  const resultados = await Promise.allSettled([mesa.doblar(1), mesa.doblar(1), mesa.pedir(1)]);
  expect(resultados.map((resultado) => resultado.status)).toEqual(["fulfilled", "rejected", "rejected"]);
  expect(billetera.debitos).toEqual([1, 2, 1]);
  expect(mesa.snapshot().asientos[0]?.cartas).toHaveLength(3);
  mesa.detener();
});

test.each(["salir", "marcarDesconectado"] as const)("%s durante SQL espera el doblaje antes de liquidar", async (salida) => {
  const { mesa, billetera, tiempo } = await preparar();
  const original = billetera.debitarApuesta.bind(billetera);
  const inicio = Promise.withResolvers<void>();
  const bloqueo = Promise.withResolvers<void>();
  billetera.debitarApuesta = async (...args) => { inicio.resolve(); await bloqueo.promise; return original(...args); };
  const accion = mesa.doblar(1);
  await inicio.promise;
  mesa[salida](1);
  expect(mesa.snapshot().turnoDe).toBe(1);
  tiempo.avanzar(TIEMPO_TURNO_MS);
  bloqueo.resolve(); await accion; await mesa.esperarOperaciones();
  expect(mesa.snapshot().asientos[0]).toMatchObject({ conectado: false, apuesta: 200, estado: "PLANTADO" });
  expect(mesa.snapshot().turnoDe).toBe(2);
  expect(tiempo.maximo).toBe(1);
  mesa.detener();
});
