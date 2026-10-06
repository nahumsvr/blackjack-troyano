/// <reference lib="dom" />
/** Ensayo del Hito 1: los módulos del cliente requieren tipos DOM, incluso al probarlos en Bun. */
import { describe, expect, test } from "bun:test";
import { Conexion } from "../../client/src/net/conexion";
import type { AlmacenToken } from "../../client/src/net/almacenToken";
import { ControladorJuego } from "../../client/src/state/controlador";
import { ESTADO_INICIAL, reducir, type EstadoJuego } from "../../client/src/state/reductor";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";

const destino = process.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("Cliente real del Hito 1", () => {
  test("una segunda pestaña deja al cliente real como espectador hasta que decide salir", async () => {
    const base = await crearBasePruebas(destino!);
    const servidor = iniciarAplicacion(base.conexion, 0);
    const modelo = { estado: ESTADO_INICIAL as EstadoJuego };
    let token: string | null = null;
    const almacen: AlmacenToken = { leer: () => token, guardar: (valor) => { token = valor; }, borrar: () => { token = null; } };
    const url = `ws://127.0.0.1:${servidor.port}/ws`;
    const controlador = new ControladorJuego(new Conexion({ url }), (evento) => { modelo.estado = reducir(modelo.estado, evento); }, almacen);
    let segunda: ClienteWsPrueba | undefined;
    async function esperar(condicion: () => boolean) {
      const hasta = performance.now() + 8000;
      while (!condicion()) {
        if (performance.now() > hasta) throw new Error("El cliente no alcanzó el estado esperado");
        await Bun.sleep(10);
      }
    }
    try {
      controlador.iniciar();
      await esperar(() => modelo.estado.conexion === "conectado");
      expect(await controlador.registrar("cliente_traspaso", "secreto09")).toBe(true);
      expect(await controlador.unirseAMesa("mesa-1")).toBe(true);
      const sesion = modelo.estado.sesion;
      segunda = await ClienteWsPrueba.conectar(url);
      await segunda.enviar({ type: "login", usuario: "cliente_traspaso", contrasena: "secreto09" });
      await esperar(() => modelo.estado.espectador && modelo.estado.avisos.length > 0);
      expect(modelo.estado.mesa?.id).toBe("mesa-1");
      expect(modelo.estado.mesaId).toBe("mesa-1");
      expect(modelo.estado.sesion).toEqual(sesion);
      expect(almacen.leer()).toBe(sesion?.token ?? null);
      await segunda.enviar({ type: "mesa.salir" });
      await esperar(() => modelo.estado.mesa?.asientos.every((asiento) => asiento === null) === true);
      expect(modelo.estado.espectador).toBe(true);
      expect(await controlador.salirDeMesa()).toBe(true);
      expect(await controlador.listarLobby()).toBe(true);
      expect(modelo.estado.mesaId).toBeNull();
      expect(modelo.estado.lobby[0]?.ocupados).toBe(0);
    } finally {
      controlador.detener();
      await segunda?.cerrar();
      await servidor.stop(true);
      await base.cerrar();
    }
  });

  test("tres clientes ven ocupación y reanudan las mismas sesiones al reiniciar servidor", async () => {
    const base = await crearBasePruebas(destino!);
    let servidor = iniciarAplicacion(base.conexion, 0);
    const puerto = servidor.port;
    const clientes = Array.from({ length: 3 }, () => {
      let token: string | null = null;
      const almacen: AlmacenToken = { leer: () => token, guardar: (nuevo) => { token = nuevo; }, borrar: () => { token = null; } };
      const modelo: { estado: EstadoJuego; sesionesRecibidas: number } = { estado: ESTADO_INICIAL, sesionesRecibidas: 0 };
      const conexion = new Conexion({ url: `ws://127.0.0.1:${puerto}/ws` });
      const controlador = new ControladorJuego(conexion, (evento) => {
        modelo.estado = reducir(modelo.estado, evento);
        if (evento.tipo === "servidor" && evento.mensaje.type === "sesion") modelo.sesionesRecibidas++;
      }, almacen);
      return { modelo, controlador };
    });
    async function esperar(condicion: () => boolean): Promise<void> {
      const fin = performance.now() + 8000;
      while (!condicion()) {
        if (performance.now() >= fin) throw new Error("El cliente no alcanzó el estado esperado");
        await Bun.sleep(10);
      }
    }
    try {
      for (const cliente of clientes) cliente.controlador.iniciar();
      await esperar(() => clientes.every(({ modelo }) => modelo.estado.conexion === "conectado"));
      const registros = await Promise.all(clientes.map(({ controlador }, indice) => controlador.registrar(`cliente09_${indice}`, "secreto09")));
      expect(registros).toEqual([true, true, true]);
      expect(await Promise.all(clientes.map(({ controlador }) => controlador.listarLobby()))).toEqual([true, true, true]);
      expect(clientes.every(({ modelo }) => modelo.estado.lobby.length === 3 && modelo.estado.conectados === 3)).toBe(true);
      expect(await clientes[0]!.controlador.unirseAMesa("mesa-1")).toBe(true);
      await esperar(() => clientes.every(({ modelo }) => modelo.estado.lobby[0]?.ocupados === 1));
      expect(clientes[0]!.modelo.estado.mesa?.asientos[0]?.usuarioId).toBe(clientes[0]!.modelo.estado.sesion?.usuario.id);
      const identidades = clientes.map(({ modelo }) => modelo.estado.sesion?.usuario.id);
      const tokens = clientes.map(({ modelo }) => modelo.estado.sesion?.token);
      servidor.stop(true);
      servidor = iniciarAplicacion(base.conexion, puerto);
      await esperar(() => clientes.every(({ modelo }) => modelo.sesionesRecibidas === 2 && modelo.estado.conexion === "conectado"));
      expect(clientes.map(({ modelo }) => modelo.estado.sesion?.usuario.id)).toEqual(identidades);
      expect(clientes.map(({ modelo }) => modelo.estado.sesion?.token)).toEqual(tokens);
      expect(clientes.every(({ modelo }) => modelo.estado.avisos.length === 0)).toBe(true);
      expect(await Promise.all(clientes.map(({ controlador }) => controlador.listarLobby()))).toEqual([true, true, true]);
      expect(clientes.every(({ modelo }) => modelo.estado.lobby[0]?.ocupados === 0 && modelo.estado.mesaId === null)).toBe(true);
    } finally {
      for (const cliente of clientes) cliente.controlador.detener();
      servidor.stop(true);
      await base.cerrar();
    }
  }, 15000);
});
