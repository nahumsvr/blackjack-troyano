/** Prueba el enrutador con frames reales, tres conexiones y handlers inyectados. */
import { afterEach, describe, expect, test } from "bun:test";
import { ErrorJuego, MensajeServidorSchema, type MensajeServidor } from "@blackjack/shared";
import type { Server } from "bun";
import { MENSAJE_MAX_BYTES } from "../src/config";
import { Enrutador, type DatosConexion } from "../src/ws/Enrutador";
import { iniciarServidor } from "../src/ws/servidor";

let servidor: Server<DatosConexion>;
const sockets: WebSocket[] = [];

test("un logger que lanza no impide responder ni continuar con ping", async () => {
  servidor = iniciarServidor(0, new Enrutador({ login: () => { throw new Error("Fallo de handler"); } },
    () => { throw new Error("Fallo de logger"); }));
  const socket = await conectar();
  expect(await enviar(socket, JSON.stringify({ type: "login", usuario: "prueba", contrasena: "secreto48" })))
    .toMatchObject({ type: "error", codigo: "ERROR_INTERNO" });
  expect(await enviar(socket, JSON.stringify({ type: "ping" }))).toMatchObject({ type: "pong" });
});
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
  servidor?.stop(true);
});

async function conectar(): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${servidor.port}/ws`);
  sockets.push(socket);
  await new Promise<void>((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error("No abrió el socket")), 900);
    socket.addEventListener("open", () => { clearTimeout(reloj); resolver(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(reloj); rechazar(new Error("Falló el socket")); }, { once: true });
  });
  return socket;
}

function enviar(socket: WebSocket, datos: string | Uint8Array): Promise<MensajeServidor> {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => {
      socket.removeEventListener("message", recibir);
      rechazar(new Error("No respondió en menos de 1 s"));
    }, 900);
    function recibir(evento: MessageEvent) {
      try {
        const mensaje = MensajeServidorSchema.parse(JSON.parse(String(evento.data)));
        if (mensaje.type === "bienvenida") return;
        clearTimeout(reloj);
        socket.removeEventListener("message", recibir);
        resolver(mensaje);
      } catch (error) {
        clearTimeout(reloj);
        socket.removeEventListener("message", recibir);
        rechazar(error);
      }
    }
    socket.addEventListener("message", recibir);
    socket.send(datos);
  });
}

describe("T-07: validación y despacho WebSocket", () => {
  test("los cuatro ataques del criterio no interrumpen ninguna de las tres conexiones", async () => {
    servidor = iniciarServidor(0);
    const [primera, segunda, tercera] = await Promise.all([conectar(), conectar(), conectar()]);
    for (const [datos, codigo] of [
      ["no-json", "MENSAJE_INVALIDO"],
      ['{"type":"x","reqId":"desconocido"}', "MENSAJE_INVALIDO"],
      ['{"type":"apostar","cantidad":-5,"reqId":"cantidad"}', "CANTIDAD_INVALIDA"],
      ["x".repeat(1024 * 1024), "MENSAJE_INVALIDO"],
    ]) {
      expect(await enviar(primera!, datos!)).toMatchObject({ type: "error", codigo });
      const respuestas = await Promise.all([primera!, segunda!, tercera!].map((socket, indice) =>
        enviar(socket, JSON.stringify({ type: "ping", reqId: `ping-${indice}` }))));
      respuestas.forEach((respuesta, indice) => expect(respuesta).toMatchObject({ type: "pong", reqId: `ping-${indice}` }));
      expect([primera!, segunda!, tercera!].every((socket) => socket.readyState === WebSocket.OPEN)).toBe(true);
    }
  });

  test("el límite se mide en bytes UTF-8 y acepta exactamente 16 KB", async () => {
    servidor = iniciarServidor(0);
    const socket = await conectar();
    const ping = '{"type":"ping","reqId":"frontera"}';
    expect(await enviar(socket, ping.padEnd(MENSAJE_MAX_BYTES, " "))).toMatchObject({ type: "pong", reqId: "frontera" });
    expect(await enviar(socket, ping.padEnd(MENSAJE_MAX_BYTES + 1, " "))).toMatchObject({ codigo: "MENSAJE_INVALIDO" });
    const unicode = JSON.stringify({ type: "x", texto: "🃏".repeat(5000), reqId: "unicode" });
    expect(unicode.length).toBeLessThan(MENSAJE_MAX_BYTES);
    expect(Buffer.byteLength(unicode)).toBeGreaterThan(MENSAJE_MAX_BYTES);
    expect(await enviar(socket, unicode)).toEqual({ type: "error", codigo: "MENSAJE_INVALIDO", mensaje: "El mensaje no es válido" });
  });

  test("rechaza binarios, campos extra y reqId inválido; refleja solo reqId válido", async () => {
    servidor = iniciarServidor(0);
    const socket = await conectar();
    expect(await enviar(socket, new TextEncoder().encode('{"type":"ping"}'))).toMatchObject({ codigo: "MENSAJE_INVALIDO" });
    expect(await enviar(socket, '{"type":"ping","extra":true,"reqId":"estructura"}')).toMatchObject({ codigo: "MENSAJE_INVALIDO", reqId: "estructura" });
    expect(await enviar(socket, '{"type":"x","reqId":42}')).not.toHaveProperty("reqId");
    expect(await enviar(socket, '{"type":"apostar","cantidad":-5,"extra":true,"reqId":"estructura"}')).toMatchObject({ codigo: "MENSAJE_INVALIDO", reqId: "estructura" });
    expect(await enviar(socket, '{"type":"ping","reqId":""}')).toMatchObject({ type: "pong", reqId: "" });
  });

  test("exige sesión, despacha el mensaje parseado y evita una segunda autenticación", async () => {
    let limiteRecibido: number | undefined;
    servidor = iniciarServidor(0, new Enrutador({
      registro: (socket) => { socket.data.usuarioId = 1; return { type: "ok", reqId: "otro" }; },
      "movimientos.listar": (_socket, mensaje) => { limiteRecibido = mensaje.limite; return { type: "movimientos", items: [], hayMas: false }; },
    }));
    const socket = await conectar();
    expect(await enviar(socket, '{"type":"movimientos.listar","reqId":"sin-sesion"}')).toMatchObject({ codigo: "NO_AUTENTICADO", reqId: "sin-sesion" });
    expect(await enviar(socket, '{"type":"registro","usuario":"prueba","contrasena":"abcdef","reqId":"registro"}')).toEqual({ type: "ok", reqId: "registro" });
    expect(await enviar(socket, '{"type":"movimientos.listar","reqId":"historial"}')).toMatchObject({ type: "movimientos", reqId: "historial" });
    expect(limiteRecibido).toBe(50);
    expect(await enviar(socket, '{"type":"login","usuario":"prueba","contrasena":"abcdef","reqId":"otra"}')).toMatchObject({ codigo: "YA_AUTENTICADO", reqId: "otra" });
  });

  test("convierte errores de dominio y excepciones async sin revelar detalles ni perder reqId", async () => {
    const errores: unknown[] = [];
    servidor = iniciarServidor(0, new Enrutador({
      login: async () => { throw new ErrorJuego("CREDENCIALES_INVALIDAS"); },
      registro: async () => { throw new Error("detalle privado del servicio"); },
    }, (error) => errores.push(error)));
    const socket = await conectar();
    expect(await enviar(socket, '{"type":"login","usuario":"prueba","contrasena":"abcdef","reqId":"login"}')).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS", reqId: "login" });
    expect(errores).toHaveLength(0);
    const respuesta = await enviar(socket, '{"type":"registro","usuario":"prueba","contrasena":"abcdef","reqId":"registro"}');
    expect(respuesta).toMatchObject({ codigo: "ERROR_INTERNO", reqId: "registro" });
    expect(JSON.stringify(respuesta)).not.toContain("detalle privado");
    expect(errores).toHaveLength(1);
    expect(await enviar(socket, '{"type":"ping"}')).toMatchObject({ type: "pong" });
  });

  test("una intención de acceso sin handler responde error en vez de quedarse esperando", async () => {
    servidor = iniciarServidor(0);
    const socket = await conectar();
    expect(await enviar(socket, '{"type":"reanudar","token":"' + "a".repeat(64) + '","reqId":"pendiente"}'))
      .toMatchObject({ codigo: "ERROR_INTERNO", reqId: "pendiente" });
  });
});
