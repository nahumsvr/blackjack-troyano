/** T-18: máquina de estados, aislamiento del snapshot y difusión real a tres sockets. */
import { describe, expect, test } from "bun:test";
import { ErrorJuego, MesaEstadoSchema, type CartaVisible, type MensajeServidor } from "@blackjack/shared";
import { EQUIPADO_INICIAL } from "../src/config";
import { Carta } from "../src/game/Carta";
import { Mesa, type ZapatoMesa } from "../src/game/Mesa";
import { GestorMesas } from "../src/game/GestorMesas";
import { ClienteWsPrueba } from "./soporteHito1";

type EstadoPublicado = Extract<MensajeServidor, { type: "mesa.estado" }>;
const TRES_MANOS: CartaVisible["rango"][] = ["10", "8", "9", "6", "7", "10", "8", "10", "A"];

function zapatoFijo(rangos: readonly CartaVisible["rango"][]): ZapatoMesa {
  const cartas = rangos.map((rango) => new Carta("♠", rango));
  return {
    sacar: () => { const carta = cartas.shift(); if (!carta) throw new ErrorJuego("ERROR_INTERNO"); return carta; },
    barajar: () => {}, necesitaRebarajar: () => false,
  };
}

function preparar(rangos: readonly CartaVisible["rango"][] = TRES_MANOS, cantidad = 3) {
  const publicaciones: EstadoPublicado[] = [];
  const mesa = new Mesa("mesa-1", "Mesa 1", (mensaje) => {
    expect(MesaEstadoSchema.safeParse(mesa.snapshot()).success).toBe(true);
    publicaciones.push(mensaje);
  }, zapatoFijo(rangos));
  for (let id = 1; id <= cantidad; id++) mesa.unirse({ id, usuario: `jugador${id}` }, EQUIPADO_INICIAL);
  const apostar = () => { for (let id = 1; id <= cantidad; id++) mesa.registrarApuestaConfirmada(id, 10); };
  return { mesa, publicaciones, apostar };
}

