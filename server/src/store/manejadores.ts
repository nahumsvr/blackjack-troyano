/** Adapta economía al transporte; publica únicamente estados confirmados por SQL. */
import { ErrorJuego, type MensajeServidor } from "@blackjack/shared";
import type { ManejadoresEnrutador, SocketConexion } from "../ws/Enrutador";
import type { Billetera } from "./Billetera";
import type { Tienda } from "./Tienda";

/**
 * Conecta consultas y compras con el enrutador sin acoplar los servicios a Bun.serve.
 * @param billetera - Economía persistente que confirma compras antes de devolver saldos.
 * @param tienda - Catálogo, inventario e historial del usuario autenticado.
 * @param publicar - Publicador del servidor, incluye todas las pestañas del usuario.
 * @returns Seis handlers; el enrutador incorpora reqId solo a su respuesta directa.
 * @throws ErrorJuego Propaga códigos de economía/tienda para convertirlos en mensajes error.
 */
export function crearManejadoresEconomia(
  billetera: Billetera,
  tienda: Tienda,
  publicar: (topic: string, mensaje: MensajeServidor) => void,
): ManejadoresEnrutador {
  function usuarioDe(socket: SocketConexion): number {
    if (socket.data.usuarioId === undefined) throw new ErrorJuego("NO_AUTENTICADO");
    return socket.data.usuarioId;
  }
  return {
    "billetera.consultar": async (socket) => ({ type: "billetera", ...await billetera.consultar(usuarioDe(socket)) }),
    "fichas.comprar": async (socket, mensaje) => {
      const usuarioId = usuarioDe(socket);
      const respuesta: MensajeServidor = {
        type: "billetera", ...await billetera.comprarFichas(usuarioId, mensaje.cantidad, mensaje.clave),
      };
      // server.publish sigue funcionando aunque el comprador cierre antes del commit.
      publicar(`usuario:${usuarioId}`, respuesta);
      return respuesta;
    },
    "tienda.catalogo": async (socket) => ({ type: "catalogo", articulos: await tienda.catalogo(usuarioDe(socket)) }),
    "tienda.comprar": async (socket, mensaje) => {
      const usuarioId = usuarioDe(socket);
      const compra = await tienda.comprar(usuarioId, mensaje.articuloId);
      const respuesta: MensajeServidor = { type: "inventario", ...compra.inventario };
      publicar(`usuario:${usuarioId}`, { type: "billetera", ...compra.billetera });
      publicar(`usuario:${usuarioId}`, respuesta);
      return respuesta;
    },
    "inventario.listar": async (socket) => ({ type: "inventario", ...await tienda.inventario(usuarioDe(socket)) }),
    "movimientos.listar": async (socket, mensaje) => ({
      type: "movimientos", ...await tienda.listarMovimientos(usuarioDe(socket), mensaje.limite, mensaje.antesDe),
    }),
  };
}
