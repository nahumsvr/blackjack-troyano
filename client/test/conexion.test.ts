/** Pruebas de la conexión WebSocket: reconexión, validación en ambos sentidos y correlación por reqId. */
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Conexion, retrasoReconexion } from "../src/net/conexion";
import { ErrorPeticion, type CodigoErrorPeticion } from "../src/net/erroresLocales";
import type { EventoTransporte } from "../src/net/transporte";
import { RelojManual, SESION, SocketFalso, vaciarPromesas } from "./apoyo";

let reloj: RelojManual;
let sockets: SocketFalso[];
let eventos: EventoTransporte[];
let conexion: Conexion;
let contador: number;

beforeEach(() => {
  reloj = new RelojManual();
  sockets = [];
  eventos = [];
  contador = 0;
  conexion = new Conexion({
    url: "ws://prueba/ws",
    crearSocket: () => {
      const socket = new SocketFalso();
      sockets.push(socket);
      return socket;
    },
    programar: reloj.programar,
    cancelar: reloj.cancelar,
    generarId: () => `req-${++contador}`,
    timeoutMs: 8000,
  });
  conexion.suscribir((evento) => eventos.push(evento));
  // Los avisos de mensajes inválidos son esperados en estas pruebas.
  spyOn(console, "warn").mockImplementation(() => {});
});

/**
 * Conecta y abre el primer socket.
 * @returns El socket abierto.
 */
function conectarYAbrir(): SocketFalso {
  conexion.conectar();
  const socket = sockets.at(-1);
  if (socket === undefined) throw new Error("No se creó el socket");
  socket.abrir();
  return socket;
}

/**
 * Espera que una promesa se rechace con un ErrorPeticion de cierto código.
 * @param promesa - Petición a comprobar.
 * @param codigo - Código esperado.
 */
async function esperarRechazo(promesa: Promise<unknown>, codigo: CodigoErrorPeticion): Promise<void> {
  const error = await promesa.then(
    () => null,
    (motivo: unknown) => motivo,
  );
  expect(error).toBeInstanceOf(ErrorPeticion);
  expect((error as ErrorPeticion).codigo).toBe(codigo);
}

describe("retrasoReconexion", () => {
  test("crece 1, 2, 4, 8 y se queda en 10 s", () => {
    expect([0, 1, 2, 3, 4, 5, 50].map((intento) => retrasoReconexion(intento))).toEqual([
      1000, 2000, 4000, 8000, 10000, 10000, 10000,
    ]);
  });
  test("un intento negativo o fraccionario no rompe la tabla", () => {
    expect(retrasoReconexion(-3)).toBe(1000);
    expect(retrasoReconexion(1.7)).toBe(2000);
  });
});

