/** Regresiones PR #21: ventanas controladas de concurrencia, caducidad y eventos reales. */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { crearEnrutadorAutenticado, type RelojSesion } from "../src/auth/manejadores";
import { Sesiones } from "../src/auth/Sesiones";
import { BilleteraSQL } from "../src/store/BilleteraSQL";
import { Tienda } from "../src/store/Tienda";
import { crearManejadoresEconomia } from "../src/store/manejadores";
import type { DatosConexion, SocketConexion } from "../src/ws/Enrutador";
import { iniciarServidor } from "../src/ws/servidor";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

const destino = process.env.TEST_DATABASE_URL;
(destino ? describe : describe.skip)("Revisión PR 21 con SQL y WebSocket reales", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  const servidores: Server<DatosConexion>[] = [];
  const clientes: ClienteWsPrueba[] = [];
  function preparar(reloj: Partial<RelojSesion> = {}, alCerrar?: (socket: SocketConexion) => void) {
    const sesiones = new Sesiones(base.conexion);
    const billetera = new BilleteraSQL(base.conexion);
    const tienda = new Tienda(base.conexion);
    const enrutador = crearEnrutadorAutenticado(sesiones, crearManejadoresEconomia(billetera, tienda,
      (topic, mensaje) => servidor.publish(topic, JSON.stringify(mensaje))), {}, reloj);
    const servidor = iniciarServidor(0, enrutador, alCerrar);
    servidores.push(servidor);
    async function conectar() {
      const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
      clientes.push(cliente);
      return cliente;
    }
    return { sesiones, billetera, tienda, conectar };
  }
  async function registrar(app: ReturnType<typeof preparar>) {
    const cliente = await app.conectar();
    const sesion = await cliente.enviar({ type: "registro", usuario: `r_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`, contrasena: "revision21" });
    if (sesion.type !== "sesion") throw new Error("Falló registro");
    return { cliente, sesion };
  }
  async function compartir(app: ReturnType<typeof preparar>, token: string) {
    const cliente = await app.conectar();
    expect(await cliente.enviar({ type: "reanudar", token })).toMatchObject({ type: "sesion" });
    return cliente;
  }
  beforeAll(async () => { base = await crearBasePruebas(destino!); });
  afterEach(async () => {
    await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar()));
    for (const servidor of servidores.splice(0)) servidor.stop(true);
  });
  afterAll(async () => { if (base) await base.cerrar(); });

  test("originador recibe una respuesta; pares ven inventario antes del saldo y sin reqId", async () => {
    const app = preparar();
    const { cliente, sesion } = await registrar(app);
    const par = await compartir(app, sesion.token);
    const inicio = cliente.mensajes.length;
    await cliente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
    await par.enviar({ type: "ping" });
    expect(cliente.mensajes.slice(inicio).filter((mensaje) => mensaje.type === "billetera")).toHaveLength(1);
    const desde = par.mensajes.length;
    const propioDesde = cliente.mensajes.length;
    await cliente.enviar({ type: "tienda.comprar", articuloId: "avatar_robot" });
    await par.enviar({ type: "ping" });
    const eventos = par.mensajes.slice(desde).filter((mensaje) => mensaje.type === "inventario" || mensaje.type === "billetera");
    expect(eventos.map((mensaje) => mensaje.type)).toEqual(["inventario", "billetera"]);
    expect(eventos.every((mensaje) => mensaje.reqId === undefined)).toBe(true);
    const propios = cliente.mensajes.slice(propioDesde);
    expect(propios.filter((mensaje) => mensaje.type === "inventario")).toHaveLength(1);
    expect(propios.filter((mensaje) => mensaje.type === "billetera")).toHaveLength(1);
    expect(propios.find((mensaje) => mensaje.type === "inventario")?.reqId).toBeDefined();
  });

  test("continuación pausada después de commit no deja un saldo viejo después de otra compra", async () => {
    const app = preparar();
    const { cliente, sesion } = await registrar(app);
    const par = await compartir(app, sesion.token);
    const confirmado = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const autorizada = Promise.withResolvers<void>();
    const comprar = app.billetera.comprarFichas.bind(app.billetera);
    const comprarArticulo = app.tienda.comprar.bind(app.tienda);
    const validar = app.sesiones.validar.bind(app.sesiones);
    let entroTienda = false;
    app.billetera.comprarFichas = async (...argumentos) => {
      const estado = await comprar(...argumentos);
      confirmado.resolve();
      await liberar.promise;
      return estado;
    };
    app.tienda.comprar = async (...argumentos) => { entroTienda = true; return comprarArticulo(...argumentos); };
    const desde = cliente.mensajes.length;
    const parDesde = par.mensajes.length;
    try {
      const primera = cliente.enviar({ type: "fichas.comprar", cantidad: 1000, clave: crypto.randomUUID() });
      await confirmado.promise;
      app.sesiones.validar = async (token) => { const resultado = await validar(token); autorizada.resolve(); return resultado; };
      const segunda = par.enviar({ type: "tienda.comprar", articuloId: "avatar_robot" });
      await autorizada.promise;
      await Bun.sleep(0);
      expect(entroTienda).toBe(false);
      liberar.resolve();
      expect(await primera).toMatchObject({ fichas: 1500 });
      expect(await segunda).toMatchObject({ type: "inventario" });
      await Promise.all([cliente, par].map((pestana) => pestana.enviar({ type: "ping" })));
      for (const [pestana, inicio] of [[cliente, desde], [par, parDesde]] as const) {
        const saldos = pestana.mensajes.slice(inicio).filter((mensaje) => mensaje.type === "billetera");
        expect(saldos.map((mensaje) => mensaje.fichas)).toEqual([1500, 1350]);
      }
      expect((await app.billetera.consultar(sesion.usuario.id)).fichas).toBe(1350);
    } finally { liberar.resolve(); }
  });

  test("cerrar originador después de commit conserva publicación a otra pestaña", async () => {
    const app = preparar();
    const { cliente, sesion } = await registrar(app);
    const par = await compartir(app, sesion.token);
    const confirmado = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const comprar = app.billetera.comprarFichas.bind(app.billetera);
    app.billetera.comprarFichas = async (...argumentos) => {
      const estado = await comprar(...argumentos); confirmado.resolve(); await liberar.promise; return estado;
    };
    const desde = par.mensajes.length;
    // Se envía manualmente porque el originador cerrado no espera una respuesta directa.
    cliente.socket.send(JSON.stringify({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() }));
    await confirmado.promise;
    await cliente.cerrar();
    liberar.resolve();
    expect(await par.esperar((mensaje) => mensaje.type === "billetera", desde)).toMatchObject({ fichas: 510 });
  });

  test("caducidad SQL retira pestañas inactivas y timers; metadata interna no sale a JSON", async () => {
    let ahora = Date.now();
    let siguiente = 0;
    let esperarCierre = false;
    const timerRetirado = Promise.withResolvers<void>();
    const timers = new Map<number, { accion: () => void; demora: number }>();
    const reloj: RelojSesion = {
      ahora: () => ahora,
      programar: (accion, demora) => { const id = ++siguiente; timers.set(id, { accion, demora }); return id; },
      cancelar: (id) => {
        if (typeof id === "number") timers.delete(id);
        if (esperarCierre && timers.size === 0) timerRetirado.resolve();
      },
    };
    const app = preparar(reloj);
    const { cliente, sesion } = await registrar(app);
    const par = await compartir(app, sesion.token);
    expect("expiraEn" in sesion).toBe(false);
    const interno = await app.sesiones.validar(sesion.token);
    const [fila] = await base.conexion<{ expira_en: Date }[]>`SELECT expira_en FROM sesiones WHERE token = ${sesion.token}`;
    expect(interno.expiraEn).toBe(fila!.expira_en.getTime());
    expect(timers.size).toBe(1);
    const timer = [...timers.values()][0]!;
    expect(timer.demora).toBe(interno.expiraEn - ahora);
    const tardia = await app.conectar();
    const validar = app.sesiones.validar.bind(app.sesiones);
    const leida = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    app.sesiones.validar = async (token) => {
      const resultado = await validar(token); leida.resolve(); await liberar.promise; return resultado;
    };
    const reanudacion = tardia.enviar({ type: "reanudar", token: sesion.token });
    await leida.promise;
    ahora = interno.expiraEn;
    try {
      timer.accion();
      await Promise.all([cliente, par].map((pestana) => pestana.esperar((mensaje) => mensaje.type === "error" && mensaje.reqId === undefined)));
    } finally { liberar.resolve(); app.sesiones.validar = validar; }
    expect(await reanudacion).toMatchObject({ codigo: "SESION_INVALIDA" });
    expect(timers.size).toBe(0);
    expect(await par.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "NO_AUTENTICADO" });
    const vigente = await app.conectar();
    await vigente.enviar({ type: "login", usuario: sesion.usuario.usuario, contrasena: "revision21" });
    const desde = par.mensajes.length;
    await vigente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
    await par.enviar({ type: "ping" });
    expect(par.mensajes.slice(desde).some((mensaje) => mensaje.type === "billetera")).toBe(false);
    await vigente.enviar({ type: "logout" });
    expect(timers.size).toBe(0);
    await cliente.enviar({ type: "login", usuario: sesion.usuario.usuario, contrasena: "revision21" });
    expect(timers.size).toBe(1);
    esperarCierre = true;
    await cliente.cerrar();
    await timerRetirado.promise;
    expect(timers.size).toBe(0);
  });

  test("logout en vuelo no deshace una compra autorizada ni restaura identidad; cierre tiene hook separado", async () => {
    const cierre = Promise.withResolvers<void>();
    let identidadAlCerrar: number | undefined;
    const app = preparar({}, (socket) => { identidadAlCerrar = socket.data.usuarioId; cierre.resolve(); });
    const { cliente, sesion } = await registrar(app);
    const par = await compartir(app, sesion.token);
    const entrando = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const comprar = app.billetera.comprarFichas.bind(app.billetera);
    app.billetera.comprarFichas = async (...argumentos) => { entrando.resolve(); await liberar.promise; return comprar(...argumentos); };
    const pendiente = cliente.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
    await entrando.promise;
    await par.enviar({ type: "logout" });
    liberar.resolve();
    expect(await pendiente).toMatchObject({ type: "billetera", fichas: 510 });
    expect(await cliente.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "NO_AUTENTICADO" });
    expect((await app.billetera.consultar(sesion.usuario.id)).fichas).toBe(510);
    await cliente.enviar({ type: "login", usuario: sesion.usuario.usuario, contrasena: "revision21" });
    await cliente.cerrar();
    await cierre.promise;
    expect(identidadAlCerrar).toBe(sesion.usuario.id);
  });
});
