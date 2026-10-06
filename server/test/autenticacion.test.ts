/** T-08: autenticación y registro atómico contra PostgreSQL y WebSockets reales. */
import { afterAll, afterEach, beforeAll, expect, describe, test } from "bun:test";
import type { Server } from "bun";
import type { DatosConexion } from "../src/ws/Enrutador";
import { EQUIPADO_INICIAL } from "../src/config";
import { Sesiones } from "../src/auth/Sesiones";
import { crearEnrutadorAutenticado } from "../src/auth/manejadores";
import { BilleteraSQL } from "../src/store/BilleteraSQL";
import { iniciarServidor } from "../src/ws/servidor";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

const destino = process.env.TEST_DATABASE_URL;
(destino ? describe : describe.skip)("T-08: SQL y WebSocket real", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let sesiones: Sesiones;
  let servidor: Server<DatosConexion>;
  const clientes: ClienteWsPrueba[] = [];
  const nombre = () => `h_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

  function iniciar() {
    const billetera = new BilleteraSQL(base.conexion);
    return iniciarServidor(0, crearEnrutadorAutenticado(sesiones, {
      "billetera.consultar": async (socket) => ({ type: "billetera", ...await billetera.consultar(socket.data.usuarioId!) }),
    }));
  }
  async function conectar() {
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    clientes.push(cliente);
    return cliente;
  }
  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    sesiones = new Sesiones(base.conexion);
    servidor = iniciar();
  });
  afterEach(async () => { await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar())); });
  afterAll(async () => { servidor?.stop(true); if (base) await base.cerrar(); });

  test("registro entrega $10000, 500 fichas, los tres gratuitos y un token de siete días", async () => {
    const cliente = await conectar();
    const respuesta = await cliente.enviar({ type: "registro", usuario: nombre(), contrasena: "secreto08" });
    expect(respuesta.type).toBe("sesion");
    if (respuesta.type !== "sesion") throw new Error("No hubo sesión");
    expect(respuesta.billetera).toMatchObject({ dinero: 10000, fichas: 500, compradoHoy: 0 });
    expect(respuesta.equipado).toEqual(EQUIPADO_INICIAL);
    const [usuario] = await base.conexion<{ hash: string }[]>`SELECT hash FROM usuarios WHERE id = ${respuesta.usuario.id}`;
    expect(usuario!.hash.startsWith("$argon2id$")).toBe(true);
    expect(usuario!.hash).not.toContain("secreto08");
    const inventario = await base.conexion<{ articulo_id: string }[]>`SELECT articulo_id FROM inventario WHERE usuario_id = ${respuesta.usuario.id}`;
    expect(inventario.map((fila) => fila.articulo_id).sort()).toEqual(Object.values(EQUIPADO_INICIAL).sort());
    const movimientos = await base.conexion`SELECT tipo, delta_dinero::int, delta_fichas::int FROM movimientos WHERE usuario_id = ${respuesta.usuario.id}`;
    expect([...movimientos]).toEqual([{ tipo: "registro", delta_dinero: 10000, delta_fichas: 500 }]);
    const [vigencia] = await base.conexion<{ segundos: number }[]>`SELECT extract(epoch FROM expira_en - creado_en)::float8 AS segundos FROM sesiones WHERE token = ${respuesta.token}`;
    expect(vigencia!.segundos).toBeCloseTo(7 * 24 * 60 * 60, 0);
    expect(JSON.stringify(respuesta)).not.toContain("hash");
  });

  test("cerrar pestaña y reiniciar servidor conserva el token y la identidad al reanudar", async () => {
    const primera = await conectar();
    const sesion = await primera.enviar({ type: "registro", usuario: nombre(), contrasena: "secreto08" });
    if (sesion.type !== "sesion") throw new Error("No hubo sesión");
    await primera.cerrar();
    servidor.stop(true);
    servidor = iniciar();
    const segunda = await conectar();
    expect(await segunda.enviar({ type: "reanudar", token: sesion.token })).toMatchObject({ type: "sesion", token: sesion.token, usuario: sesion.usuario });
    expect(await segunda.enviar({ type: "billetera.consultar" })).toMatchObject({ type: "billetera", dinero: 10000, fichas: 500 });
  });

  test("usuario repetido y contraseña incorrecta devuelven los códigos del contrato", async () => {
    const usuario = nombre();
    const sesion = await sesiones.registrar(usuario, "secreto08");
    const cliente = await conectar();
    expect(await cliente.enviar({ type: "registro", usuario, contrasena: "secreto08" })).toMatchObject({ codigo: "USUARIO_EXISTE" });
    expect(await cliente.enviar({ type: "login", usuario, contrasena: "incorrecta" })).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
    expect(await cliente.enviar({ type: "login", usuario: nombre(), contrasena: "secreto08" })).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
    const login = await cliente.enviar({ type: "login", usuario, contrasena: "secreto08" });
    expect(login).toMatchObject({ type: "sesion", usuario: sesion.usuario });
    if (login.type === "sesion") expect(login.token).not.toBe(sesion.token);
  });

  test("logout revoca el token compartido, limpia la conexión y permite iniciar otra sesión", async () => {
    const usuario = nombre();
    const primera = await conectar();
    const sesion = await primera.enviar({ type: "registro", usuario, contrasena: "secreto08" });
    if (sesion.type !== "sesion") throw new Error("No hubo sesión");
    const segunda = await conectar();
    expect(await segunda.enviar({ type: "reanudar", token: sesion.token })).toMatchObject({ type: "sesion" });
    expect(await primera.enviar({ type: "logout" })).toMatchObject({ type: "ok" });
    expect(await primera.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "NO_AUTENTICADO" });
    expect(await segunda.esperar((mensaje) => mensaje.type === "error" && mensaje.reqId === undefined))
      .toMatchObject({ codigo: "SESION_INVALIDA" });
    // Puede volver a entrar inmediatamente; no necesita provocar primero una validación protegida.
    expect(await segunda.enviar({ type: "login", usuario, contrasena: "secreto08" })).toMatchObject({ type: "sesion" });
    expect(await segunda.enviar({ type: "logout" })).toMatchObject({ type: "ok" });
    expect(await segunda.enviar({ type: "reanudar", token: sesion.token })).toMatchObject({ codigo: "SESION_INVALIDA" });
    expect(await primera.enviar({ type: "reanudar", token: sesion.token })).toMatchObject({ codigo: "SESION_INVALIDA" });
    expect(await primera.enviar({ type: "login", usuario, contrasena: "secreto08" })).toMatchObject({ type: "sesion" });
  });

  test("sesión vencida se rechaza al reanudar y al usar una conexión ya autenticada", async () => {
    const cliente = await conectar();
    const sesion = await cliente.enviar({ type: "registro", usuario: nombre(), contrasena: "secreto08" });
    if (sesion.type !== "sesion") throw new Error("No hubo sesión");
    await base.conexion`UPDATE sesiones SET expira_en = clock_timestamp() - INTERVAL '1 second' WHERE token = ${sesion.token}`;
    expect(await cliente.enviar({ type: "billetera.consultar" })).toMatchObject({ codigo: "SESION_INVALIDA" });
    expect(await cliente.enviar({ type: "reanudar", token: sesion.token })).toMatchObject({ codigo: "SESION_INVALIDA" });
  });

  test("dos registros simultáneos crean una sola cuenta, inventario y movimiento", async () => {
    const usuario = nombre();
    const resultados = await Promise.allSettled([sesiones.registrar(usuario, "secreto08"), sesiones.registrar(usuario, "secreto08")]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected").map((resultado) => resultado.reason.codigo)).toEqual(["USUARIO_EXISTE"]);
    const [fila] = await base.conexion<{ inventario: number; movimientos: number; sesiones: number }[]>`
      SELECT (SELECT count(*)::int FROM inventario WHERE usuario_id = u.id) AS inventario,
        (SELECT count(*)::int FROM movimientos WHERE usuario_id = u.id) AS movimientos,
        (SELECT count(*)::int FROM sesiones WHERE usuario_id = u.id) AS sesiones FROM usuarios u WHERE usuario = ${usuario}
    `;
    expect(fila).toEqual({ inventario: 3, movimientos: 1, sesiones: 1 });
  });

  test("el mismo socket conserva el orden de registro y logout aunque los handlers sean async", async () => {
    const cliente = await conectar();
    const primero = nombre();
    const segundo = nombre();
    const registros = await Promise.all([
      cliente.enviar({ type: "registro", usuario: primero, contrasena: "secreto08" }),
      cliente.enviar({ type: "registro", usuario: segundo, contrasena: "secreto08" }),
    ]);
    expect(registros[0]).toMatchObject({ type: "sesion", usuario: { usuario: primero } });
    expect(registros[1]).toMatchObject({ codigo: "YA_AUTENTICADO" });
    expect(await base.conexion`SELECT id FROM usuarios WHERE usuario = ${segundo}`).toHaveLength(0);
    const salidas = await Promise.all([cliente.enviar({ type: "logout" }), cliente.enviar({ type: "billetera.consultar" })]);
    expect(salidas[0]).toMatchObject({ type: "ok" });
    expect(salidas[1]).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  test("si falla la última escritura, revierte también usuario, inventario y dinero", async () => {
    const usuario = nombre();
    await base.conexion.unsafe("ALTER TABLE sesiones ADD CONSTRAINT forzar_rollback CHECK (false) NOT VALID");
    try {
      let fallo: unknown;
      try { await sesiones.registrar(usuario, "secreto08"); } catch (error) { fallo = error; }
      expect(fallo).toMatchObject({ constraint: "forzar_rollback" });
      const cuentas = await base.conexion`SELECT id FROM usuarios WHERE usuario = ${usuario}`;
      expect(cuentas).toHaveLength(0);
      const [huérfanos] = await base.conexion<{ total: number }[]>`SELECT count(*)::int AS total FROM movimientos m LEFT JOIN usuarios u ON u.id = m.usuario_id WHERE u.id IS NULL`;
      expect(huérfanos!.total).toBe(0);
    } finally {
      await base.conexion.unsafe("ALTER TABLE sesiones DROP CONSTRAINT forzar_rollback");
    }
  });

  test("registro inválido no crea cuentas y un token desconocido no autentica", async () => {
    const cliente = await conectar();
    expect(await cliente.enviar({ type: "registro", usuario: "ab", contrasena: "corta" })).toMatchObject({ codigo: "MENSAJE_INVALIDO" });
    expect(await cliente.enviar({ type: "reanudar", token: "0".repeat(64) })).toMatchObject({ codigo: "SESION_INVALIDA" });
    await expect(sesiones.validar("invalido")).rejects.toMatchObject({ codigo: "SESION_INVALIDA" });
  });
});
