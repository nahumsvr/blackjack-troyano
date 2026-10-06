/** Ensayo del Hito 1 usando la red, controlador y reductor reales de Nahum. */
import { describe, expect, test } from "bun:test";
import { Conexion } from "../../client/src/net/conexion";
import type { AlmacenToken } from "../../client/src/net/almacenToken";
import { ControladorJuego } from "../../client/src/state/controlador";
import { ESTADO_INICIAL, reducir, type EstadoJuego } from "../../client/src/state/reductor";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { crearBasePruebas } from "./soporteHito1";

const destino = process.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("Cliente real del Hito 1", () => {
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
