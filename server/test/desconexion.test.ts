/** T-36: reservas, turnos y carreras en memoria; cierre/reanudación con WS y PostgreSQL reales. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { ErrorJuego, type MensajeServidor } from "@blackjack/shared";
import { EQUIPADO_INICIAL, RESERVA_ASIENTO_MS, TIEMPO_TURNO_MS, TIEMPO_RESULTADOS_MS } from "../src/config";
import { Sesiones, type Sesion } from "../src/auth/Sesiones";
import { Mesa } from "../src/game/Mesa";
import { GestorMesas } from "../src/game/GestorMesas";
import type { DatosConexion } from "../src/ws/Enrutador";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { BilleteraMemoria, crearZapatoFijo, TiempoManual } from "./soporteMesa";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

function preparar(cantidad = 3) {
  const tiempo = new TiempoManual();
  const publicados: MensajeServidor[] = [];
  // Todos tienen 17 y el dealer también: ningún avance necesita cartas adicionales.
  const cartas = [...Array<string>(cantidad + 1).fill("10"), ...Array<string>(cantidad + 1).fill("7")] as ("10" | "7")[];
  const mesa = new Mesa("mesa-1", "Mesa 1", (mensaje) => publicados.push(mensaje), crearZapatoFijo(cartas), tiempo.reloj);
  for (let id = 1; id <= cantidad; id++) mesa.unirse({ id, usuario: `jugador${id}` }, EQUIPADO_INICIAL);
  function repartir() {
    for (let id = 1; id <= cantidad; id++) mesa.registrarApuestaConfirmada(id, 10);
    tiempo.avanzar(0);
  }
  return { mesa, tiempo, publicados, repartir };
}

test("cerrar en turno planta inmediatamente; volver conserva cartas, apuesta y el plazo ajeno", () => {
  const { mesa, tiempo, repartir } = preparar();
  repartir(); const mano = mesa.snapshot().asientos[0]!;
  mesa.marcarDesconectado(1);
  expect(mesa.snapshot().turnoDe).toBe(2);
  expect(mesa.snapshot().asientos[0]).toMatchObject({ conectado: false, estado: "PLANTADO", apuesta: 10 });
  const finEn = mesa.snapshot().finEn;
  tiempo.avanzar(1000);
  mesa.unirse({ id: 1, usuario: "jugador1" }, EQUIPADO_INICIAL);
  expect(mesa.snapshot().asientos[0]).toMatchObject({ conectado: true, cartas: mano.cartas, apuesta: mano.apuesta, estado: "PLANTADO" });
  expect(mesa.snapshot().finEn).toBe(finEn);
  expect(tiempo.maximo).toBe(1);
});

test("desconectado antes de su turno se planta al llegar y no bloquea al siguiente", () => {
  const { mesa, repartir } = preparar(); repartir();
  mesa.marcarDesconectado(2);
  expect(mesa.snapshot().turnoDe).toBe(1);
  expect(mesa.snapshot().asientos[1]?.estado).toBe("APOSTADO");
  mesa.avanzarTurno();
  expect(mesa.snapshot().turnoDe).toBe(3);
  expect(mesa.snapshot().asientos[1]).toMatchObject({ estado: "PLANTADO", conectado: false });
});

test("sin apuesta no participa; una apuesta confirmada del desconectado se reparte y liquida", () => {
  const { mesa, tiempo } = preparar();
  mesa.registrarApuestaConfirmada(1, 10);
  mesa.registrarApuestaConfirmada(2, 10);
  mesa.marcarDesconectado(2); mesa.marcarDesconectado(3);
  tiempo.avanzar(0);
  expect(mesa.snapshot().asientos[1]).toMatchObject({ apuesta: 10, conectado: false, cartas: [{ rango: "10" }, { rango: "7" }] });
  expect(mesa.snapshot().asientos[2]).toMatchObject({ apuesta: 0, cartas: [] });
  mesa.avanzarTurno();
  expect(mesa.fase).toBe("PAGOS");
});

test("reserva sin apuestas dura exactamente 60 s incluso con renovaciones de APUESTAS", () => {
  const { mesa, tiempo } = preparar(1);
  mesa.marcarDesconectado(1);
  tiempo.avanzar(RESERVA_ASIENTO_MS - 1);
  expect(mesa.contiene(1)).toBe(true);
  tiempo.avanzar(1);
  expect(mesa.snapshot()).toMatchObject({ fase: "ESPERANDO", finEn: null, asientos: [null, null, null, null, null] });
  expect(tiempo.pendientes.size).toBe(0);
  expect(tiempo.maximo).toBe(1);
});

test("reserva vencida durante una mano retiene la apuesta hasta finalizar PAGOS", () => {
  const { mesa, tiempo, repartir } = preparar(5); repartir();
  mesa.marcarDesconectado(5);
  tiempo.avanzar(RESERVA_ASIENTO_MS);
  expect(mesa.contiene(5)).toBe(true);
  expect(mesa.snapshot().turnoDe).toBe(4);
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_TURNO_MS);
  tiempo.avanzar(TIEMPO_TURNO_MS);
  expect(mesa.fase).toBe("PAGOS");
  expect(mesa.snapshot().asientos[4]).toMatchObject({ estado: "PLANTADO", apuesta: 10 });
  tiempo.avanzar(TIEMPO_RESULTADOS_MS);
  expect(mesa.contiene(5)).toBe(false);
  expect(tiempo.maximo).toBe(1);
});

test("reconectar cancela la reserva antigua y una nueva desconexión obtiene sus propios 60 s", () => {
  const { mesa, tiempo } = preparar(1);
  mesa.marcarDesconectado(1);
  const anterior = [...tiempo.pendientes.values()][0]!.accion;
  tiempo.avanzar(RESERVA_ASIENTO_MS - 1);
  mesa.unirse({ id: 1, usuario: "jugador1" }, EQUIPADO_INICIAL);
  anterior(); tiempo.avanzar(1);
  expect(mesa.snapshot().asientos[0]?.conectado).toBe(true);
  mesa.marcarDesconectado(1);
  tiempo.avanzar(RESERVA_ASIENTO_MS - 1); expect(mesa.contiene(1)).toBe(true);
  tiempo.avanzar(1); expect(mesa.contiene(1)).toBe(false);
});

test("múltiples reservas conservan el plazo de fase; salir o detener cancela los timers", () => {
  const { mesa, tiempo, repartir } = preparar(); repartir();
  const plazo = mesa.snapshot().finEn;
  mesa.marcarDesconectado(2); mesa.marcarDesconectado(3);
  expect(mesa.snapshot().finEn).toBe(plazo);
  expect(tiempo.maximo).toBe(1);
  mesa.detener(); mesa.marcarDesconectado(1);
  expect(tiempo.pendientes.size).toBe(0);
  expect(mesa.snapshot().finEn).toBeNull();
  const otra = preparar(1);
  otra.mesa.marcarDesconectado(1); otra.mesa.salir(1);
  expect(otra.tiempo.pendientes.size).toBe(0);
});

test("el gestor limpia la ubicación al vencer y un cierre tardío no desconecta al nuevo dueño", () => {
  const tiempo = new TiempoManual();
  const gestor = new GestorMesas(() => {}, () => {}, {}, (id, nombre, publicar) => new Mesa(id, nombre, publicar, undefined, tiempo.reloj));
  gestor.unirse("mesa-1", { id: 1, usuario: "uno" }, EQUIPADO_INICIAL, "primera");
  gestor.unirse("mesa-1", { id: 1, usuario: "uno" }, EQUIPADO_INICIAL, "segunda");
  gestor.desconectar(1, "primera");
  expect(gestor.snapshot("mesa-1").asientos[0]?.conectado).toBe(true);
  expect(() => gestor.mesaDelPropietario(1, "primera")).toThrow(new ErrorJuego("NO_ESTAS_EN_MESA"));
  gestor.desconectar(1, "segunda");
  tiempo.avanzar(RESERVA_ASIENTO_MS);
  expect(gestor.mesaDeUsuario(1)).toBeNull();
  expect(gestor.listar()[0]?.ocupados).toBe(0);
});

test.each([true, false])("reserva vencida mientras el débito está pendiente: confirmado=%s", async (confirmar) => {
  const tiempo = new TiempoManual();
  const billetera = new BilleteraMemoria();
  const original = billetera.debitarApuesta.bind(billetera);
  let liberar!: () => void, iniciar!: () => void;
  const bloqueo = new Promise<void>((resolver) => { liberar = resolver; });
  const iniciada = new Promise<void>((resolver) => { iniciar = resolver; });
  billetera.debitarApuesta = async (...args) => {
    iniciar(); await bloqueo;
    if (!confirmar) throw new ErrorJuego("FICHAS_INSUFICIENTES");
    return original(...args);
  };
  const mesa = new Mesa("mesa-1", "Mesa 1", () => {}, crearZapatoFijo(["10", "10", "7", "7"]), tiempo.reloj, { billetera });
  mesa.unirse({ id: 1, usuario: "uno" }, EQUIPADO_INICIAL);
  const apuesta = mesa.apostar(1, 10).catch((error: unknown) => error);
  await iniciada; mesa.marcarDesconectado(1);
  tiempo.avanzar(RESERVA_ASIENTO_MS);
  expect(mesa.contiene(1)).toBe(true);
  liberar(); await apuesta; await mesa.esperarOperaciones();
  if (confirmar) {
    expect(mesa.fase).toBe("PAGOS");
    expect(mesa.snapshot().asientos[0]).toMatchObject({ apuesta: 10, estado: "PLANTADO" });
    mesa.finalizarPagos();
    expect(billetera.debitos).toEqual([1]);
  } else expect(billetera.debitos).toEqual([]);
  expect(mesa.contiene(1)).toBe(false);
});

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("T-36 con tres sockets y SQL", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let servidor: Server<DatosConexion>;
  let sesiones: Sesion[];
  let tiempo: TiempoManual;
  const clientes: ClienteWsPrueba[] = [];
  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    const auth = new Sesiones(base.conexion);
    sesiones = await Promise.all([1, 2, 3].map((id) => auth.registrar(`reconexion${id}`, "clave_prueba")));
  });
  beforeEach(() => {
    servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) => {
      const manual = new TiempoManual();
      if (id === "mesa-1") tiempo = manual;
      return new Mesa(id, nombre, publicar, crearZapatoFijo(["10", "10", "10", "10", "7", "7", "7", "7"]), manual.reloj, servicios);
    });
  });
  afterEach(async () => { await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar())); await servidor.stop(true); });
  afterAll(async () => { await base.cerrar(); });
  async function conectar(indice: number) {
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    clientes.push(cliente);
    const sesion = await cliente.enviar({ type: "reanudar", token: sesiones[indice]!.token });
    return { cliente, sesion };
  }
  async function repartir() {
    const jugadores = await Promise.all([0, 1, 2].map(conectar));
    for (const { cliente } of jugadores) await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    for (const { cliente } of jugadores) await cliente.enviar({ type: "apostar", cantidad: 10 });
    tiempo.avanzar(0);
    await Promise.all(jugadores.map(({ cliente }) => cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.fase === "TURNOS")));
    return jugadores.map(({ cliente }) => cliente);
  }

  test("cierre en turno avanza en <1 s; reanudar devuelve la misma mano y saldo SQL", async () => {
    const jugadores = await repartir();
    const usuarioId = sesiones[0]!.usuario.id;
    const mano = await jugadores[0]!.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.fase === "TURNOS");
    const offsets = jugadores.map((cliente) => cliente.mensajes.length);
    const inicio = performance.now();
    await jugadores[0]!.cerrar();
    const estados = await Promise.all(jugadores.slice(1).map((cliente, indice) => cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.turnoDe === sesiones[1]!.usuario.id, offsets[indice + 1])));
    expect(performance.now() - inicio).toBeLessThan(1000);
    expect(estados[0]).toEqual(estados[1]);
    const estado = estados[0]!;
    if (estado.type !== "mesa.estado") throw new Error("Falta snapshot");
    expect(estado.asientos[0]).toMatchObject({ usuarioId, conectado: false, estado: "PLANTADO" });
    expect(estado.dealer).toMatchObject({ cartas: [{ rango: "10" }, { oculta: true }] });
    tiempo.avanzar(1000);
    const nueva = await conectar(0);
    expect(nueva.sesion).toMatchObject({ type: "sesion", mesaId: "mesa-1", usuario: { id: usuarioId } });
    const recuperado = await nueva.cliente.esperar((mensaje) => mensaje.type === "mesa.estado");
    if (mano.type !== "mesa.estado" || recuperado.type !== "mesa.estado") throw new Error("Falta snapshot");
    expect(recuperado.asientos[0]).toMatchObject({ cartas: mano.asientos[0]!.cartas, apuesta: 10, conectado: true, estado: "PLANTADO" });
    const [saldo] = await base.conexion<{ fichas: string }[]>`SELECT fichas::text FROM usuarios WHERE id = ${usuarioId}`;
    expect(nueva.sesion).toMatchObject({ billetera: { fichas: Number(saldo!.fichas) } });
    await jugadores[1]!.enviar({ type: "plantarse" });
    await jugadores[2]!.enviar({ type: "plantarse" });
    const resultado = await nueva.cliente.esperar((mensaje) => mensaje.type === "ronda.resultado");
    if (resultado.type !== "ronda.resultado") throw new Error("Falta resultado");
    const filas = await base.conexion`SELECT usuario_id FROM rondas_jugadores WHERE ronda_id = ${resultado.rondaId}`;
    expect(filas).toHaveLength(3);
    tiempo.avanzar(TIEMPO_RESULTADOS_MS);
    expect(await nueva.cliente.enviar({ type: "apostar", cantidad: 10 })).toMatchObject({ type: "mesa.estado", fase: "APUESTAS" });
  });

  test("otra pestaña toma la mano; espectadora recibe snapshots, rechaza acciones y su cierre no afecta", async () => {
    const jugadores = await repartir();
    const nueva = await conectar(0);
    expect(await jugadores[0]!.enviar({ type: "pedir" })).toMatchObject({ type: "error", codigo: "NO_ESTAS_EN_MESA" });
    expect(await jugadores[0]!.enviar({ type: "plantarse" })).toMatchObject({ type: "error", codigo: "NO_ESTAS_EN_MESA" });
    const desde = jugadores[0]!.mensajes.length;
    await nueva.cliente.enviar({ type: "plantarse" });
    const visto = await jugadores[0]!.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.turnoDe === sesiones[1]!.usuario.id, desde);
    if (visto.type !== "mesa.estado") throw new Error("Falta snapshot");
    expect(visto.asientos[0]?.conectado).toBe(true);
    await jugadores[0]!.cerrar();
    const vigente = await nueva.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    if (vigente.type !== "mesa.estado") throw new Error("Falta snapshot");
    expect(vigente.asientos[0]?.conectado).toBe(true);
    expect(tiempo.maximo).toBe(1);
  });
});
