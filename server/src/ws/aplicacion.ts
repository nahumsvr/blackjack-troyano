/** Compone auth, consulta de billetera y asientos sin modificar sus contratos. */
import type { SQL, Server } from "bun";
import { ErrorJuego } from "@blackjack/shared";
import { Sesiones } from "../auth/Sesiones";
import { crearEnrutadorAutenticado } from "../auth/manejadores";
import { PUERTO } from "../config";
import { GestorMesas } from "../game/GestorMesas";
import { BilleteraSQL } from "../store/BilleteraSQL";
import { Tienda } from "../store/Tienda";
import { crearManejadoresEconomia } from "../store/manejadores";
import type { DatosConexion, SocketConexion } from "./Enrutador";
import { iniciarServidor } from "./servidor";

/**
 * @param conexion - Pool SQL persistente que el llamador debe cerrar al apagar.
 * @param puerto - Puerto público; cero asigna uno libre para las pruebas.
 * @returns Servidor del Hito 1 con publicaciones nativas Bun.
 * @throws Propaga errores de inicio del transporte.
 */
export function iniciarAplicacion(conexion: SQL, puerto = PUERTO): Server<DatosConexion> {
  let servidor: Server<DatosConexion>;
  const gestor = new GestorMesas((topic, mensaje) => servidor.publish(topic, JSON.stringify(mensaje)));
  const billetera = new BilleteraSQL(conexion);
  function suscribirMesa(socket: SocketConexion, mesaId: string): void {
    if (socket.data.mesaId !== undefined) socket.unsubscribe(`mesa:${socket.data.mesaId}`);
    socket.subscribe(`mesa:${mesaId}`);
    socket.data.mesaId = mesaId;
  }
  function limpiarMesa(socket: SocketConexion): void {
    if (socket.data.mesaId !== undefined) socket.unsubscribe(`mesa:${socket.data.mesaId}`);
    delete socket.data.mesaId;
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
      const mesaId = gestor.salir(socket.data.usuarioId!, socket.data.conexionId!);
      socket.unsubscribe(`mesa:${mesaId}`);
      delete socket.data.mesaId;
      return { type: "ok" };
    },
  }, {
    mesaDeUsuario: (usuarioId) => gestor.mesaDeUsuario(usuarioId),
    alAutenticar: (socket, sesion) => {
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