describe("Conexion", () => {
  test("notifica conectando → conectado", () => {
    conectarYAbrir();
    expect(eventos).toEqual([
      { tipo: "conexion", estado: "conectando" },
      { tipo: "conexion", estado: "conectado" },
    ]);
  });

  test("conectar dos veces no abre un segundo socket", () => {
    conexion.conectar();
    conexion.conectar();
    expect(sockets).toHaveLength(1);
  });

  test("enviar sin conexión rechaza con SIN_CONEXION y no encola", async () => {
    conexion.conectar(); // socket creado pero aún no abierto
    await esperarRechazo(conexion.enviar({ type: "pedir" }), "SIN_CONEXION");
    expect(sockets[0]?.enviados).toEqual([]);
  });

  test("una intención fuera de contrato no se envía", async () => {
    const socket = conectarYAbrir();
    await esperarRechazo(conexion.enviar({ type: "apostar", cantidad: 15 }), "MENSAJE_CLIENTE_INVALIDO");
    await esperarRechazo(conexion.enviar({ type: "apostar", cantidad: 10.5 }), "MENSAJE_CLIENTE_INVALIDO");
    await esperarRechazo(conexion.enviar({ type: "fichas.comprar", cantidad: 100, clave: "no-uuid" }), "MENSAJE_CLIENTE_INVALIDO");
    expect(socket.enviados).toEqual([]);
  });

  test("agrega reqId y resuelve con la respuesta que lo repite", async () => {
    const socket = conectarYAbrir();
    const promesa = conexion.enviar({ type: "login", usuario: "nahum", contrasena: "secreta1" });
    expect(socket.ultimo()).toEqual({ type: "login", usuario: "nahum", contrasena: "secreta1", reqId: "req-1" });
    socket.recibir({ ...SESION, reqId: "req-1" });
    expect(await promesa).toEqual({ ...SESION, reqId: "req-1" });
    expect(reloj.tareas.size).toBe(0); // el timeout se canceló
  });

  test("un error con reqId rechaza la petición con el código y mensaje del servidor", async () => {
    const socket = conectarYAbrir();
    const promesa = conexion.enviar({ type: "pedir" });
    socket.recibir({ type: "error", codigo: "NO_ES_TU_TURNO", mensaje: "No es tu turno", reqId: "req-1" });
    const error = await promesa.catch((motivo: unknown) => motivo);
    expect(error).toBeInstanceOf(ErrorPeticion);
    expect((error as ErrorPeticion).codigo).toBe("NO_ES_TU_TURNO");
    expect((error as ErrorPeticion).message).toBe("No es tu turno");
  });

  test("sin respuesta a tiempo rechaza con SIN_RESPUESTA; una respuesta tardía se ignora", async () => {
    const socket = conectarYAbrir();
    const promesa = conexion.enviar({ type: "pedir" });
    expect(reloj.esperas()).toEqual([8000]);
    reloj.ejecutarTodo();
    await esperarRechazo(promesa, "SIN_RESPUESTA");
    expect(() => socket.recibir({ type: "ok", reqId: "req-1" })).not.toThrow();
  });

  test("al caerse rechaza las pendientes y reintenta con espera creciente", async () => {
    const socket = conectarYAbrir();
    const promesa = conexion.enviar({ type: "pedir" });
    socket.caer();
    await esperarRechazo(promesa, "SIN_CONEXION");
    expect(conexion.estadoActual).toBe("reconectando");
    expect(reloj.esperas()).toEqual([1000]);

    reloj.ejecutarTodo(); // primer reintento: el socket nuevo también falla
    expect(sockets).toHaveLength(2);
    sockets[1]?.caer();
    expect(reloj.esperas()).toEqual([2000]);

    reloj.ejecutarTodo(); // segundo reintento: abre
    sockets[2]?.abrir();
    expect(conexion.estadoActual).toBe("conectado");
    sockets[2]?.caer();
    expect(reloj.esperas()).toEqual([1000]); // al conectar, la espera vuelve a empezar
  });

  test("cerrar no reintenta y deja de escuchar el socket viejo", () => {
    const socket = conectarYAbrir();
    conexion.cerrar();
    expect(conexion.estadoActual).toBe("cerrado");
    socket.caer();
    expect(reloj.tareas.size).toBe(0);
    conexion.conectar(); // se puede volver a abrir
    expect(sockets).toHaveLength(2);
  });

  test("ignora mensajes que no son JSON o que no cumplen el contrato, sin lanzar", () => {
    const socket = conectarYAbrir();
    const antes = eventos.length;
    socket.recibir("no-json{");
    socket.recibir({ type: "inventado" });
    socket.recibir({ type: "billetera", dinero: -5 });
    expect(eventos.length).toBe(antes);
  });

  test("notifica cada mensaje válido aunque un oyente lance", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    const recibidos: string[] = [];
    conexion.suscribir(() => {
      throw new Error("oyente roto");
    });
    conexion.suscribir((evento) => {
      if (evento.tipo === "mensaje") recibidos.push(evento.mensaje.type);
    });
    const socket = conectarYAbrir();
    socket.recibir({ type: "bienvenida", conectados: 3 });
    await vaciarPromesas();
    expect(recibidos).toEqual(["bienvenida"]);
  });
});