describe("Mesa", () => {
  test("el dealer revela sin pedir si todos los jugadores tienen natural", () => {
    const { mesa, apostar } = preparar(["A", "10", "K", "6"], 1);
    apostar();
    mesa.cerrarApuestas();
    expect(mesa.snapshot()).toMatchObject({ fase: "PAGOS", dealer: { total: 16 } });
    expect(mesa.snapshot().dealer.cartas).toHaveLength(2);
  });
  test("recorre las seis fases, ordena turnos por asiento y limpia la siguiente ronda", () => {
    const { mesa, publicaciones, apostar } = preparar();
    const rondaId = mesa.rondaId;
    expect(mesa.fase).toBe("APUESTAS");
    apostar();
    const desde = publicaciones.length;
    mesa.cerrarApuestas();
    expect(mesa.snapshot().turnoDe).toBe(1);
    mesa.avanzarTurno();
    expect(mesa.snapshot().turnoDe).toBe(2);
    mesa.avanzarTurno();
    expect(mesa.snapshot().turnoDe).toBe(3);
    mesa.avanzarTurno();
    expect(mesa.snapshot()).toMatchObject({ fase: "PAGOS", turnoDe: null, dealer: { total: 17 } });
    expect(mesa.rondaId).toBe(rondaId);
    expect(publicaciones.slice(desde).map((mensaje) => mensaje.fase)).toEqual(["REPARTO", "TURNOS", "TURNOS", "TURNOS", "DEALER", "DEALER", "PAGOS"]);
    mesa.finalizarPagos();
    expect(mesa.rondaId).not.toBe(rondaId);
    expect(mesa.snapshot()).toMatchObject({ fase: "APUESTAS", dealer: { cartas: [], total: null } });
    expect(mesa.snapshot().asientos.filter(Boolean).every((jugador) => jugador?.apuesta === 0 && jugador.cartas.length === 0 && jugador.estado === "SIN_APUESTA")).toBe(true);
  });

  test("oculta estrictamente la segunda carta y el total hasta DEALER", () => {
    const { mesa, publicaciones, apostar } = preparar();
    apostar(); mesa.cerrarApuestas(); mesa.avanzarTurno(); mesa.avanzarTurno(); mesa.avanzarTurno();
    for (const mensaje of publicaciones) {
      if (mensaje.dealer.cartas.length === 0) continue;
      if (mensaje.fase === "REPARTO" || mensaje.fase === "TURNOS") {
        expect(mensaje.dealer.cartas).toEqual([{ palo: "♠", rango: "6" }, { oculta: true }]);
        expect(mensaje.dealer.total).toBeNull();
        expect(Object.keys(mensaje.dealer.cartas[1]!)).toEqual(["oculta"]);
      } else {
        expect(mensaje.dealer.cartas.every((carta) => !("oculta" in carta))).toBe(true);
      }
    }
  });

  test("no permite mutar cartas, asientos ni identidad mediante snapshots", () => {
    const { mesa, apostar } = preparar();
    apostar(); mesa.cerrarApuestas();
    const snapshot = mesa.snapshot();
    snapshot.asientos[0]!.cartas[0]!.rango = "A";
    snapshot.asientos[0]!.usuario = "alterado";
    snapshot.asientos[1] = null;
    snapshot.dealer.cartas[1] = { rango: "K", palo: "♥" };
    expect(mesa.snapshot().asientos[0]).toMatchObject({ usuario: "jugador1", total: 17 });
    expect(mesa.snapshot().asientos[0]!.cartas.map((carta) => carta.rango)).toEqual(["10", "7"]);
    expect(mesa.snapshot().asientos[1]).not.toBeNull();
    expect(mesa.snapshot().dealer.cartas[1]).toEqual({ oculta: true });
  });

  test("quien entra a media ronda espera y no recibe cartas ni turno", () => {
    const { mesa, apostar } = preparar();
    apostar(); mesa.cerrarApuestas();
    mesa.unirse({ id: 4, usuario: "tardio" }, EQUIPADO_INICIAL);
    expect(mesa.snapshot().asientos[3]).toMatchObject({ estado: "ESPERANDO_RONDA", apuesta: 0, cartas: [] });
    mesa.avanzarTurno(); mesa.avanzarTurno(); mesa.avanzarTurno();
    expect(mesa.fase).toBe("PAGOS");
    mesa.finalizarPagos();
    expect(mesa.snapshot().asientos[3]?.estado).toBe("SIN_APUESTA");
  });

  test("salta un natural del jugador sin concederle turno", () => {
    const { mesa, apostar } = preparar(["A", "10", "10", "K", "6", "7"], 2);
    apostar(); mesa.cerrarApuestas();
    expect(mesa.snapshot().turnoDe).toBe(2);
    expect(mesa.snapshot().asientos[0]).toMatchObject({ estado: "BLACKJACK", total: 21 });
    mesa.avanzarTurno();
    expect(mesa.fase).toBe("PAGOS");
  });

  test("natural del dealer pasa de REPARTO a DEALER/PAGOS sin turnos", () => {
    const { mesa, publicaciones, apostar } = preparar(["10", "A", "9", "K"], 1);
    apostar(); const desde = publicaciones.length; mesa.cerrarApuestas();
    expect(publicaciones.slice(desde).map((mensaje) => mensaje.fase)).toEqual(["REPARTO", "DEALER", "PAGOS"]);
    expect(mesa.snapshot().dealer.total).toBe(21);
  });

  test("si todos tienen natural pasa al dealer sin una fase TURNOS vacía", () => {
    const { mesa, publicaciones, apostar } = preparar(["A", "10", "K", "7"], 1);
    apostar(); const desde = publicaciones.length; mesa.cerrarApuestas();
    expect(publicaciones.slice(desde).map((mensaje) => mensaje.fase)).toEqual(["REPARTO", "DEALER", "PAGOS"]);
  });

  test("un asiento que sale conserva la apuesta y se libera al finalizar pagos", () => {
    const { mesa, apostar } = preparar();
    apostar(); mesa.cerrarApuestas(); mesa.salir(1);
    expect(mesa.snapshot().turnoDe).toBe(2);
    expect(mesa.snapshot().asientos[0]).toMatchObject({ conectado: false, estado: "PLANTADO", apuesta: 10 });
    mesa.salir(3); mesa.avanzarTurno();
    expect(mesa.fase).toBe("PAGOS");
    expect(mesa.snapshot().asientos[2]?.estado).toBe("PLANTADO");
    mesa.finalizarPagos();
    expect(mesa.snapshot().asientos[0]).toBeNull();
    expect(mesa.snapshot().asientos[2]).toBeNull();
  });

  test("sin apuestas reinicia y sin asientos vuelve a ESPERANDO", () => {
    const { mesa } = preparar([], 1);
    const ronda = mesa.rondaId;
    mesa.cerrarApuestas();
    expect(mesa.rondaId).not.toBe(ronda);
    mesa.salir(1);
    expect(mesa.snapshot()).toMatchObject({ fase: "ESPERANDO", turnoDe: null, asientos: [null, null, null, null, null] });
    expect(mesa.rondaId).toBeNull();
  });

  test("salida de todos los apostadores termina la ronda antes de liberar sus asientos", () => {
    const { mesa, apostar } = preparar(["10", "10", "7", "7"], 1);
    apostar(); mesa.cerrarApuestas(); mesa.salir(1);
    expect(mesa.fase).toBe("PAGOS");
    mesa.finalizarPagos();
    expect(mesa.fase).toBe("ESPERANDO");
  });

  test("rechaza pasos fuera de fase y apuestas inválidas sin cambiar estado", () => {
    const { mesa } = preparar([], 1);
    expect(() => mesa.avanzarTurno()).toThrow(new ErrorJuego("FASE_INCORRECTA"));
    expect(() => mesa.finalizarPagos()).toThrow(new ErrorJuego("FASE_INCORRECTA"));
    expect(() => mesa.registrarApuestaConfirmada(2, 10)).toThrow(new ErrorJuego("NO_ESTAS_EN_MESA"));
    expect(() => mesa.registrarApuestaConfirmada(1, 15)).toThrow(new ErrorJuego("CANTIDAD_INVALIDA"));
    mesa.registrarApuestaConfirmada(1, 10);
    expect(() => mesa.registrarApuestaConfirmada(1, 20)).toThrow(new ErrorJuego("YA_APOSTASTE"));
    expect(mesa.snapshot().asientos[0]?.apuesta).toBe(10);
  });

  test("solo rebaraja al cerrar apuestas y publica cada carta que pide el dealer", () => {
    const publicaciones: EstadoPublicado[] = [];
    const fijo = zapatoFijo(["10", "2", "7", "2", "3", "10"]);
    let rebarajados = 0;
    const mesa = new Mesa("mesa-1", "Mesa 1", (mensaje) => publicaciones.push(mensaje), {
      ...fijo, necesitaRebarajar: () => true, barajar: () => { rebarajados++; },
    });
    mesa.unirse({ id: 1, usuario: "jugador" }, EQUIPADO_INICIAL);
    mesa.registrarApuestaConfirmada(1, 10);
    expect(rebarajados).toBe(0);
    mesa.cerrarApuestas(); mesa.avanzarTurno();
    expect(rebarajados).toBe(1);
    expect(publicaciones.filter((mensaje) => mensaje.fase === "DEALER").map((mensaje) => mensaje.dealer.total)).toEqual([4, 7, 17]);
  });

  test("un fallo de extracción no deja un reparto parcial en el snapshot", () => {
    const { mesa, publicaciones, apostar } = preparar(["10"], 1);
    apostar(); const antes = mesa.snapshot(); const cantidad = publicaciones.length;
    expect(() => mesa.cerrarApuestas()).toThrow(new ErrorJuego("ERROR_INTERNO"));
    expect(mesa.snapshot()).toEqual(antes);
    expect(publicaciones.length).toBe(cantidad);
  });
});

