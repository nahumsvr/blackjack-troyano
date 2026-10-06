/** Comprueba la composición de asientos, economía y revocación de sesión con servicios reales. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import type { DatosConexion } from "../src/ws/Enrutador";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

const destino = process.env.TEST_DATABASE_URL;
(destino ? describe : describe.skip)("Integración local de PR 21/22/24", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let servidor: Server<DatosConexion>;
  const clientes: ClienteWsPrueba[] = [];
  async function conectar() {
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    clientes.push(cliente);
    return cliente;
  }
  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    servidor = iniciarAplicacion(base.conexion, 0);
  });
  afterAll(async () => {
    await Promise.all(clientes.map((cliente) => cliente.cerrar()));
    servidor?.stop(true);
    if (base) await base.cerrar();
  });

  test("dos pestañas comparten compras y asiento; logout revoca topics y libera al nuevo dueño", async () => {
    const original = await conectar();
    const usuario = `i_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const sesion = await original.enviar({ type: "registro", usuario, contrasena: "integracion21" });
    if (sesion.type !== "sesion") throw new Error("Falló registro");
    expect(await original.enviar({ type: "mesa.unirse", mesaId: "mesa-1" })).toMatchObject({ type: "mesa.estado" });
    const reanudada = await conectar();
    expect(await reanudada.enviar({ type: "reanudar", token: sesion.token }))
      .toMatchObject({ type: "sesion", mesaId: "mesa-1" });
    expect(await original.enviar({ type: "mesa.salir" })).toMatchObject({ codigo: "NO_ESTAS_EN_MESA" });
    const desde = original.mensajes.length;
    expect(await reanudada.enviar({ type: "fichas.comprar", cantidad: 1000, clave: crypto.randomUUID() }))
      .toMatchObject({ type: "billetera", dinero: 9000, fichas: 1500 });
    expect(await original.esperar((mensaje) => mensaje.type === "billetera" && mensaje.reqId === undefined, desde))
      .toMatchObject({ dinero: 9000, fichas: 1500 });
    expect(await original.enviar({ type: "tienda.comprar", articuloId: "avatar_robot" })).toMatchObject({ type: "inventario" });
    expect(await reanudada.enviar({ type: "billetera.consultar" })).toMatchObject({ fichas: 1350 });
    const historial = await reanudada.enviar({ type: "movimientos.listar" });
    if (historial.type !== "movimientos") throw new Error("Falló historial");
    expect(historial.items.map((item) => item.tipo)).toEqual(["compra_articulo", "compra_fichas", "registro"]);
    const independiente = await conectar();
    const logoutDesde = reanudada.mensajes.length;
    expect(await original.enviar({ type: "logout" })).toMatchObject({ type: "ok" });
    await independiente.enviar({ type: "login", usuario, contrasena: "integracion21" });
    const lobby = await independiente.enviar({ type: "lobby.listar" });
    if (lobby.type !== "lobby") throw new Error("Falló lobby");
    expect(lobby.mesas[0]?.ocupados).toBe(0);
    const despuesLogout = reanudada.mensajes.length;
    await independiente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
    await independiente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await reanudada.enviar({ type: "ping" });
    expect(reanudada.mensajes.slice(despuesLogout).some((mensaje) =>
      mensaje.type === "billetera" || mensaje.type === "mesa.estado")).toBe(false);
    expect(reanudada.mensajes.slice(logoutDesde).some((mensaje) => mensaje.type === "lobby")).toBe(true);
    expect(await reanudada.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "SESION_INVALIDA" });
  });
});
