/** Transporte WebSocket nativo y conteo de conexiones del lobby (T-06). */
import { type Server } from "bun";
import { HOST, PUERTO, RUTA_WS, TOPIC_LOBBY } from "../config";
import { Enrutador, type DatosConexion, type SocketConexion } from "./Enrutador";

/**
 * Inicia Bun.serve y publica el conteo al abrir o cerrar un socket.
 * @param puerto - Puerto de escucha; cero permite usar uno libre en las pruebas.
 * @param enrutador - Validador y handlers compartidos por las conexiones.
 * @param alCerrar - Libera recursos del socket en los servicios de la aplicación.
 * @returns Servidor que el llamador puede detener.
 * @throws Error Si no se puede abrir el puerto solicitado.
 */
export function iniciarServidor(
  puerto: number = PUERTO, enrutador = new Enrutador(), alCerrar?: (socket: SocketConexion) => void,
): Server<DatosConexion> {
  let conectados = 0;
  const servidor = Bun.serve<DatosConexion>({
    hostname: HOST,
    port: puerto,
    fetch(peticion, servidorActual) {
      if (new URL(peticion.url).pathname !== RUTA_WS) {
        return new Response("No encontrado", { status: 404 });
      }
      if (servidorActual.upgrade(peticion, { data: { conexionId: crypto.randomUUID() } })) return;
      return new Response("Se requiere una conexion WebSocket", { status: 426 });
    },
    websocket: {
      open(socket) {
        conectados += 1;
        socket.subscribe(TOPIC_LOBBY);
        // server.publish incluye al socket nuevo; ws.publish lo excluiría.
        servidor.publish(TOPIC_LOBBY, JSON.stringify({ type: "bienvenida", conectados }));
      },
      close(socket) {
        alCerrar?.(socket);
        socket.unsubscribe(TOPIC_LOBBY);
        conectados -= 1;
        servidor.publish(TOPIC_LOBBY, JSON.stringify({ type: "bienvenida", conectados }));
      },
      message(socket, datos) {
        return enrutador.manejar(socket, datos);
      },
    },
  });
  return servidor;
}