test("el lobby solo se publica si cambia fase u ocupación", () => {
  const mensajes: { topic: string; mensaje: MensajeServidor }[] = [];
  const gestor = new GestorMesas((topic, mensaje) => mensajes.push({ topic, mensaje }));
  gestor.unirse("mesa-1", { id: 1, usuario: "jugador" }, EQUIPADO_INICIAL, "primera");
  const desde = mensajes.length;
  gestor.obtener("mesa-1").registrarApuestaConfirmada(1, 10);
  expect(mensajes.slice(desde).map(({ topic }) => topic)).toEqual(["mesa:mesa-1"]);
});

test("GestorMesas conserva dueño/ocupación y limpia su índice al liberar salidas en PAGOS", () => {
  const gestor = new GestorMesas(() => {});
  gestor.unirse("mesa-1", { id: 1, usuario: "jugador" }, EQUIPADO_INICIAL, "primera");
  const mesa = gestor.obtener("mesa-1");
  mesa.registrarApuestaConfirmada(1, 10);
  gestor.unirse("mesa-1", { id: 1, usuario: "jugador" }, EQUIPADO_INICIAL, "segunda");
  expect(() => gestor.mesaDelPropietario(1, "primera")).toThrow(new ErrorJuego("NO_ESTAS_EN_MESA"));
  expect(gestor.mesaDelPropietario(1, "segunda")).toBe(mesa);
  gestor.desconectar(1, "primera");
  expect(gestor.listar()[0]).toMatchObject({ ocupados: 1, fase: "APUESTAS" });
  gestor.salir(1, "segunda"); mesa.cerrarApuestas();
  expect(mesa.fase).toBe("PAGOS");
  mesa.finalizarPagos();
  expect(gestor.mesaDeUsuario(1)).toBeNull();
  expect(gestor.listar()[0]).toMatchObject({ ocupados: 0, fase: "ESPERANDO" });
});

