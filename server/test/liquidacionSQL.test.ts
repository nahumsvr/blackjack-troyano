/** T-21: rondas completas por WS, persistencia atómica e idempotencia con PostgreSQL real. */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { ErrorJuego } from "@blackjack/shared";
import { Sesiones } from "../src/auth/Sesiones";
import { TIEMPO_RESULTADOS_MS, TIEMPO_TURNO_MS } from "../src/config";
import { HistorialSQL } from "../src/db/HistorialSQL";
import { Mesa } from "../src/game/Mesa";
import type { RondaTerminada } from "../src/game/RondaTerminada";
import { BilleteraSQL } from "../src/store/BilleteraSQL";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import type { DatosConexion } from "../src/ws/Enrutador";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";
import { crearZapatoFijo, TiempoManual } from "./soporteMesa";

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("T-21 con PostgreSQL 16", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let servidor: Server<DatosConexion> | undefined;
  const clientes: ClienteWsPrueba[] = [];
  let secuencia = 0;
  beforeAll(async () => { base = await crearBasePruebas(destino!); });
  afterEach(async () => { await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar())); await servidor?.stop(true); servidor = undefined; });
  afterAll(async () => { await base.cerrar(); });

  async function crearUsuario() { return new Sesiones(base.conexion).registrar(`liquidacion${++secuencia}`, "clave_prueba"); }
  async function reconciliar() {
    const [fila] = await base.conexion<{ discrepancias: number }[]>`
      SELECT count(*)::int AS discrepancias FROM usuarios u
      LEFT JOIN (SELECT usuario_id, sum(delta_dinero) AS dinero, sum(delta_fichas) AS fichas
        FROM movimientos GROUP BY usuario_id) m ON m.usuario_id = u.id
      WHERE u.dinero <> COALESCE(m.dinero, 0) OR u.fichas <> COALESCE(m.fichas, 0)
    `;
    expect(fila!.discrepancias).toBe(0);
  }

  test("cinco rondas de tres jugadores guardan resultados/saldos y emiten un resultado idéntico", async () => {
    const sesiones = await Promise.all([1, 2, 3].map(crearUsuario));
    const motores = new Map<string, Mesa>();
    let tiempo!: TiempoManual;
    const rangos = Array.from({ length: 5 }, () => ["A", "10", "10", "10", "K", "8", "7", "7"] as const).flat();
    servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) => {
      const reloj = new TiempoManual();
      if (id === "mesa-1") tiempo = reloj;
      const mesa = new Mesa(id, nombre, publicar, crearZapatoFijo(rangos), reloj.reloj, servicios);
      motores.set(id, mesa);
      return mesa;
    });
    for (const sesion of sesiones) {
      const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
      clientes.push(cliente);
      await cliente.enviar({ type: "reanudar", token: sesion.token });
      await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    }
    const mesa = motores.get("mesa-1")!;
    for (let numero = 0; numero < 5; numero++) {
      const rondaId = mesa.rondaId!;
      const desde = clientes.map((cliente) => cliente.mensajes.length);
      for (const cliente of clientes) expect((await cliente.enviar({ type: "apostar", cantidad: 10 })).type).toBe("mesa.estado");
      tiempo.avanzar(0); await mesa.esperarOperaciones();
      expect(mesa.snapshot().turnoDe).toBe(sesiones[1]!.usuario.id);
      tiempo.avanzar(TIEMPO_TURNO_MS); await mesa.esperarOperaciones();
      tiempo.avanzar(TIEMPO_TURNO_MS); await mesa.esperarOperaciones();
      expect(mesa.snapshot().asientos[1]?.estado).toBe("PLANTADO");
      const resultados = await Promise.all(clientes.map((cliente, indice) => cliente.esperar((mensaje) => mensaje.type === "ronda.resultado" && mensaje.rondaId === rondaId, desde[indice])));
      expect(resultados[0]).toEqual(resultados[1]); expect(resultados[1]).toEqual(resultados[2]);
      expect(resultados[0]).toMatchObject({ resultados: [
        { resultado: "blackjack", pago: 25 }, { resultado: "gana", pago: 20 }, { resultado: "empate", pago: 10 },
      ] });
      const filas = await base.conexion<{ usuario_id: number; resultado: string; pago: number; cartas: unknown[] }[]>`
        SELECT usuario_id, resultado, pago, cartas FROM rondas_jugadores WHERE ronda_id = ${rondaId} ORDER BY asiento
      `;
      expect(filas).toHaveLength(3);
      expect(filas.map(({ resultado, pago }) => ({ resultado, pago }))).toEqual([
        { resultado: "blackjack", pago: 25 }, { resultado: "gana", pago: 20 }, { resultado: "empate", pago: 10 },
      ]);
      const [ronda] = await base.conexion<{ total_dealer: number; cartas_dealer: unknown[]; orden: boolean }[]>`
        SELECT total_dealer, cartas_dealer, iniciada_en <= terminada_en AS orden FROM rondas WHERE id = ${rondaId}
      `;
      expect(ronda).toMatchObject({ total_dealer: 17, orden: true });
      expect(ronda!.cartas_dealer).toHaveLength(2);
      expect(await Promise.all(sesiones.map(async (sesion) => (await new BilleteraSQL(base.conexion).consultar(sesion.usuario.id)).fichas))).toEqual([
        500 + (numero + 1) * 15, 500 + (numero + 1) * 10, 500,
      ]);
      await reconciliar();
      expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_RESULTADOS_MS);
      tiempo.avanzar(TIEMPO_RESULTADOS_MS); await mesa.esperarOperaciones();
      expect(mesa.fase).toBe("APUESTAS");
    }
    expect(tiempo.maximo).toBe(1);
  });

  test("diez pagos concurrentes del mismo usuario/ronda acreditan una sola vez", async () => {
    const sesion = await crearUsuario();
    const billetera = new BilleteraSQL(base.conexion);
    const rondaId = crypto.randomUUID();
    await billetera.debitarApuesta(sesion.usuario.id, 10, rondaId);
    const saldos = await Promise.all(Array.from({ length: 10 }, () => billetera.acreditarPago(sesion.usuario.id, 25, rondaId)));
    expect(saldos.every((saldo) => saldo.fichas === 515)).toBe(true);
    expect(await billetera.acreditarPago(sesion.usuario.id, 30, rondaId).catch((error: unknown) => error)).toEqual(new ErrorJuego("ERROR_INTERNO"));
    const [fila] = await base.conexion<{ pagos: number }[]>`
      SELECT count(*)::int AS pagos FROM movimientos WHERE usuario_id = ${sesion.usuario.id} AND tipo = 'pago'
    `;
    expect(fila!.pagos).toBe(1);
    await reconciliar();
  });

  test("apagar completa una liquidación SQL pendiente sin duplicar un commit con respuesta perdida", async () => {
    const sesiones = await Promise.all([1, 2, 3].map(crearUsuario));
    const tiempo = new TiempoManual();
    const errores: unknown[] = [];
    let mesa!: Mesa;
    let perderRespuesta = true;
    servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) => {
      if (id !== "mesa-1") return new Mesa(id, nombre, publicar, undefined, undefined, servicios);
      const billetera = servicios.billetera!;
      mesa = new Mesa(id, nombre, publicar, crearZapatoFijo(["A", "10", "10", "10", "K", "8", "7", "7"]), tiempo.reloj, {
        ...servicios, registrarError: (error) => errores.push(error),
        billetera: { ...billetera, acreditarPago: async (usuarioId, cantidad, rondaId) => {
          const saldo = await billetera.acreditarPago(usuarioId, cantidad, rondaId);
          if (perderRespuesta) { perderRespuesta = false; throw new Error("Respuesta perdida después del commit"); }
          return saldo;
        } },
      });
      return mesa;
    });
    for (const sesion of sesiones) {
      const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
      clientes.push(cliente);
      await cliente.enviar({ type: "reanudar", token: sesion.token });
      await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    }
    for (const cliente of clientes) expect((await cliente.enviar({ type: "apostar", cantidad: 10 })).type).toBe("mesa.estado");
    const rondaId = mesa.rondaId!;
    tiempo.avanzar(0); await mesa.esperarOperaciones();
    tiempo.avanzar(TIEMPO_TURNO_MS); await mesa.esperarOperaciones();
    tiempo.avanzar(TIEMPO_TURNO_MS); await mesa.esperarOperaciones();
    expect(errores).toHaveLength(1);
    expect(await base.conexion`SELECT id FROM rondas WHERE id = ${rondaId}`).toHaveLength(0);
    await servidor.stop(true);
    expect(await base.conexion`SELECT usuario_id FROM rondas_jugadores WHERE ronda_id = ${rondaId}`).toHaveLength(3);
    const pagos = await base.conexion<{ usuario_id: number; cantidad: number }[]>`
      SELECT usuario_id, count(*)::int AS cantidad FROM movimientos
      WHERE referencia = ${`ronda:${rondaId}`} AND tipo = 'pago' GROUP BY usuario_id ORDER BY usuario_id
    `;
    expect(pagos).toHaveLength(3);
    expect(pagos.every(({ cantidad }) => cantidad === 1)).toBe(true);
    expect(tiempo.pendientes.size).toBe(0);
    await reconciliar();
  });

  test("un fallo al insertar jugadores revierte toda la ronda; reintentos iguales no duplican", async () => {
    const sesion = await crearUsuario();
    const usuarioId = sesion.usuario.id;
    const ronda: RondaTerminada = {
      id: crypto.randomUUID(), mesaId: "mesa-1", iniciadaEn: "2026-10-05T22:00:00.000Z", terminadaEn: "2026-10-05T22:01:00.000Z",
      dealer: { cartas: [{ rango: "10", palo: "♠" }, { rango: "7", palo: "♥" }], total: 17 },
      jugadores: [{ usuarioId, asiento: 0, apuesta: 10, cartas: [{ rango: "10", palo: "♥" }, { rango: "8", palo: "♦" }], total: 18, resultado: "gana", pago: 20 }],
    };
    const historial = new HistorialSQL(base.conexion);
    const error = await historial.guardar({ ...ronda, jugadores: [...ronda.jugadores, { ...ronda.jugadores[0]!, usuarioId: 2147483647, asiento: 1 }] }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(await base.conexion`SELECT id FROM rondas WHERE id = ${ronda.id}`).toHaveLength(0);
    expect(await base.conexion`SELECT usuario_id FROM rondas_jugadores WHERE ronda_id = ${ronda.id}`).toHaveLength(0);
    await Promise.all([historial.guardar(ronda), historial.guardar(ronda)]);
    expect(await base.conexion`SELECT usuario_id FROM rondas_jugadores WHERE ronda_id = ${ronda.id}`).toHaveLength(1);
    expect(await historial.guardar({ ...ronda, jugadores: [{ ...ronda.jugadores[0]!, pago: 30 }] }).catch((error: unknown) => error)).toEqual(new ErrorJuego("ERROR_INTERNO"));
    await reconciliar();
  });
});
