/** Adapta economía al transporte; publica únicamente estados confirmados por SQL. */
import { ErrorJuego, type MensajeServidor } from "@blackjack/shared";
import type { ManejadoresEnrutador, SocketConexion } from "../ws/Enrutador";
import { topicUsuario } from "../config";
import type { Billetera } from "./Billetera";
import type { Tienda } from "./Tienda";

/**
 * Conecta consultas y compras con el enrutador sin acoplar los servicios a Bun.serve.
 * @param billetera - Economía persistente que confirma compras antes de devolver saldos.
 * @param tienda - Catálogo, inventario e historial del usuario autenticado.
 * @param publicar - Publicador del servidor, incluye todas las pestañas del usuario.
 * @returns Seis handlers y su exclusión por usuario; incluye el envío directo del enrutador.
 * @throws ErrorJuego Propaga códigos de economía/tienda para convertirlos en mensajes error.
 */
export function crearManejadoresEconomia(
  billetera: Billetera,
  tienda: Tienda,
  publicar: (topic: string, mensaje: MensajeServidor) => void,
): ManejadoresEnrutador {
  const pendientes = new Map<number, Promise<void>>();
  const tiposEconomia = new Set(["billetera.consultar", "fichas.comprar", "tienda.catalogo",
    "tienda.comprar", "inventario.listar", "movimientos.listar"]);
  function usuarioDe(socket: SocketConexion): number {
    if (socket.data.usuarioId === undefined) throw new ErrorJuego("NO_AUTENTICADO");
    return socket.data.usuarioId;
  }
  function publicarRespuesta(socket: SocketConexion, usuarioId: number, respuesta: MensajeServidor): void {
    if (socket.readyState === WebSocket.OPEN) socket.publish(topicUsuario(usuarioId), JSON.stringify(respuesta));
    else publicar(topicUsuario(usuarioId), respuesta);
  }
  return {
    serializar: async (socket, mensaje, responder) => {
      if (!tiposEconomia.has(mensaje.type)) return responder();
      const usuarioId = usuarioDe(socket);
      const anterior = pendientes.get(usuarioId) ?? Promise.resolve();
      const actual = anterior.catch(() => {}).then(async () => {
        // Si se revocó mientras esperaba la cola, la operación todavía no comenzó.
        if (socket.data.usuarioId !== usuarioId) throw new ErrorJuego("NO_AUTENTICADO");
        await responder();
      });
      const fin = actual.then(() => {}, () => {});
      pendientes.set(usuarioId, fin);
      try { await actual; }
      finally { if (pendientes.get(usuarioId) === fin) pendientes.delete(usuarioId); }
    },
    "billetera.consultar": async (socket) => ({ type: "billetera", ...await billetera.consultar(usuarioDe(socket)) }),
    "fichas.comprar": async (socket, mensaje) => {
      const usuarioId = usuarioDe(socket);
      const respuesta: MensajeServidor = {
        type: "billetera", ...await billetera.comprarFichas(usuarioId, mensaje.cantidad, mensaje.clave),
      };
      // La respuesta directa cubre al originador; el fallback cubre a sus pares si cerró.
      publicarRespuesta(socket, usuarioId, respuesta);
      return respuesta;
    },
    "tienda.catalogo": async (socket) => ({ type: "catalogo", articulos: await tienda.catalogo(usuarioDe(socket)) }),
    "tienda.comprar": async (socket, mensaje) => {
      const usuarioId = usuarioDe(socket);
      const compra = await tienda.comprar(usuarioId, mensaje.articuloId);
      const respuesta: MensajeServidor = { type: "inventario", ...compra.inventario };
      // Los pares ven primero el artículo. El comprador recibe inventario solo con reqId.
      publicarRespuesta(socket, usuarioId, respuesta);
      publicar(topicUsuario(usuarioId), { type: "billetera", ...compra.billetera });
      return respuesta;
    },
    "inventario.listar": async (socket) => ({ type: "inventario", ...await tienda.inventario(usuarioDe(socket)) }),
    "movimientos.listar": async (socket, mensaje) => ({
      type: "movimientos", ...await tienda.listarMovimientos(usuarioDe(socket), mensaje.limite, mensaje.antesDe),
    }),
  };
}
