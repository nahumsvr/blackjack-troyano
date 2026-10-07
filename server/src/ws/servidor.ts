/** Transporte WebSocket y conteo del lobby (T-06); sirve el cliente compilado (T-38). */
import { type Server } from "bun";
import { COMPROBAR_CIERRE_MS, DIRECTORIO_CLIENTE, HOST, PUERTO, RUTA_WS, TOPIC_LOBBY } from "../config";
import { servirCliente } from "./clienteEstatico";
import { Enrutador, type DatosConexion, type SocketConexion } from "./Enrutador";

/**
 * Inicia Bun.serve y publica el conteo al abrir o cerrar un socket.
 * @param puerto - Puerto de escucha; cero permite usar uno libre en las pruebas.
 * @param enrutador - Validador y handlers compartidos por las conexiones.
 * @param alCerrar - Limpieza adicional de la aplicación antes de retirar la identidad.
 * @param directorioCliente - Build de Vite; permite fixtures aislados en pruebas HTTP.
 * @returns Servidor que el llamador puede detener.
 * @throws Error Si no se puede abrir el puerto solicitado.
 */
export function iniciarServidor(
  puerto: number = PUERTO, enrutador = new Enrutador(), alCerrar?: (socket: SocketConexion) => void,
  directorioCliente = DIRECTORIO_CLIENTE,
): Server<DatosConexion> {
  let conectados = 0;
  const conexiones = new Set<SocketConexion>();
  const servidor = Bun.serve<DatosConexion>({
    hostname: HOST,
    port: puerto,
    fetch(peticion, servidorActual) {
      if (new URL(peticion.url).pathname !== RUTA_WS) {
        return servirCliente(peticion, directorioCliente);
      }
      if (servidorActual.upgrade(peticion, { data: { conexionId: crypto.randomUUID() } })) return;
      return new Response("Se requiere una conexion WebSocket", { status: 426 });
    },
    websocket: {
      open(socket) {
        conexiones.add(socket);
        conectados += 1;
        socket.subscribe(TOPIC_LOBBY);
        // server.publish incluye al socket nuevo; ws.publish lo excluiría.
        servidor.publish(TOPIC_LOBBY, JSON.stringify({ type: "bienvenida", conectados }));
      },
      close(socket) {
        try {
          alCerrar?.(socket);
        } catch (error) {
          console.error("Error al limpiar la mesa", error);
        } finally {
          try {
            enrutador.cerrar(socket);
          } catch (error) {
            console.error("Error al limpiar la sesion", error);
          } finally {
            // Ambos hooks deben ejecutarse: un fallo de mesa no conserva una sesión
            // privada ni impide descontar la conexión que ya cerró el transporte.
            conexiones.delete(socket);
            socket.unsubscribe(TOPIC_LOBBY);
            conectados -= 1;
            servidor.publish(TOPIC_LOBBY, JSON.stringify({ type: "bienvenida", conectados }));
          }
        }
      },
      message(socket, datos) {
        return enrutador.manejar(socket, datos);
      },
    },
  });
  const detenerNativo = servidor.stop.bind(servidor);
  servidor.stop = async (cerrarConexiones) => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const detenido = detenerNativo(cerrarConexiones);
    // Bun 1.3.13 conserva pendingWebSockets tras un cierre iniciado por el servidor,
    // aunque close ya haya limpiado sesión y mesa. No esperar ese contador obsoleto;
    // sí esperar todos los hooks reales y las respuestas HTTP todavía activas.
    const cerrado = new Promise<void>((resolver) => {
      const comprobar = () => {
        if (conexiones.size === 0 && servidor.pendingRequests === 0) resolver();
        else temporizador = setTimeout(comprobar, COMPROBAR_CIERRE_MS);
      };
      comprobar();
    });
    try { await Promise.race([detenido.then(() => cerrado), cerrado]); }
    finally { if (temporizador !== undefined) clearTimeout(temporizador); }
  };
  return servidor;
}
