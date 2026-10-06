/** Verifica T-06 con sockets reales y el aislamiento del endpoint /ws. */
import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { iniciarServidor } from "../src/ws/servidor";
import { Enrutador } from "../src/ws/Enrutador";
import { ClienteWsPrueba } from "./soporteHito1";

const servidor = iniciarServidor(0);
const urlWs = `ws://127.0.0.1:${servidor.port}/ws`;
const sockets: WebSocket[] = [];
afterAll(() => {
  for (const socket of sockets) socket.close();
  servidor.stop(true);
});

/**
 * Observa una conexión y permite esperar un conteo sin perder mensajes tempranos.
 * @returns Socket y función que espera hasta 900 ms el número esperado.
 */
function conectar() {
  const socket = new WebSocket(urlWs);
  sockets.push(socket);
  const conteos: number[] = [];
  const observadores = new Set<() => void>();
  socket.addEventListener("message", (evento) => {
    const mensaje: unknown = JSON.parse(String(evento.data));
    if (typeof mensaje === "object" && mensaje !== null &&
        "type" in mensaje && mensaje.type === "bienvenida" &&
        "conectados" in mensaje && typeof mensaje.conectados === "number") {
      conteos.push(mensaje.conectados);
      for (const observar of observadores) observar();
    }
  });
  return {
    socket,
    esperar(cantidad: number): Promise<void> {
      if (conteos.at(-1) === cantidad) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const reloj = setTimeout(() => {
          observadores.delete(observar);
          reject(new Error(`No se recibio conectados=${cantidad} en menos de 1 s`));
        }, 900);
        function observar() {
          if (conteos.at(-1) !== cantidad) return;
          clearTimeout(reloj);
          observadores.delete(observar);
          resolve();
        }
        observadores.add(observar);
      });
    },
  };
}

describe("T-06: lobby WebSocket", () => {
  test("tres conexiones ven 3 y las restantes ven 2 al cerrar una", async () => {
    const primera = conectar();
    await primera.esperar(1);
    const segunda = conectar();
    await Promise.all([primera.esperar(2), segunda.esperar(2)]);
    const tercera = conectar();
    await Promise.all([primera.esperar(3), segunda.esperar(3), tercera.esperar(3)]);
    tercera.socket.close();
    await Promise.all([primera.esperar(2), segunda.esperar(2)]);
    segunda.socket.close();
    await primera.esperar(1);
    primera.socket.close();
  });
  test("rechaza un GET sin upgrade en /ws", async () => {
    const respuesta = await fetch(`http://127.0.0.1:${servidor.port}/ws`);
    expect(respuesta.status).toBe(426);
  });
  test("otra ruta no habilita el transporte", async () => {
    const respuesta = await fetch(`http://127.0.0.1:${servidor.port}/otra`);
    expect(respuesta.status).toBe(404);
  });

  test("un fallo de limpieza no omite auth ni deja inflado el contador", async () => {
    let limpiezas = 0;
    const errorAuth = new Error("fallo auth");
    const errorMesa = new Error("fallo mesa");
    const registro = spyOn(console, "error").mockImplementation(() => {});
    const enrutador = new Enrutador({}, undefined, undefined, () => { limpiezas++; throw errorAuth; });
    const aislado = iniciarServidor(0, enrutador, () => { throw errorMesa; });
    const clientes: ClienteWsPrueba[] = [];
    try {
      const url = `ws://127.0.0.1:${aislado.port}/ws`;
      const primera = await ClienteWsPrueba.conectar(url);
      const segunda = await ClienteWsPrueba.conectar(url);
      clientes.push(primera, segunda);
      await primera.esperar((mensaje) => mensaje.type === "bienvenida" && mensaje.conectados === 2);
      const desde = primera.mensajes.length;
      await segunda.cerrar();
      await primera.esperar((mensaje) => mensaje.type === "bienvenida" && mensaje.conectados === 1, desde);
      expect(limpiezas).toBe(1);
      // console.error es global: cierres pendientes de otras pruebas no pertenecen a este servidor.
      expect(registro.mock.calls.filter(([titulo, error]) => titulo === "Error al limpiar la mesa" && error === errorMesa)).toHaveLength(1);
      expect(registro.mock.calls.filter(([titulo, error]) => titulo === "Error al limpiar la sesion" && error === errorAuth)).toHaveLength(1);
      expect(await primera.enviar({ type: "ping" })).toMatchObject({ type: "pong" });
    } finally {
      await Promise.all(clientes.map((cliente) => cliente.cerrar()));
      await aislado.stop(true);
      registro.mockRestore();
    }
  });
});
