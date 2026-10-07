/** Adapta Sesiones al enrutador; los datos de identidad siempre provienen de SQL. */
import { ErrorJuego, MENSAJES_ERROR, type MensajeServidor } from "@blackjack/shared";
import { topicUsuario } from "../config";
import { Enrutador, type ManejadoresEnrutador, type SocketConexion } from "../ws/Enrutador";
import { Sesiones, type Sesion } from "./Sesiones";

/** Integración opcional; auth conserva independencia del gestor de mesas. */
export interface IntegracionSesion {
  /** Localiza el asiento antes de enviar sesion; la identidad siempre proviene de SQL. */
  mesaDeUsuario?: (usuarioId: number) => string | null;
  /** Vincula mesa y suscripciones tras autenticar, con la identidad ya disponible. */
  alAutenticar?: (socket: SocketConexion, sesion: Sesion) => void;
  /** Distingue pérdida del transporte de revocación/caducidad antes de borrar identidad. */
  alCerrar?: (socket: SocketConexion, motivo: "desconexion" | "sesion") => void;
}

/** Reloj inyectable para probar caducidad sin esperar los siete días de una sesión. */
export interface RelojSesion {
  ahora: () => number;
  programar: (accion: () => void, demoraMs: number) => unknown;
  cancelar: (temporizador: unknown) => void;
}

/**
 * Conecta registro/login/reanudar/logout con la sesión de cada socket.
 * @param sesiones - Servicio persistente de autenticación.
 * @param adicionales - Handlers de otras tareas, sin sustituir los de autenticación.
 * @param integracion - Vinculación y limpieza de recursos de la aplicación.
 * @param opcionesReloj - Sustituye reloj/timers solo para pruebas de caducidad.
 * @param ahoraEnrutador - Reloj monótono del límite de tráfico; inyectable para integración determinista.
 * @returns Enrutador con validación de sesiones persistentes para intenciones protegidas.
 * @throws ErrorJuego Los handlers convierten SESION_INVALIDA y errores de dominio en respuestas públicas.
 */
export function crearEnrutadorAutenticado(
  sesiones: Sesiones, adicionales: ManejadoresEnrutador = {}, integracion: IntegracionSesion = {},
  opcionesReloj: Partial<RelojSesion> = {},
  ahoraEnrutador?: () => number,
): Enrutador {
  const reloj: RelojSesion = {
    ahora: Date.now, programar: (accion, demoraMs) => setTimeout(accion, demoraMs),
    cancelar: (temporizador) => clearTimeout(temporizador as ReturnType<typeof setTimeout>), ...opcionesReloj,
  };
  const conexionesPorToken = new Map<string, Set<SocketConexion>>();
  const caducidades = new Map<string, { expiraEn: number; temporizador: unknown }>();
  const pendientesPorToken = new Map<string, Promise<void>>();
  async function conToken<T>(token: string, operacion: () => Promise<T>): Promise<T> {
    const anterior = pendientesPorToken.get(token) ?? Promise.resolve();
    const actual = anterior.catch(() => {}).then(operacion);
    const fin = actual.then(() => {}, () => {});
    pendientesPorToken.set(token, fin);
    try { return await actual; }
    finally { if (pendientesPorToken.get(token) === fin) pendientesPorToken.delete(token); }
  }
  function limpiarSesion(socket: SocketConexion, motivo: "desconexion" | "sesion" = "sesion"): void {
    // Mesas necesita la identidad antes de que auth la elimine (también al caducar).
    integracion.alCerrar?.(socket, motivo);
    if (socket.data.usuarioId !== undefined) socket.unsubscribe(topicUsuario(socket.data.usuarioId));
    if (socket.data.token) {
      const conexiones = conexionesPorToken.get(socket.data.token);
      conexiones?.delete(socket);
      if (conexiones?.size === 0) {
        conexionesPorToken.delete(socket.data.token);
        cancelarCaducidad(socket.data.token);
      }
    }
    delete socket.data.usuarioId;
    delete socket.data.token;
    delete socket.data.usuario;
    delete socket.data.equipado;
  }
  function cancelarCaducidad(token: string): void {
    const caducidad = caducidades.get(token);
    if (caducidad) reloj.cancelar(caducidad.temporizador);
    caducidades.delete(token);
  }
  function invalidarToken(token: string, origen?: SocketConexion): void {
    for (const conexion of [...conexionesPorToken.get(token) ?? []]) {
      limpiarSesion(conexion);
      if (conexion !== origen && conexion.readyState === WebSocket.OPEN) {
        conexion.send(JSON.stringify({ type: "error", codigo: "SESION_INVALIDA", mensaje: MENSAJES_ERROR.SESION_INVALIDA }));
      }
    }
  }
  function programarCaducidad(sesion: Sesion): void {
    if (caducidades.get(sesion.token)?.expiraEn === sesion.expiraEn) return;
    cancelarCaducidad(sesion.token);
    const temporizador = reloj.programar(() => {
      // No espera una validación SQL en vuelo. Vincular vuelve a comprobar la expiración.
      invalidarToken(sesion.token);
    }, Math.max(0, sesion.expiraEn - reloj.ahora()));
    caducidades.set(sesion.token, { expiraEn: sesion.expiraEn, temporizador });
  }
  function vincular(socket: SocketConexion, sesion: Sesion): MensajeServidor {
    if (sesion.expiraEn <= reloj.ahora()) throw new ErrorJuego("SESION_INVALIDA");
    if (socket.readyState === WebSocket.OPEN) {
      Object.assign(socket.data, { usuarioId: sesion.usuario.id, token: sesion.token, usuario: sesion.usuario, equipado: sesion.equipado });
      socket.subscribe(topicUsuario(sesion.usuario.id));
      const conexiones = conexionesPorToken.get(sesion.token) ?? new Set<SocketConexion>();
      conexiones.add(socket);
      conexionesPorToken.set(sesion.token, conexiones);
      programarCaducidad(sesion);
      integracion.alAutenticar?.(socket, sesion);
    }
    // expiraEn sirve al timer del servidor; el contrato público continúa estricto y sin metadata.
    return { type: "sesion", token: sesion.token, usuario: sesion.usuario,
      billetera: sesion.billetera, equipado: sesion.equipado, mesaId: integracion.mesaDeUsuario?.(sesion.usuario.id) ?? null };
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
        invalidarToken(token, socket);
        return { type: "ok" };
      });
    },
  }, undefined, async (socket) => {
    try {
      if (!socket.data.token) throw new ErrorJuego("SESION_INVALIDA");
      const sesion = await sesiones.validar(socket.data.token);
      if (sesion.usuario.id !== socket.data.usuarioId) throw new ErrorJuego("SESION_INVALIDA");
      programarCaducidad(sesion);
      // Una operación autorizada aquí puede terminar tras logout/caducidad. Revocar no
      // deshace un commit en curso; el handler conserva la identidad validada y no la restaura.
    } catch (error) {
      if (error instanceof ErrorJuego && error.codigo === "SESION_INVALIDA" && socket.data.token) {
        invalidarToken(socket.data.token, socket);
      }
      throw error;
    }
  }, (socket) => limpiarSesion(socket, "desconexion"), ahoraEnrutador);
}
