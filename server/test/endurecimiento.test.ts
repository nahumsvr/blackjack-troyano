/** T-37: admisión por conexión, errores aislados y ataque real mientras tres usuarios juegan. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { MENSAJES_POR_SEGUNDO, VENTANA_MENSAJES_MS, MENSAJE_MAX_BYTES } from "../src/config";
import { Enrutador, type ContextoErrorEnrutador, type DatosConexion, type ManejadoresEnrutador } from "../src/ws/Enrutador";
import { iniciarServidor } from "../src/ws/servidor";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { Sesiones, type Sesion } from "../src/auth/Sesiones";
import { Mesa } from "../src/game/Mesa";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";
import { crearZapatoFijo, TiempoManual } from "./soporteMesa";

let servidor: Server<DatosConexion> | undefined;
let instante = 0;
const clientes: ClienteWsPrueba[] = [];
beforeEach(() => { instante = 0; });
afterEach(async () => {
  await Promise.all(clientes.splice(0).map((cliente) => cliente.cerrar()));
  await servidor?.stop(true);
});
async function conectar() {
  const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor!.port}/ws`);
  clientes.push(cliente);
  return cliente;
}
function iniciar(manejadores: ManejadoresEnrutador = {}, registrarError?: (error: unknown, contexto: ContextoErrorEnrutador) => void) {
  servidor = iniciarServidor(0, new Enrutador(manejadores, registrarError, undefined, undefined, () => instante));
}

test("admite 20 mensajes; el 21 se rechaza y la conexión se recupera exactamente al segundo", async () => {
  iniciar(); const cliente = await conectar();
  const respuestas = await Promise.all(Array.from({ length: MENSAJES_POR_SEGUNDO }, () => cliente.enviar({ type: "ping" })));
  expect(respuestas.every((mensaje) => mensaje.type === "pong")).toBe(true);
  expect(await cliente.enviar({ type: "ping", reqId: "exceso" })).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES", reqId: "exceso" });
  instante = VENTANA_MENSAJES_MS - 1;
  expect(await cliente.enviar({ type: "ping" })).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES" });
  instante++;
  expect(await cliente.enviar({ type: "ping" })).toMatchObject({ type: "pong" });
  expect(cliente.socket.readyState).toBe(WebSocket.OPEN);
});

test("la ventana móvil no permite duplicar la ráfaga al cruzar un segundo", async () => {
  iniciar(); const cliente = await conectar();
  const mitad = MENSAJES_POR_SEGUNDO / 2;
  await Promise.all(Array.from({ length: mitad }, () => cliente.enviar({ type: "ping" })));
  instante = VENTANA_MENSAJES_MS - 1;
  await Promise.all(Array.from({ length: mitad }, () => cliente.enviar({ type: "ping" })));
  instante++;
  const respuestas = await Promise.all(Array.from({ length: mitad + 1 }, () => cliente.enviar({ type: "ping" })));
  expect(respuestas.filter((mensaje) => mensaje.type === "pong")).toHaveLength(mitad);
  expect(respuestas.at(-1)).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES" });
});

test("frames inválidos cuentan y una conexión saturada no consume la cuota de otra", async () => {
  iniciar(); const atacante = await conectar(); const sano = await conectar();
  const desde = atacante.mensajes.length;
  const terminado = atacante.esperar((mensaje) => mensaje.reqId === `invalido-${MENSAJES_POR_SEGUNDO - 1}`, desde);
  for (let indice = 0; indice < MENSAJES_POR_SEGUNDO; indice++) {
    atacante.socket.send(JSON.stringify({ type: "inventado", reqId: `invalido-${indice}` }));
  }
  await terminado;
  expect(atacante.mensajes.slice(desde).filter((mensaje) => mensaje.type === "error" && mensaje.codigo === "MENSAJE_INVALIDO")).toHaveLength(MENSAJES_POR_SEGUNDO);
  expect(await atacante.enviar({ type: "ping" })).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES" });
  expect(await sano.enviar({ type: "ping" })).toMatchObject({ type: "pong" });
});

test("un frame saturado solo refleja reqId válido y acotado, aunque sea binario o excesivo", async () => {
  iniciar(); const cliente = await conectar();
  await Promise.all(Array.from({ length: MENSAJES_POR_SEGUNDO }, () => cliente.enviar({ type: "ping" })));
  for (const datos of ["no-json", '{"type":"ping","reqId":42}', JSON.stringify({ type: "ping", reqId: "x".repeat(37) }),
    "x".repeat(MENSAJE_MAX_BYTES + 1), new TextEncoder().encode('{"type":"ping","reqId":"binario"}')]) {
    const desde = cliente.mensajes.length;
    cliente.socket.send(datos);
    const respuesta = await cliente.esperar((mensaje) => mensaje.type === "error", desde);
    expect(respuesta).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES" });
    expect(respuesta.reqId).toBeUndefined();
  }
  expect(await cliente.enviar({ type: "ping", reqId: "" })).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES", reqId: "" });
});

test("rechaza antes de una operación lenta y acota la cola aunque transcurra otra ventana", async () => {
  const iniciada = Promise.withResolvers<void>(); const liberar = Promise.withResolvers<void>();
  let llamadas = 0;
  iniciar({ registro: async () => { llamadas++; iniciada.resolve(); await liberar.promise; return { type: "ok" }; } });
  const lento = await conectar(); const sano = await conectar();
  const operaciones = Array.from({ length: MENSAJES_POR_SEGUNDO }, () => lento.enviar({ type: "registro", usuario: "prueba", contrasena: "secreto37" }));
  try {
    await iniciada.promise;
    expect(await lento.enviar({ type: "ping" })).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES" });
    instante = VENTANA_MENSAJES_MS;
    expect(await lento.enviar({ type: "registro", usuario: "prueba", contrasena: "secreto37" })).toMatchObject({ codigo: "DEMASIADAS_SOLICITUDES" });
    expect(llamadas).toBe(1);
    expect(await sano.enviar({ type: "ping" })).toMatchObject({ type: "pong" });
  } finally { liberar.resolve(); await Promise.all(operaciones); }
  expect(llamadas).toBe(MENSAJES_POR_SEGUNDO);
  expect(await lento.enviar({ type: "ping" })).toMatchObject({ type: "pong" });
});

test("un fallo inesperado devuelve ERROR_INTERNO; el log identifica la operación sin incluir el frame", async () => {
  const causa = new Error("detalle privado del servicio");
  const registros: { error: unknown; contexto: ContextoErrorEnrutador }[] = [];
  iniciar({ registro: async (socket) => {
    socket.data.usuarioId = 7; socket.data.mesaId = "mesa-1"; throw causa;
  } }, (error, contexto) => registros.push({ error, contexto }));
  const cliente = await conectar(); const par = await conectar();
  const respuesta = await cliente.enviar({ type: "registro", usuario: "prueba", contrasena: "secreto37", reqId: "fallo" });
  expect(respuesta).toMatchObject({ type: "error", codigo: "ERROR_INTERNO", reqId: "fallo" });
  expect(JSON.stringify(respuesta)).not.toContain(causa.message);
  expect(registros).toHaveLength(1);
  expect(registros[0]!.error).toBe(causa);
  expect(registros[0]!.contexto).toMatchObject({ usuarioId: 7, mesaId: "mesa-1", tipo: "registro", reqId: "fallo" });
  expect(registros[0]!.contexto.conexionId).toBeString();
  expect(JSON.stringify(registros[0]!.contexto)).not.toContain("secreto37");
  expect((await Promise.all([cliente, par].map((actual) => actual.enviar({ type: "ping" })))).every((mensaje) => mensaje.type === "pong")).toBe(true);
});

test("un logger que falla no impide ERROR_INTERNO ni la siguiente respuesta", async () => {
  iniciar({ registro: () => { throw new Error("servicio roto"); } }, () => { throw new Error("logger roto"); });
  const cliente = await conectar();
  expect(await cliente.enviar({ type: "registro", usuario: "prueba", contrasena: "secreto37" })).toMatchObject({ codigo: "ERROR_INTERNO" });
  expect(await cliente.enviar({ type: "ping" })).toMatchObject({ type: "pong" });
});

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("T-37 con juego y PostgreSQL reales", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let sesiones: Sesion[];
  let tiempo: TiempoManual;
  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    const auth = new Sesiones(base.conexion);
    sesiones = await Promise.all([1, 2, 3].map((id) => auth.registrar(`endurecimiento${id}`, "secreto37")));
  });
  beforeEach(() => {
    servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) => {
      const manual = new TiempoManual(); if (id === "mesa-1") tiempo = manual;
      return new Mesa(id, nombre, publicar, crearZapatoFijo(["10", "10", "10", "10", "7", "7", "7", "7"]), manual.reloj, servicios);
    });
  });
  afterAll(async () => { await base.cerrar(); });
  async function autenticar(indice: number) {
    const cliente = await conectar();
    expect(await cliente.enviar({ type: "reanudar", token: sesiones[indice]!.token })).toMatchObject({ type: "sesion" });
    return cliente;
  }
  async function sentarTres() {
    const jugadores = await Promise.all([0, 1, 2].map(autenticar));
    for (const cliente of jugadores) await cliente.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    return jugadores;
  }

  test("1000 mensajes basura en <1 s reciben errores y las otras tres conexiones terminan su ronda", async () => {
    const jugadores = await sentarTres();
    for (const cliente of jugadores) await cliente.enviar({ type: "apostar", cantidad: 10 });
    tiempo.avanzar(0);
    await Promise.all(jugadores.map((cliente) => cliente.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.fase === "TURNOS")));
    const atacante = await conectar(); const desde = atacante.mensajes.length;
    const completados = Promise.all([19, 999].map((indice) => atacante.esperar((mensaje) => mensaje.reqId === `basura-${indice}`, desde)));
    const inicio = performance.now();
    for (let indice = 0; indice < 1000; indice++) atacante.socket.send(JSON.stringify({ type: "basura", reqId: `basura-${indice}` }));
    expect(performance.now() - inicio).toBeLessThan(1000);
    const jugar = (async () => {
      for (const cliente of jugadores) expect(await cliente.enviar({ type: "plantarse" })).toMatchObject({ type: "mesa.estado" });
      return jugadores[0]!.esperar((mensaje) => mensaje.type === "ronda.resultado");
    })();
    await completados;
    const resultado = await jugar;
    expect(performance.now() - inicio).toBeLessThan(1000);
    const errores = atacante.mensajes.slice(desde).filter((mensaje) => mensaje.type === "error");
    expect(errores).toHaveLength(1000);
    expect(errores.filter((mensaje) => mensaje.codigo === "MENSAJE_INVALIDO")).toHaveLength(MENSAJES_POR_SEGUNDO);
    expect(errores.filter((mensaje) => mensaje.codigo === "DEMASIADAS_SOLICITUDES")).toHaveLength(1000 - MENSAJES_POR_SEGUNDO);
    expect([...jugadores, atacante].every((cliente) => cliente.socket.readyState === WebSocket.OPEN)).toBe(true);
    if (resultado.type !== "ronda.resultado") throw new Error("Falta resultado");
    const filas = await base.conexion`SELECT usuario_id FROM rondas_jugadores WHERE ronda_id = ${resultado.rondaId}`;
    expect(filas).toHaveLength(3);
  });

  test("espectador no apuesta, pide ni planta; no cambia cartas, turno, dinero o movimientos", async () => {
    const jugadores = await sentarTres(); const duena = await autenticar(0);
    const usuarioId = sesiones[0]!.usuario.id;
    const [antes] = await base.conexion`SELECT fichas FROM usuarios WHERE id = ${usuarioId}`;
    const movimientosAntes = await base.conexion`SELECT id FROM movimientos WHERE usuario_id = ${usuarioId} AND tipo = 'apuesta'`;
    const referencia = await duena.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    for (const entrada of [{ type: "apostar", cantidad: 10 }, { type: "pedir" }, { type: "plantarse" }] as const) {
      expect(await jugadores[0]!.enviar(entrada)).toMatchObject({ codigo: "NO_ESTAS_EN_MESA" });
    }
    expect(await duena.enviar({ type: "mesa.unirse", mesaId: "mesa-1" })).toMatchObject({ type: "mesa.estado" });
    const posterior = await duena.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    expect({ ...posterior, reqId: undefined }).toEqual({ ...referencia, reqId: undefined });
    const [despues] = await base.conexion`SELECT fichas FROM usuarios WHERE id = ${usuarioId}`;
    expect(despues).toEqual(antes);
    await duena.enviar({ type: "apostar", cantidad: 10 });
    for (const cliente of jugadores.slice(1)) await cliente.enviar({ type: "apostar", cantidad: 10 });
    tiempo.avanzar(0);
    const estado = await duena.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.fase === "TURNOS");
    expect(await jugadores[0]!.enviar({ type: "plantarse" })).toMatchObject({ codigo: "NO_ESTAS_EN_MESA" });
    const sinCambio = await duena.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    expect({ ...sinCambio, reqId: undefined }).toEqual({ ...estado, reqId: undefined });
    const movimientos = await base.conexion`SELECT id FROM movimientos WHERE usuario_id = ${usuarioId} AND tipo = 'apuesta'`;
    expect(movimientos).toHaveLength(movimientosAntes.length + 1);
  });
});
