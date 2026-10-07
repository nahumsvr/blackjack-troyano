/** Conecta las tres intenciones de juego con el dueño autoritativo de cada asiento. */
import { ErrorJuego } from "@blackjack/shared";
import type { GestorMesas } from "../game/GestorMesas";
import type { ManejadoresEnrutador, SocketConexion } from "./Enrutador";

/**
 * Conecta las intenciones con el motor y revalida la propiedad tras esperar su cola.
 * @param gestor - Mesas con billetera inyectada; el cliente no elige identidad ni turno.
 * @returns Handlers con snapshots directos, además de las publicaciones del motor.
 * @throws ErrorJuego NO_AUTENTICADO | NO_ESTAS_EN_MESA | FASE_INCORRECTA | NO_ES_TU_TURNO | YA_APOSTASTE | CANTIDAD_INVALIDA | FICHAS_INSUFICIENTES | ERROR_INTERNO.
 */
export function crearManejadoresJuego(gestor: GestorMesas): ManejadoresEnrutador {
  function propietario(socket: SocketConexion) {
    const { usuarioId, conexionId } = socket.data;
    if (usuarioId === undefined || !conexionId) throw new ErrorJuego("NO_AUTENTICADO");
    const mesa = gestor.mesaDelPropietario(usuarioId, conexionId);
    const autorizar = () => {
      if (socket.readyState !== WebSocket.OPEN || socket.data.usuarioId !== usuarioId
        || gestor.mesaDelPropietario(usuarioId, conexionId) !== mesa) throw new ErrorJuego("NO_ESTAS_EN_MESA");
    };
    return { mesa, usuarioId, autorizar };
  }
  return {
    apostar: async (socket, mensaje) => {
      const { mesa, usuarioId, autorizar } = propietario(socket);
      await mesa.apostar(usuarioId, mensaje.cantidad, autorizar);
      return { type: "mesa.estado", ...mesa.snapshot() };
    },
    pedir: async (socket) => {
      const { mesa, usuarioId, autorizar } = propietario(socket);
      await mesa.pedir(usuarioId, autorizar);
      return { type: "mesa.estado", ...mesa.snapshot() };
    },
    plantarse: async (socket) => {
      const { mesa, usuarioId, autorizar } = propietario(socket);
      await mesa.plantarse(usuarioId, autorizar);
      return { type: "mesa.estado", ...mesa.snapshot() };
    },
  };
}
