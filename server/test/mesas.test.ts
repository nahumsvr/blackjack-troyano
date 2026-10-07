/** T-09: ocupación en vivo, capacidad y propiedad entre pestañas con SQL/WS reales. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { MesaEstadoSchema, type MensajeServidor } from "@blackjack/shared";
import { EQUIPADO_INICIAL } from "../src/config";
import { GestorMesas } from "../src/game/GestorMesas";
import type { DatosConexion } from "../src/ws/Enrutador";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

test("los snapshots no permiten modificar los asientos autoritativos", () => {
  const gestor = new GestorMesas(() => {});
  const snapshot = gestor.unirse("mesa-1", { id: 1, usuario: "jugador" }, EQUIPADO_INICIAL, "socket-1");
  expect(MesaEstadoSchema.safeParse(snapshot).success).toBe(true);
  snapshot.asientos[0]!.usuario = "alterado";
  snapshot.asientos[0]!.cartas.push({ rango: "A", palo: "♠" });
  snapshot.asientos[1] = snapshot.asientos[0]!;
  expect(gestor.snapshot("mesa-1").asientos[0]).toMatchObject({ usuario: "jugador", cartas: [] });
  expect(gestor.listar()[0]!.ocupados).toBe(1);
});

const destino = process.env.TEST_DATABASE_URL;

test("repetir la unión no publica; retomar refresca cosméticos sin cambiar ocupación", () => {
  const mensajes: { topic: string; mensaje: MensajeServidor }[] = [];
  const reemplazadas: string[] = [];
  const gestor = new GestorMesas((topic, mensaje) => mensajes.push({ topic, mensaje }), (id) => reemplazadas.push(id));
  const usuario = { id: 1, usuario: "jugador" };
  gestor.unirse("mesa-1", usuario, EQUIPADO_INICIAL, "primera");
  mensajes.length = 0;
  gestor.unirse("mesa-1", usuario, EQUIPADO_INICIAL, "primera");
  expect(mensajes).toHaveLength(0);
  const snapshot = gestor.unirse("mesa-1", usuario, { ...EQUIPADO_INICIAL, avatar: "avatar_robot", reverso: "reverso_rojo" }, "segunda");
  expect(snapshot.asientos[0]).toMatchObject({ avatar: "avatar_robot", reverso: "reverso_rojo", conectado: true });
  expect(reemplazadas).toEqual(["primera"]);
  expect(mensajes.map(({ topic }) => topic)).toEqual(["mesa:mesa-1"]);
  gestor.desconectar(1, "primera");
  expect(gestor.listar()[0]?.ocupados).toBe(1);
});
describe.skipIf(!destino)("GestorMesas con servidor completo", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let servidor: Server<DatosConexion>;
  const clientes: ClienteWsPrueba[] = [];
  let secuencia = 0;

  beforeAll(async () => { base = await crearBasePruebas(destino!); });
  beforeEach(() => { servidor = iniciarAplicacion(base.conexion, 0); });
  afterEach(async () => {
    await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar()));
    servidor.stop(true);
  });
  afterAll(async () => { await base.cerrar(); });

  async function conectar(): Promise<ClienteWsPrueba> {
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    clientes.push(cliente);
    return cliente;
  }

  async function registrar() {
    const cliente = await conectar();
    const sesion = await cliente.enviar({ type: "registro", usuario: `mesa09_${++secuencia}`, contrasena: "secreto09" });
    if (sesion.type !== "sesion") throw new Error("Registro fallido");
    return { cliente, sesion };
  }

  function ocupados(mensaje: MensajeServidor, cantidad: number): boolean {
    return mensaje.type === "lobby" && mensaje.reqId === undefined && mensaje.mesas[0]?.ocupados === cantidad;
  }

  test("tres usuarios listan tres mesas y reciben ocupación 1/5 y 0/5 en menos de un segundo", async () => {
    const usuarios = await Promise.all([registrar(), registrar(), registrar()]);
    for (const { cliente } of usuarios) {
      const lobby = await cliente.enviar({ type: "lobby.listar" });
      expect(lobby).toMatchObject({ type: "lobby" });
      if (lobby.type !== "lobby") throw new Error("No hubo lobby");
      expect(lobby.mesas.map((mesa) => mesa.id)).toEqual(["mesa-1", "mesa-2", "mesa-3"]);
      expect(lobby.mesas.every((mesa) => mesa.capacidad === 5 && mesa.ocupados === 0)).toBe(true);
    }
    const otros = usuarios.slice(1).map(({ cliente }) => cliente);
    let esperas = otros.map((cliente) => cliente.esperar((mensaje) => ocupados(mensaje, 1), cliente.mensajes.length));
    const inicio = performance.now();
    const snapshot = await usuarios[0]!.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await Promise.all(esperas);
    expect(performance.now() - inicio).toBeLessThan(1000);
    expect(snapshot).toMatchObject({ type: "mesa.estado", fase: "APUESTAS", asientos: [{ usuarioId: usuarios[0]!.sesion.usuario.id }, null, null, null, null] });
    esperas = otros.map((cliente) => cliente.esperar((mensaje) => ocupados(mensaje, 0), cliente.mensajes.length));
    expect(await usuarios[0]!.cliente.enviar({ type: "mesa.salir" })).toMatchObject({ type: "ok" });
    await Promise.all(esperas);
  });

  test("seis uniones simultáneas ocupan solo cinco asientos y rechazan la sexta", async () => {
    const usuarios = await Promise.all(Array.from({ length: 6 }, () => registrar()));
    const respuestas = await Promise.all(usuarios.map(({ cliente }) => cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" })));
    expect(respuestas.filter((mensaje) => mensaje.type === "mesa.estado")).toHaveLength(5);
    expect(respuestas.filter((mensaje) => mensaje.type === "error")).toMatchObject([{ codigo: "MESA_LLENA" }]);
    expect(await usuarios[0]!.cliente.enviar({ type: "lobby.listar" })).toMatchObject({ mesas: [{ ocupados: 5, capacidad: 5 }, { ocupados: 0 }, { ocupados: 0 }] });
  });

  test("valida mesa existente, un asiento por usuario y acceso autenticado", async () => {
    const anonimo = await conectar();
    for (const entrada of [{ type: "lobby.listar" }, { type: "mesa.unirse", mesaId: "mesa-1" }, { type: "mesa.salir" }] as const) {
      expect(await anonimo.enviar(entrada)).toMatchObject({ codigo: "NO_AUTENTICADO" });
    }
    const { cliente } = await registrar();
    expect(await cliente.enviar({ type: "mesa.salir" })).toMatchObject({ codigo: "NO_ESTAS_EN_MESA" });
    expect(await cliente.enviar({ type: "mesa.unirse", mesaId: "inexistente" })).toMatchObject({ codigo: "MESA_NO_EXISTE" });
    expect(await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" })).toMatchObject({ type: "mesa.estado" });
    expect(await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-2" })).toMatchObject({ codigo: "YA_EN_OTRA_MESA" });
    expect(await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" })).toMatchObject({ type: "mesa.estado" });
    expect(await cliente.enviar({ type: "lobby.listar" })).toMatchObject({ mesas: [{ ocupados: 1 }, { ocupados: 0 }, { ocupados: 0 }] });
  });

  test("otra pestaña toma el asiento; la espectadora recibe estados y sale sin liberar al nuevo dueño", async () => {
    const primera = await registrar();
    await primera.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const segunda = await conectar();
    const reemplazo = primera.cliente.esperar((mensaje) => mensaje.type === "error" && mensaje.codigo === "NO_ESTAS_EN_MESA", primera.cliente.mensajes.length);
    const reanudada = await segunda.enviar({ type: "reanudar", token: primera.sesion.token });
    const aviso = await reemplazo;
    expect(aviso).toMatchObject({ type: "error", codigo: "NO_ESTAS_EN_MESA", mensaje: "Otra pestaña tomó tu asiento; ahora solo miras la mesa." });
    expect(aviso.reqId).toBeUndefined();
    expect(reanudada).toMatchObject({ type: "sesion", mesaId: "mesa-1", usuario: primera.sesion.usuario });
    expect(segunda.mensajes.some((mensaje) => mensaje.type === "mesa.estado" && mensaje.reqId === undefined)).toBe(true);
    await segunda.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const desde = primera.cliente.mensajes.length;
    const tercero = await registrar();
    const publicado = primera.cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.reqId === undefined && mensaje.asientos.filter(Boolean).length === 2, desde);
    await tercero.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await publicado;
    expect(await primera.cliente.enviar({ type: "mesa.salir" })).toMatchObject({ type: "ok" });
    expect(await segunda.enviar({ type: "lobby.listar" })).toMatchObject({ mesas: [{ ocupados: 2 }, { ocupados: 0 }, { ocupados: 0 }] });
    const trasSalir = primera.cliente.mensajes.length;
    await tercero.cliente.enviar({ type: "mesa.salir" });
    await primera.cliente.enviar({ type: "ping" });
    expect(primera.cliente.mensajes.slice(trasSalir).some((mensaje) => mensaje.type === "mesa.estado")).toBe(false);
    await primera.cliente.cerrar();
    expect(await segunda.enviar({ type: "lobby.listar" })).toMatchObject({ mesas: [{ ocupados: 1 }, { ocupados: 0 }, { ocupados: 0 }] });
    expect(await segunda.enviar({ type: "mesa.salir" })).toMatchObject({ type: "ok" });
  });

  test.each(["salir", "cerrar"] as const)("la espectadora ve el asiento libre y puede retomarlo después de %s la dueña", async (modo) => {
    const primera = await registrar();
    await primera.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const duena = await conectar();
    const aviso = primera.cliente.esperar((mensaje) => mensaje.type === "error" && mensaje.codigo === "NO_ESTAS_EN_MESA", primera.cliente.mensajes.length);
    await duena.enviar({ type: "login", usuario: primera.sesion.usuario.usuario, contrasena: "secreto09" });
    await aviso;
    const desde = primera.cliente.mensajes.length;
    const liberado = primera.cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.asientos.every((asiento) => asiento === null), desde);
    if (modo === "salir") await duena.enviar({ type: "mesa.salir" });
    else await duena.cerrar();
    await liberado;
    expect(await primera.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" })).toMatchObject({ asientos: [{ usuarioId: primera.sesion.usuario.id }, null, null, null, null] });
  });

  test.each(["salir", "cerrar"] as const)("la espectadora puede salir después de %s la dueña sin conservar la suscripción", async (modo) => {
    const primera = await registrar();
    await primera.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const duena = await conectar();
    await duena.enviar({ type: "login", usuario: primera.sesion.usuario.usuario, contrasena: "secreto09" });
    const liberado = primera.cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.asientos.every((asiento) => asiento === null), primera.cliente.mensajes.length);
    if (modo === "salir") await duena.enviar({ type: "mesa.salir" });
    else await duena.cerrar();
    await liberado;
    expect(await primera.cliente.enviar({ type: "mesa.salir" })).toMatchObject({ type: "ok" });
    const desde = primera.cliente.mensajes.length;
    const siguiente = await registrar();
    await siguiente.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await primera.cliente.enviar({ type: "ping" });
    expect(primera.cliente.mensajes.slice(desde).some((mensaje) => mensaje.type === "mesa.estado")).toBe(false);
    expect(await siguiente.cliente.enviar({ type: "lobby.listar" })).toMatchObject({ mesas: [{ ocupados: 1 }, { ocupados: 0 }, { ocupados: 0 }] });
  });

  test("cerrar una espectadora todavía suscrita no libera el asiento de la dueña", async () => {
    const primera = await registrar();
    await primera.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const duena = await conectar();
    await duena.enviar({ type: "reanudar", token: primera.sesion.token });
    await primera.cliente.cerrar();
    expect(await duena.enviar({ type: "lobby.listar" })).toMatchObject({ mesas: [{ ocupados: 1 }, { ocupados: 0 }, { ocupados: 0 }] });
    expect(await duena.enviar({ type: "mesa.salir" })).toMatchObject({ type: "ok" });
  });

  test("logout y cierre del dueño liberan el asiento y publican lobby", async () => {
    const observador = await registrar();
    const jugador = await registrar();
    for (const modo of ["logout", "cierre"] as const) {
      await jugador.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
      const cambio = observador.cliente.esperar((mensaje) => ocupados(mensaje, 0), observador.cliente.mensajes.length);
      if (modo === "logout") {
        expect(await jugador.cliente.enviar({ type: "logout" })).toMatchObject({ type: "ok" });
        await cambio;
        expect(await jugador.cliente.enviar({ type: "login", usuario: jugador.sesion.usuario.usuario, contrasena: "secreto09" })).toMatchObject({ type: "sesion", mesaId: null });
      } else {
        await jugador.cliente.cerrar();
        await cambio;
      }
    }
  });

  test("una sesión vencida libera el asiento antes de borrar la identidad", async () => {
    const observador = await registrar();
    const jugador = await registrar();
    await jugador.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await base.conexion`UPDATE sesiones SET expira_en = clock_timestamp() - INTERVAL '1 second' WHERE token = ${jugador.sesion.token}`;
    const cambio = observador.cliente.esperar((mensaje) => ocupados(mensaje, 0), observador.cliente.mensajes.length);
    expect(await jugador.cliente.enviar({ type: "mesa.salir" })).toMatchObject({ codigo: "SESION_INVALIDA" });
    await cambio;
    expect(await jugador.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-2" })).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  test("logout del espectador elimina su suscripción aunque el dueño ya haya salido", async () => {
    const primera = await registrar();
    await primera.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const dueña = await conectar();
    await dueña.enviar({ type: "login", usuario: primera.sesion.usuario.usuario, contrasena: "secreto09" });
    await dueña.enviar({ type: "mesa.salir" });
    await primera.cliente.enviar({ type: "logout" });
    // La consulta correlacionada siguiente delimita la recepción de publicaciones anteriores.
    await primera.cliente.enviar({ type: "ping" });
    const desde = primera.cliente.mensajes.length;
    const siguiente = await registrar();
    await siguiente.cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    await primera.cliente.enviar({ type: "ping" });
    expect(primera.cliente.mensajes.slice(desde).some((mensaje) => mensaje.type === "mesa.estado")).toBe(false);
  });
});