test("tres sockets reciben snapshots idénticos de cada transición en menos de un segundo", async () => {
  const publicados: EstadoPublicado[] = [];
  const mesa = new Mesa("mesa-1", "Mesa 1", (mensaje) => {
    publicados.push(mensaje);
    servidor.publish("mesa:mesa-1", JSON.stringify(mensaje));
  }, zapatoFijo(TRES_MANOS));
  const servidor = Bun.serve<{ espectador: boolean }>({
    hostname: "127.0.0.1", port: 0,
    fetch: (peticion, actual) => actual.upgrade(peticion, { data: { espectador: true } }) ? undefined : new Response("WS", { status: 426 }),
    websocket: { open: (socket) => { socket.subscribe("mesa:mesa-1"); socket.send(JSON.stringify({ type: "mesa.estado", ...mesa.snapshot() })); }, message: () => {} },
  });
  const clientes: ClienteWsPrueba[] = [];
  try {
    for (let indice = 0; indice < 3; indice++) clientes.push(await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`));
    await Promise.all(clientes.map((cliente) => cliente.esperar((mensaje) => mensaje.type === "mesa.estado")));
    const acciones = [
      () => { for (let id = 1; id <= 3; id++) mesa.unirse({ id, usuario: `jugador${id}` }, EQUIPADO_INICIAL); },
      () => { for (let id = 1; id <= 3; id++) mesa.registrarApuestaConfirmada(id, 10); mesa.cerrarApuestas(); },
      () => mesa.avanzarTurno(), () => mesa.avanzarTurno(), () => mesa.avanzarTurno(), () => mesa.finalizarPagos(),
    ];
    for (const accion of acciones) {
      const offsets = clientes.map((cliente) => cliente.mensajes.length);
      const desde = publicados.length;
      const inicio = performance.now();
      accion();
      const esperados = publicados.slice(desde);
      await Promise.all(clientes.map((cliente, indice) => cliente.esperar(() => cliente.mensajes.length >= offsets[indice]! + esperados.length, offsets[indice])));
      expect(performance.now() - inicio).toBeLessThan(1000);
      for (const [indice, cliente] of clientes.entries()) expect(cliente.mensajes.slice(offsets[indice])).toEqual(esperados);
    }
    expect(new Set(publicados.map((mensaje) => mensaje.fase))).toEqual(new Set(["APUESTAS", "REPARTO", "TURNOS", "DEALER", "PAGOS"]));
  } finally {
    await Promise.all(clientes.map((cliente) => cliente.cerrar()));
    servidor.stop(true);
  }
});
