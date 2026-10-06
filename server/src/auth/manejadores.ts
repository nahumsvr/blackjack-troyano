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
  const conexionesPorToken = new Map<string, Set<SocketConexion>>();
  const pendientesPorToken = new Map<string, Promise<void>>();
  async function conToken<T>(token: string, operacion: () => Promise<T>): Promise<T> {
    const anterior = pendientesPorToken.get(token) ?? Promise.resolve();
    const actual = anterior.catch(() => {}).then(operacion);
    const fin = actual.then(() => {}, () => {});
    pendientesPorToken.set(token, fin);
    try { return await actual; }
    finally { if (pendientesPorToken.get(token) === fin) pendientesPorToken.delete(token); }
  }
  function limpiarSesion(socket: SocketConexion): void {
    if (socket.data.usuarioId !== undefined) socket.unsubscribe(`usuario:${socket.data.usuarioId}`);
    if (socket.data.token) {
      const conexiones = conexionesPorToken.get(socket.data.token);
      conexiones?.delete(socket);
      if (conexiones?.size === 0) conexionesPorToken.delete(socket.data.token);
    }
    delete socket.data.usuarioId;
    delete socket.data.token;
    delete socket.data.usuario;
    delete socket.data.equipado;
    delete socket.data.alCerrar;
  }
  function vincular(socket: SocketConexion, sesion: Sesion): MensajeServidor {
    if (socket.readyState === WebSocket.OPEN) {
      Object.assign(socket.data, { usuarioId: sesion.usuario.id, token: sesion.token, usuario: sesion.usuario, equipado: sesion.equipado });
      socket.subscribe(`usuario:${sesion.usuario.id}`);
      const conexiones = conexionesPorToken.get(sesion.token) ?? new Set<SocketConexion>();
      conexiones.add(socket);
      conexionesPorToken.set(sesion.token, conexiones);
      socket.data.alCerrar = () => limpiarSesion(socket);
      integracion.alAutenticar?.(socket, sesion);
    }
    return { type: "sesion", ...sesion, mesaId: integracion.mesaDeUsuario?.(sesion.usuario.id) ?? null };
  }
  return new Enrutador({
    ...adicionales,
    registro: async (socket, mensaje) => vincular(socket, await sesiones.registrar(mensaje.usuario, mensaje.contrasena)),
    login: async (socket, mensaje) => vincular(socket, await sesiones.login(mensaje.usuario, mensaje.contrasena)),
    // Validar y vincular son indivisibles frente a logout del mismo token en otra pestaña.
    reanudar: (socket, mensaje) => conToken(mensaje.token.toLowerCase(), async () =>
      vincular(socket, await sesiones.validar(mensaje.token))),
    logout: async (socket) => {
      if (!socket.data.token) throw new ErrorJuego("NO_AUTENTICADO");
      const token = socket.data.token;
      return conToken(token, async () => {
        await sesiones.cerrar(token);
        // Un token reanudado en otra pestaña también deja de recibir eventos privados.
        for (const conexion of [...conexionesPorToken.get(token) ?? []]) {
          integracion.alCerrar?.(conexion);
          if (conexion === socket) limpiarSesion(conexion);
          else conexion.unsubscribe(`usuario:${conexion.data.usuarioId}`);
        }
        return { type: "ok" };
      });
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
