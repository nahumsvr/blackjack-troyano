/** Comprueba que juego y compras comparten el orden de saldos con SQL y WS reales. */
import { describe, expect, spyOn, test } from "bun:test";
import { BilleteraSQL } from "../src/store/BilleteraSQL";
import { Sesiones } from "../src/auth/Sesiones";
import { Mesa } from "../src/game/Mesa";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { ClienteWsPrueba, crearBasePruebas } from "./soporteHito1";
import { crearZapatoFijo } from "./soporteMesa";

const destino = process.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("Juego y economía integrados", () => {
  test.each(["debitarApuesta", "acreditarPago"] as const)("%s no publica saldo anterior después de una compra", async (operacion) => {
    const base = await crearBasePruebas(destino!);
    const confirmado = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const autorizada = Promise.withResolvers<void>();
    const original = BilleteraSQL.prototype[operacion];
    const validar = Sesiones.prototype.validar;
    const comprar = BilleteraSQL.prototype.comprarFichas;
    let objetivo = -1;
    let esperarCompra = false;
    let entroCompra = false;
    const autorizacion = spyOn(Sesiones.prototype, "validar").mockImplementation(async function (this: Sesiones, token: string) {
      const sesion = await validar.call(this, token);
      if (esperarCompra && sesion.usuario.id === objetivo) autorizada.resolve();
      return sesion;
    });
    const compraPausada = spyOn(BilleteraSQL.prototype, "comprarFichas").mockImplementation(async function (
      this: BilleteraSQL, usuarioId: number, cantidad: number, clave: string,
    ) {
      if (usuarioId === objetivo && esperarCompra) entroCompra = true;
      return comprar.call(this, usuarioId, cantidad, clave);
    });
    const pausa = spyOn(BilleteraSQL.prototype, operacion).mockImplementation(async function (
      this: BilleteraSQL, usuarioId: number, cantidad: number, rondaId: string,
    ) {
      const estado = await original.call(this, usuarioId, cantidad, rondaId);
      if (usuarioId === objetivo) { confirmado.resolve(); await liberar.promise; }
      return estado;
    });
    const servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) =>
      new Mesa(id, nombre, publicar, crearZapatoFijo(["10", "10", "8", "7"]), undefined, servicios));
    const clientes: ClienteWsPrueba[] = [];
    try {
      const url = `ws://127.0.0.1:${servidor.port}/ws`;
      const jugador = await ClienteWsPrueba.conectar(url);
      const otra = await ClienteWsPrueba.conectar(url);
      clientes.push(jugador, otra);
      const sesion = await jugador.enviar({ type: "registro", usuario: `orden_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`, contrasena: "ordenSaldos" });
      if (sesion.type !== "sesion") throw new Error("No se registró el jugador");
      await otra.enviar({ type: "reanudar", token: sesion.token });
      await jugador.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
      let apuesta: Promise<unknown> | undefined;
      if (operacion === "debitarApuesta") {
        objetivo = sesion.usuario.id;
        apuesta = jugador.enviar({ type: "apostar", cantidad: 10 });
      } else {
        await jugador.enviar({ type: "apostar", cantidad: 10 });
        await jugador.esperar((mensaje) => mensaje.type === "mesa.estado" && mensaje.fase === "TURNOS");
        objetivo = sesion.usuario.id;
        await jugador.enviar({ type: "plantarse" });
      }
      await confirmado.promise;
      const desde = otra.mensajes.length;
      esperarCompra = true;
      const compra = otra.enviar({ type: "fichas.comprar", cantidad: 10, clave: crypto.randomUUID() });
      await autorizada.promise;
      await Bun.sleep(0);
      // La compra ya tiene sesión validada, pero debe esperar la publicación del juego.
      expect(entroCompra).toBe(false);
      liberar.resolve();
      await Promise.all([apuesta, compra]);
      await otra.enviar({ type: "ping" });
      const esperado = operacion === "debitarApuesta" ? [490, 500] : [510, 520];
      expect(otra.mensajes.slice(desde).filter((mensaje) => mensaje.type === "billetera").map((mensaje) => mensaje.fichas)).toEqual(esperado);
      expect((await new BilleteraSQL(base.conexion).consultar(sesion.usuario.id)).fichas).toBe(esperado.at(-1)!);
    } finally {
      liberar.resolve();
      await Promise.all(clientes.map((cliente) => cliente.cerrar()));
      await servidor.stop(true);
      pausa.mockRestore();
      autorizacion.mockRestore();
      compraPausada.mockRestore();
      await base.cerrar();
    }
  });
});
