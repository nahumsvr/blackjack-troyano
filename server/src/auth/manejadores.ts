/** Adapta Sesiones al enrutador; los datos de identidad siempre provienen de SQL. */
import { ErrorJuego, type MensajeServidor } from "@blackjack/shared";
import { Enrutador, type ManejadoresEnrutador, type SocketConexion } from "../ws/Enrutador";
import { Sesiones, type Sesion } from "./Sesiones";

/** Integración opcional; auth conserva independencia del gestor de mesas. */
export interface IntegracionSesion {
  mesaDeUsuario?: (usuarioId: number) => string | null;
  alAutenticar?: (socket: SocketConexion, sesion: Sesion) => void;
  alCerrar?: (socket: SocketConexion) => void;
}

/**
 * Conecta registro/login/reanudar/logout con la sesión de cada socket.
 * @param sesiones - Servicio persistente de autenticación.
 * @param adicionales - Handlers de otras tareas, sin sustituir los de autenticación.
 * @param integracion - Vinculación/limpieza de recursos asociados a la identidad.
 * @returns Enrutador con validación de sesiones persistentes para intenciones protegidas.
 */
export function crearEnrutadorAutenticado(
  sesiones: Sesiones, adicionales: ManejadoresEnrutador = {}, integracion: IntegracionSesion = {},
): Enrutador {
  function vincular(socket: SocketConexion, sesion: Sesion): MensajeServidor {
    if (socket.readyState === WebSocket.OPEN) {
      Object.assign(socket.data, { usuarioId: sesion.usuario.id, token: sesion.token, usuario: sesion.usuario, equipado: sesion.equipado });
      integracion.alAutenticar?.(socket, sesion);
    }
    return { type: "sesion", ...sesion, mesaId: integracion.mesaDeUsuario?.(sesion.usuario.id) ?? null };
  }
  return new Enrutador({
    ...adicionales,
    registro: async (socket, mensaje) => vincular(socket, await sesiones.registrar(mensaje.usuario, mensaje.contrasena)),
    login: async (socket, mensaje) => vincular(socket, await sesiones.login(mensaje.usuario, mensaje.contrasena)),
    reanudar: async (socket, mensaje) => vincular(socket, await sesiones.validar(mensaje.token)),
    logout: async (socket) => {
      if (!socket.data.token) throw new ErrorJuego("NO_AUTENTICADO");
      await sesiones.cerrar(socket.data.token);
      integracion.alCerrar?.(socket);
      limpiarSesion(socket);
      return { type: "ok" };
    },
  }, undefined, async (socket) => {
    try {
      if (!socket.data.token) throw new ErrorJuego("SESION_INVALIDA");
      const sesion = await sesiones.validar(socket.data.token);
      if (sesion.usuario.id !== socket.data.usuarioId) throw new ErrorJuego("SESION_INVALIDA");
    } catch (error) {
      if (error instanceof ErrorJuego && error.codigo === "SESION_INVALIDA") {
        integracion.alCerrar?.(socket);
        limpiarSesion(socket);
      }
      throw error;
    }
  });
}

function limpiarSesion(socket: SocketConexion): void {
  delete socket.data.usuarioId;
  delete socket.data.token;
  delete socket.data.usuario;
  delete socket.data.equipado;
}
