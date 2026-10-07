/** T-20: validaciones del motor y carreras controladas entre débito, salida y vencimiento. */
import { expect, test } from "bun:test";
import { ErrorJuego } from "@blackjack/shared";
import { EQUIPADO_INICIAL, TIEMPO_APUESTAS_MS } from "../src/config";
import { Mesa } from "../src/game/Mesa";
import { BilleteraMemoria, crearZapatoFijo, TiempoManual } from "./soporteMesa";

function preparar(rangos: Parameters<typeof crearZapatoFijo>[0] = ["10", "9", "10", "8", "8", "7", "3"]) {
  const tiempo = new TiempoManual();
  const billetera = new BilleteraMemoria();
  const mesa = new Mesa("mesa-1", "Mesa 1", () => {}, crearZapatoFijo(rangos), tiempo.reloj, { billetera });
  mesa.unirse({ id: 1, usuario: "uno" }, EQUIPADO_INICIAL);
  mesa.unirse({ id: 2, usuario: "dos" }, EQUIPADO_INICIAL);
  return { mesa, tiempo, billetera };
}

test("rechaza cantidades, asiento y saldo sin registrar ni cobrar apuestas inválidas", async () => {
  const { mesa, billetera } = preparar();
  for (const cantidad of [15, 0, -10, 10.5, 600, NaN]) {
    const error = await mesa.apostar(1, cantidad).catch((error: unknown) => error);
    expect(error).toEqual(new ErrorJuego("CANTIDAD_INVALIDA"));
  }
  expect(await mesa.apostar(3, 10).catch((error: unknown) => error)).toEqual(new ErrorJuego("NO_ESTAS_EN_MESA"));
  billetera.fichas.set(1, 0);
  expect(await mesa.apostar(1, 10).catch((error: unknown) => error)).toEqual(new ErrorJuego("FICHAS_INSUFICIENTES"));
  expect(billetera.debitos).toEqual([]);
  expect(mesa.snapshot().asientos[0]?.apuesta).toBe(0);
});

test("dos apuestas simultáneas cobran una sola y la segunda recibe YA_APOSTASTE", async () => {
  const { mesa, billetera } = preparar();
  const resultados = await Promise.allSettled([mesa.apostar(1, 10), mesa.apostar(1, 20)]);
  expect(resultados[0]!.status).toBe("fulfilled");
  expect(resultados[1]).toMatchObject({ status: "rejected", reason: new ErrorJuego("YA_APOSTASTE") });
  expect(billetera.debitos).toEqual([1]);
  expect((await billetera.consultar(1)).fichas).toBe(490);
});

test("fase y turno se validan; 21 de tres cartas planta sin convertirlo en natural", async () => {
  const { mesa, tiempo } = preparar();
  expect(await mesa.pedir(1).catch((error: unknown) => error)).toEqual(new ErrorJuego("FASE_INCORRECTA"));
  await mesa.apostar(1, 10); await mesa.apostar(2, 10);
  tiempo.avanzar(0); await mesa.esperarOperaciones();
  expect(await mesa.pedir(2).catch((error: unknown) => error)).toEqual(new ErrorJuego("NO_ES_TU_TURNO"));
  expect(await mesa.plantarse(2).catch((error: unknown) => error)).toEqual(new ErrorJuego("NO_ES_TU_TURNO"));
  expect(await mesa.apostar(1, 10).catch((error: unknown) => error)).toEqual(new ErrorJuego("FASE_INCORRECTA"));
  const fin = mesa.snapshot().finEn;
  await mesa.pedir(1);
  expect(mesa.snapshot().asientos[0]).toMatchObject({ estado: "PLANTADO", total: 21 });
  expect(mesa.snapshot().turnoDe).toBe(2);
  expect(mesa.snapshot().finEn).toBe(fin);
  await mesa.plantarse(2);
  expect(mesa.fase).toBe("PAGOS");
});

test("pedir mantiene el mismo plazo y una pasada avanza al siguiente asiento", async () => {
  const { mesa, tiempo } = preparar(["10", "9", "10", "5", "8", "7", "2", "10"]);
  await mesa.apostar(1, 10); await mesa.apostar(2, 10);
  tiempo.avanzar(0); await mesa.esperarOperaciones();
  const fin = mesa.snapshot().finEn;
  tiempo.avanzar(1000); await mesa.pedir(1);
  expect(mesa.snapshot()).toMatchObject({ turnoDe: 1, finEn: fin });
  await mesa.pedir(1);
  expect(mesa.snapshot().asientos[0]?.estado).toBe("PASADO");
  expect(mesa.snapshot().turnoDe).toBe(2);
});

test("una apuesta aceptada antes del vencimiento entra tras SQL; la tardía no se cobra", async () => {
  const { mesa, tiempo, billetera } = preparar();
  const original = billetera.debitarApuesta.bind(billetera);
  let liberar!: () => void;
  const bloqueo = new Promise<void>((resolver) => { liberar = resolver; });
  let iniciar!: () => void;
  const iniciada = new Promise<void>((resolver) => { iniciar = resolver; });
  billetera.debitarApuesta = async (...args) => { iniciar(); await bloqueo; return original(...args); };
  const apuesta = mesa.apostar(1, 10);
  await iniciada;
  tiempo.avanzar(TIEMPO_APUESTAS_MS);
  const tardia = mesa.apostar(2, 10).catch((error: unknown) => error);
  liberar(); await apuesta; await mesa.esperarOperaciones();
  expect(await tardia).toEqual(new ErrorJuego("FASE_INCORRECTA"));
  expect(mesa.fase).toBe("TURNOS");
  expect(mesa.snapshot().asientos[0]?.apuesta).toBe(10);
  expect(billetera.debitos).toEqual([1]);
});

test("salir mientras SQL confirma no pierde el asiento ni la apuesta cobrada", async () => {
  const { mesa, billetera } = preparar();
  const original = billetera.debitarApuesta.bind(billetera);
  let liberar!: () => void;
  let iniciar!: () => void;
  const bloqueo = new Promise<void>((resolver) => { liberar = resolver; });
  const iniciada = new Promise<void>((resolver) => { iniciar = resolver; });
  billetera.debitarApuesta = async (...args) => { iniciar(); await bloqueo; return original(...args); };
  const apuesta = mesa.apostar(1, 10);
  await iniciada; mesa.salir(1);
  expect(mesa.contiene(1)).toBe(true);
  liberar(); await apuesta;
  expect(mesa.snapshot().asientos[0]).toMatchObject({ conectado: false, apuesta: 10 });
});

test("revalida al propietario tras esperar la cola antes de cobrar", async () => {
  const { mesa, billetera } = preparar();
  const original = billetera.debitarApuesta.bind(billetera);
  let liberar!: () => void;
  let iniciar!: () => void;
  const bloqueo = new Promise<void>((resolver) => { liberar = resolver; });
  const iniciada = new Promise<void>((resolver) => { iniciar = resolver; });
  billetera.debitarApuesta = async (...args) => { iniciar(); await bloqueo; return original(...args); };
  const primera = mesa.apostar(1, 10);
  await iniciada;
  let propietario = true;
  const segunda = mesa.apostar(2, 10, () => { if (!propietario) throw new ErrorJuego("NO_ESTAS_EN_MESA"); }).catch((error: unknown) => error);
  propietario = false; liberar(); await primera;
  expect(await segunda).toEqual(new ErrorJuego("NO_ESTAS_EN_MESA"));
  expect(billetera.debitos).toEqual([1]);
});
