/** Compone auth, consulta de billetera y asientos sin modificar sus contratos. */
import type { SQL, Server } from "bun";
import { ErrorJuego } from "@blackjack/shared";
import { Sesiones } from "../auth/Sesiones";
import { crearEnrutadorAutenticado } from "../auth/manejadores";
import { PUERTO, topicMesa } from "../config";
import { GestorMesas } from "../game/GestorMesas";
import { BilleteraSQL } from "../store/BilleteraSQL";
import { Tienda } from "../store/Tienda";
import { crearManejadoresEconomia } from "../store/manejadores";
import type { DatosConexion, SocketConexion } from "./Enrutador";
import { iniciarServidor } from "./servidor";

/**
 * Compone sesiones persistentes, economía y asientos sobre el transporte compartido.
 * @param conexion - Pool SQL persistente que el llamador debe cerrar al apagar.
 * @param puerto - Puerto público; cero asigna uno libre para las pruebas.
 * @returns Servidor del Hito 1 con publicaciones nativas Bun.
 * @throws Error Si el puerto no está disponible; los errores de dominio se responden por WS.
 */
export function iniciarAplicacion(conexion: SQL, puerto = PUERTO): Server<DatosConexion> {
  let servidor: Server<DatosConexion>;
  const conexiones = new Map<string, SocketConexion>();
  const gestor = new GestorMesas((topic, mensaje) => servidor.publish(topic, JSON.stringify(mensaje)), (conexionId) => {
    const anterior = conexiones.get(conexionId);
    if (!anterior) return;
    desuscribirMesa(anterior);
    anterior.send(JSON.stringify({ type: "error", codigo: "NO_ESTAS_EN_MESA", mensaje: "Otra pestaña tomó tu asiento. Volviste al lobby." }));
  });
  const billetera = new BilleteraSQL(conexion);
  function desuscribirMesa(socket: SocketConexion): void {
    if (socket.data.mesaId !== undefined) socket.unsubscribe(topicMesa(socket.data.mesaId));
    delete socket.data.mesaId;
  }
  function suscribirMesa(socket: SocketConexion, mesaId: string): void {
    desuscribirMesa(socket);
    socket.subscribe(topicMesa(mesaId));
    socket.data.mesaId = mesaId;
  }
  function limpiarMesa(socket: SocketConexion): void {
    conexiones.delete(socket.data.conexionId!);
    desuscribirMesa(socket);
    if (socket.data.usuarioId === undefined) return;
    gestor.desconectar(socket.data.usuarioId, socket.data.conexionId!);
  }
  const enrutador = crearEnrutadorAutenticado(new Sesiones(conexion), {
    ...crearManejadoresEconomia(billetera, new Tienda(conexion),
      (topic, mensaje) => servidor.publish(topic, JSON.stringify(mensaje))),
    "lobby.listar": () => ({ type: "lobby", mesas: gestor.listar() }),
    "mesa.unirse": (socket, mensaje) => {
      const { usuario, equipado, conexionId } = socket.data;
      if (!usuario || !equipado || !conexionId) throw new ErrorJuego("NO_AUTENTICADO");
      const snapshot = gestor.unirse(mensaje.mesaId, usuario, equipado, conexionId);
      suscribirMesa(socket, mensaje.mesaId);
      return { type: "mesa.estado", ...snapshot };
    },
    "mesa.salir": (socket) => {
      gestor.salir(socket.data.usuarioId!, socket.data.conexionId!);
      desuscribirMesa(socket);
      return { type: "ok" };
    },
  }, {
    mesaDeUsuario: (usuarioId) => gestor.mesaDeUsuario(usuarioId),
    alAutenticar: (socket, sesion) => {
      conexiones.set(socket.data.conexionId!, socket);
      const mesaId = gestor.mesaDeUsuario(sesion.usuario.id);
      if (mesaId === null) return;
      const snapshot = gestor.unirse(mesaId, sesion.usuario, sesion.equipado, socket.data.conexionId!);
      suscribirMesa(socket, mesaId);
      socket.send(JSON.stringify({ type: "mesa.estado", ...snapshot }));
    },
    alCerrar: limpiarMesa,
  });
  servidor = iniciarServidor(puerto, enrutador, limpiarMesa);
  return servidor;
}
