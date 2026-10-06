/** Integración T-24/T-34: transporte real, transacciones SQL y aislamiento de pestañas. */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { crearEnrutadorAutenticado } from "../src/auth/manejadores";
import { Sesiones } from "../src/auth/Sesiones";
import { BilleteraSQL } from "../src/store/BilleteraSQL";
import { crearManejadoresEconomia } from "../src/store/manejadores";
import { Tienda } from "../src/store/Tienda";
import type { DatosConexion } from "../src/ws/Enrutador";
import { iniciarServidor } from "../src/ws/servidor";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

const destino = process.env.TEST_DATABASE_URL;
(destino ? describe : describe.skip)("Economía por WebSocket con PostgreSQL real", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let servidor: Server<DatosConexion>;
  let sesiones: Sesiones;
  const clientes: ClienteWsPrueba[] = [];
  async function conectar() {
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    clientes.push(cliente);
    return cliente;
  }
  async function registrar() {
    const cliente = await conectar();
    const usuario = `m_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const sesion = await cliente.enviar({ type: "registro", usuario, contrasena: "economia34" });
    if (sesion.type !== "sesion") throw new Error("Falló el registro de prueba");
    return { cliente, sesion };
  }
  async function reanudar(token: string) {
    const cliente = await conectar();
    expect(await cliente.enviar({ type: "reanudar", token })).toMatchObject({ type: "sesion" });
    return cliente;
  }
  async function comprobarLibro(usuarioId: number, total: number) {
    const [fila] = await base.conexion`
      SELECT count(*)::int AS total, sum(m.delta_dinero) = u.dinero AS dinero,
        sum(m.delta_fichas) = u.fichas AS fichas
      FROM movimientos m JOIN usuarios u ON u.id = m.usuario_id
      WHERE u.id = ${usuarioId} GROUP BY u.id
    `;
    expect(fila).toEqual({ total, dinero: true, fichas: true });
  }
  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    const manejadores = crearManejadoresEconomia(new BilleteraSQL(base.conexion), new Tienda(base.conexion),
      (topic, mensaje) => servidor.publish(topic, JSON.stringify(mensaje)));
    sesiones = new Sesiones(base.conexion);
    servidor = iniciarServidor(0, crearEnrutadorAutenticado(sesiones, manejadores));
  });
  afterEach(async () => { await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar())); });
  afterAll(async () => { servidor?.stop(true); if (base) await base.cerrar(); });

  test("los seis handlers exigen sesión y las lecturas conservan reqId", async () => {
    const anonimo = await conectar();
    for (const entrada of [
      { type: "billetera.consultar" }, { type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() },
      { type: "tienda.catalogo" }, { type: "tienda.comprar", articuloId: "avatar_robot" },
      { type: "inventario.listar" }, { type: "movimientos.listar" },
    ] as const) expect(await anonimo.enviar(entrada)).toMatchObject({ codigo: "NO_AUTENTICADO" });
    const { cliente } = await registrar();
    expect(await cliente.enviar({ type: "billetera.consultar", reqId: "saldo" }))
      .toMatchObject({ type: "billetera", reqId: "saldo", dinero: 10000, fichas: 500 });
    const catalogo = await cliente.enviar({ type: "tienda.catalogo", reqId: "catalogo" });
    if (catalogo.type !== "catalogo") throw new Error("No hubo catálogo");
    expect(catalogo.reqId).toBe("catalogo");
    expect(catalogo.articulos).toHaveLength(14);
    expect(catalogo.articulos.filter((articulo) => articulo.poseido)).toHaveLength(3);
    expect(await cliente.enviar({ type: "inventario.listar", reqId: "inventario" }))
      .toMatchObject({ type: "inventario", reqId: "inventario" });
    const historial = await cliente.enviar({ type: "movimientos.listar" });
    if (historial.type !== "movimientos") throw new Error("No hubo historial");
    expect(historial.items.map((item) => item.tipo)).toEqual(["registro"]);
  });

  test("compra publica solo al usuario, sin reqId; retry no duplica el movimiento", async () => {
    const { cliente, sesion } = await registrar();
    const segunda = await reanudar(sesion.token);
    const tercero = (await registrar()).cliente;
    const desde = segunda.mensajes.length;
    const ajenosDesde = tercero.mensajes.length;
    const clave = crypto.randomUUID();
    expect(await cliente.enviar({ type: "fichas.comprar", cantidad: 1000, clave, reqId: "compra" }))
      .toMatchObject({ type: "billetera", reqId: "compra", dinero: 9000, fichas: 1500, compradoHoy: 1000 });
    const evento = await segunda.esperar((mensaje) => mensaje.type === "billetera", desde);
    expect(evento).toMatchObject({ dinero: 9000, fichas: 1500 });
    expect("reqId" in evento).toBe(false);
    expect(await segunda.enviar({ type: "fichas.comprar", cantidad: 1000, clave }))
      .toMatchObject({ dinero: 9000, fichas: 1500 });
    await tercero.enviar({ type: "ping" });
    expect(tercero.mensajes.slice(ajenosDesde).some((mensaje) => mensaje.type === "billetera")).toBe(false);
    await comprobarLibro(sesion.usuario.id, 2);
  });

  test("diez conexiones comprando a la vez respetan el límite; cantidades inválidas no cobran", async () => {
    const { cliente, sesion } = await registrar();
    const pestanas = await Promise.all(Array.from({ length: 10 }, () => reanudar(sesion.token)));
    const respuestas = await Promise.all(pestanas.map((pestana) => pestana.enviar({
      type: "fichas.comprar", cantidad: 1000, clave: crypto.randomUUID(),
    })));
    expect(respuestas.filter((respuesta) => respuesta.type === "billetera")).toHaveLength(5);
    expect(respuestas.filter((respuesta) => respuesta.type === "error").map((respuesta) => respuesta.codigo))
      .toEqual(Array(5).fill("LIMITE_DIARIO"));
    for (const cantidad of [0, -10, 10.5, 15, 1e9]) {
      expect(await cliente.enviar({ type: "fichas.comprar", cantidad, clave: crypto.randomUUID() }))
        .toMatchObject({ codigo: "CANTIDAD_INVALIDA" });
    }
    expect(await cliente.enviar({ type: "billetera.consultar" }))
      .toMatchObject({ dinero: 5000, fichas: 5500, compradoHoy: 5000, disponibleHoy: 0 });
    await comprobarLibro(sesion.usuario.id, 6);
  });

  test("tienda publica inventario y saldo; doble compra cobra una vez; historial pagina y aísla", async () => {
    const { cliente, sesion } = await registrar();
    const segunda = await reanudar(sesion.token);
    await cliente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
    await segunda.esperar((mensaje) => mensaje.type === "billetera" && mensaje.fichas === 510);
    const desde = segunda.mensajes.length;
    const clienteDesde = cliente.mensajes.length;
    const respuestas = await Promise.all([cliente, segunda].map((pestana) =>
      pestana.enviar({ type: "tienda.comprar", articuloId: "avatar_robot" })));
    expect(respuestas.filter((respuesta) => respuesta.type === "inventario")).toHaveLength(1);
    expect(respuestas.filter((respuesta) => respuesta.type === "error")).toMatchObject([{ codigo: "YA_POSEIDO" }]);
    const par = respuestas[0]?.type === "inventario" ? segunda : cliente;
    const parDesde = par === segunda ? desde : clienteDesde;
    const inventario = await par.esperar((mensaje) => mensaje.type === "inventario" && mensaje.reqId === undefined, parDesde);
    if (inventario.type !== "inventario") throw new Error("No hubo inventario");
    expect(inventario.articulos.filter((articulo) => articulo.id === "avatar_robot")).toHaveLength(1);
    expect("reqId" in inventario).toBe(false);
    const saldo = await par.esperar((mensaje) => mensaje.type === "billetera" && mensaje.reqId === undefined, parDesde);
    expect(saldo).toMatchObject({ fichas: 360, dinero: 9990 });
    const catalogo = await cliente.enviar({ type: "tienda.catalogo" });
    if (catalogo.type === "catalogo") expect(catalogo.articulos.find((articulo) => articulo.id === "avatar_robot")?.poseido).toBe(true);
    const primera = await cliente.enviar({ type: "movimientos.listar", limite: 2 });
    if (primera.type !== "movimientos") throw new Error("No hubo página");
    expect(primera.hayMas).toBe(true);
    expect(primera.items.map((item) => item.tipo)).toEqual(["compra_articulo", "compra_fichas"]);
    const siguiente = await cliente.enviar({ type: "movimientos.listar", limite: 2, antesDe: primera.items.at(-1)!.id });
    if (siguiente.type !== "movimientos") throw new Error("No hubo segunda página");
    expect(siguiente.hayMas).toBe(false);
    expect(siguiente.items.map((item) => item.tipo)).toEqual(["registro"]);
    const otro = await registrar();
    const ajeno = await otro.cliente.enviar({ type: "movimientos.listar" });
    if (ajeno.type !== "movimientos") throw new Error("No hubo historial ajeno");
    expect(ajeno.items).toHaveLength(1);
    expect(ajeno.items[0]?.id).not.toBe(siguiente.items[0]?.id);
    await comprobarLibro(sesion.usuario.id, 3);
  });

  test("errores de dinero y artículos dejan saldo e inventario intactos", async () => {
    const { cliente, sesion } = await registrar();
    await base.conexion`UPDATE usuarios SET dinero = 0 WHERE id = ${sesion.usuario.id}`;
    expect(await cliente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() }))
      .toMatchObject({ codigo: "DINERO_INSUFICIENTE" });
    for (const [articuloId, codigo] of [["no_existe", "ARTICULO_NO_EXISTE"],
      ["avatar_basico", "YA_POSEIDO"], ["tema_rojo", "FICHAS_INSUFICIENTES"]]) {
      expect(await cliente.enviar({ type: "tienda.comprar", articuloId: articuloId! })).toMatchObject({ codigo });
    }
    expect(await cliente.enviar({ type: "billetera.consultar" })).toMatchObject({ dinero: 0, fichas: 500 });
    const inventario = await cliente.enviar({ type: "inventario.listar" });
    if (inventario.type !== "inventario") throw new Error("No hubo inventario");
    expect(inventario.articulos).toHaveLength(3);
    expect(await base.conexion`SELECT id FROM movimientos WHERE usuario_id = ${sesion.usuario.id}`).toHaveLength(1);
  });

  test("logout retira ambas pestañas de token revocado del topic privado", async () => {
    const { cliente, sesion } = await registrar();
    const compartida = await reanudar(sesion.token);
    const independiente = await conectar();
    expect(await independiente.enviar({ type: "login", usuario: sesion.usuario.usuario, contrasena: "economia34" }))
      .toMatchObject({ type: "sesion" });
    await cliente.enviar({ type: "logout" });
    const desde = cliente.mensajes.length;
    const compartidaDesde = compartida.mensajes.length;
    await independiente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
    await Promise.all([cliente, compartida].map((pestana) => pestana.enviar({ type: "ping" })));
    for (const [pestana, inicio] of [[cliente, desde], [compartida, compartidaDesde]] as const) {
      expect(pestana.mensajes.slice(inicio).some((mensaje) => mensaje.type === "billetera")).toBe(false);
    }
    expect(await compartida.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  test("reanudar en vuelo termina de vincular antes de que logout revoque sus publicaciones", async () => {
    const { cliente, sesion } = await registrar();
    const reanudada = await conectar();
    const independiente = await conectar();
    await independiente.enviar({ type: "login", usuario: sesion.usuario.usuario, contrasena: "economia34" });
    const validar = sesiones.validar.bind(sesiones);
    const cerrar = sesiones.cerrar.bind(sesiones);
    const leida = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const logoutValidado = Promise.withResolvers<void>();
    let pausada = false;
    let vincularLiberado = false;
    let cerroAntes = false;
    // Detiene la respuesta SQL ya leída para reproducir la ventana validar → vincular.
    sesiones.validar = async (token) => {
      const resultado = await validar(token);
      if (token === sesion.token && !pausada) {
        pausada = true;
        leida.resolve();
        await liberar.promise;
      } else if (token === sesion.token) logoutValidado.resolve();
      return resultado;
    };
    sesiones.cerrar = async (token) => {
      if (!vincularLiberado) cerroAntes = true;
      await cerrar(token);
    };
    try {
      const entrada = reanudada.enviar({ type: "reanudar", token: sesion.token });
      await leida.promise;
      const salida = cliente.enviar({ type: "logout" });
      await logoutValidado.promise;
      await Bun.sleep(0);
      expect(cerroAntes).toBe(false);
      vincularLiberado = true;
      liberar.resolve();
      expect(await entrada).toMatchObject({ type: "sesion" });
      expect(await salida).toMatchObject({ type: "ok" });
      const desde = reanudada.mensajes.length;
      await independiente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
      await reanudada.enviar({ type: "ping" });
      expect(reanudada.mensajes.slice(desde).some((mensaje) => mensaje.type === "billetera")).toBe(false);
      expect(await reanudada.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "NO_AUTENTICADO" });
    } finally {
      liberar.resolve();
      sesiones.validar = validar;
      sesiones.cerrar = cerrar;
    }
  });
});
