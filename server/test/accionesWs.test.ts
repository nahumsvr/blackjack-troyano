/** T-20: intenciones reales con PostgreSQL, snapshots correlacionados y saldos privados. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { Sesiones, type Sesion } from "../src/auth/Sesiones";
import { Mesa } from "../src/game/Mesa";
import type { DatosConexion } from "../src/ws/Enrutador";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";
import { crearZapatoFijo, TiempoManual } from "./soporteMesa";

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("T-20 por WebSocket y SQL", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let servidor: Server<DatosConexion>;
  let sesiones: Sesion[];
  let tiempo: TiempoManual;
  const clientes: ClienteWsPrueba[] = [];
  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    const auth = new Sesiones(base.conexion);
    sesiones = await Promise.all([1, 2, 3].map((id) => auth.registrar(`jugador${id}`, "clave_prueba")));
  });
  beforeEach(() => {
    servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) => {
      const reloj = new TiempoManual();
      if (id === "mesa-1") tiempo = reloj;
      return new Mesa(id, nombre, publicar, crearZapatoFijo(["10", "8", "9", "10", "7", "9", "8", "7", "2"]), reloj.reloj, servicios);
    });
  });
  afterEach(async () => { await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar())); servidor.stop(true); });
  afterAll(async () => { await base.cerrar(); });
  async function conectar(indice: number) {
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    clientes.push(cliente);
    await cliente.enviar({ type: "reanudar", token: sesiones[indice]!.token });
    return cliente;
  }
  async function sentarTres() {
    const jugadores = await Promise.all([0, 1, 2].map(conectar));
    for (const jugador of jugadores) await jugador.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    return jugadores;
  }
  test("cantidades del checklist, doble apuesta, saldo insuficiente y errores no cobran", async () => {
    const jugadores = await sentarTres();
    const cliente = jugadores[0]!;
    for (const cantidad of [15, 0, -10, 10.5, "abc", 600]) {
      const desde = cliente.mensajes.length;
      cliente.socket.send(JSON.stringify({ type: "apostar", cantidad, reqId: "invalida" }));
      expect(await cliente.esperar((mensaje) => mensaje.reqId === "invalida", desde)).toMatchObject({ type: "error", codigo: "CANTIDAD_INVALIDA" });
    }
    const usuarioId = sesiones[0]!.usuario.id;
    const [antes] = await base.conexion<{ fichas: string }[]>`SELECT fichas::text FROM usuarios WHERE id = ${usuarioId}`;
    const resultados = await Promise.all([cliente.enviar({ type: "apostar", cantidad: 10 }), cliente.enviar({ type: "apostar", cantidad: 20 })]);
    expect(resultados[0]).toMatchObject({ type: "mesa.estado", fase: "APUESTAS" });
    expect(resultados[1]).toMatchObject({ type: "error", codigo: "YA_APOSTASTE" });
    const [despues] = await base.conexion<{ fichas: string }[]>`SELECT fichas::text FROM usuarios WHERE id = ${usuarioId}`;
    expect(Number(despues!.fichas)).toBe(Number(antes!.fichas) - 10);
    const usuarioSinSaldo = sesiones[2]!.usuario.id;
    await base.conexion`UPDATE usuarios SET fichas = 0 WHERE id = ${usuarioSinSaldo}`;
    expect(await jugadores[2]!.enviar({ type: "apostar", cantidad: 10 })).toMatchObject({ type: "error", codigo: "FICHAS_INSUFICIENTES" });
  });
  test("tres clientes reciben la misma mano, se valida turno y solo el usuario recibe su saldo", async () => {
    const jugadores = await sentarTres();
    const espejo = await conectar(0);
    await jugadores[0]!.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await jugadores[0]!.enviar({ type: "apostar", cantidad: 10 });
    expect(await espejo.esperar((mensaje) => mensaje.type === "billetera")).toMatchObject({ type: "billetera" });
    expect(jugadores[1]!.mensajes.some((mensaje) => mensaje.type === "billetera" && !mensaje.reqId)).toBe(false);
    await jugadores[1]!.enviar({ type: "apostar", cantidad: 10 });
    const usuarioId = sesiones[2]!.usuario.id;
    await base.conexion`UPDATE usuarios SET fichas = 500 WHERE id = ${usuarioId}`;
    await jugadores[2]!.enviar({ type: "apostar", cantidad: 10 });
    tiempo.avanzar(0);
    const estados = await Promise.all(jugadores.map((cliente) => cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.fase === "TURNOS")));
    expect(estados[0]).toEqual(estados[1]); expect(estados[1]).toEqual(estados[2]);
    expect(estados[0]).toMatchObject({ finEn: tiempo.ahora() + 20000 });
    expect(await jugadores[1]!.enviar({ type: "pedir" })).toMatchObject({ type: "error", codigo: "NO_ES_TU_TURNO" });
    expect(await jugadores[1]!.enviar({ type: "plantarse" })).toMatchObject({ type: "error", codigo: "NO_ES_TU_TURNO" });
    expect(await jugadores[0]!.enviar({ type: "apostar", cantidad: 10 })).toMatchObject({ type: "error", codigo: "FASE_INCORRECTA" });
    expect(await jugadores[0]!.enviar({ type: "pedir" })).toMatchObject({ type: "mesa.estado", turnoDe: sesiones[0]!.usuario.id });
    expect(await jugadores[0]!.enviar({ type: "plantarse" })).toMatchObject({ type: "mesa.estado", turnoDe: sesiones[1]!.usuario.id });
  });
  test("la pestaña sustituida no puede actuar ni generar un segundo débito", async () => {
    const jugadores = await sentarTres();
    const nueva = await conectar(0);
    await nueva.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    expect(await jugadores[0]!.enviar({ type: "apostar", cantidad: 10 })).toMatchObject({ type: "error", codigo: "NO_ESTAS_EN_MESA" });
    expect(await nueva.enviar({ type: "apostar", cantidad: 10 })).toMatchObject({ type: "mesa.estado" });
  });
});
