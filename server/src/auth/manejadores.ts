/** Adapta Sesiones al enrutador; los datos de identidad siempre provienen de SQL. */
import { ErrorJuego, MENSAJES_ERROR, type MensajeServidor } from "@blackjack/shared";
import { topicUsuario } from "../config";
import { Enrutador, type ManejadoresEnrutador, type SocketConexion } from "../ws/Enrutador";
import { Sesiones, type Sesion } from "./Sesiones";

/** Integración opcional; auth conserva independencia del gestor de mesas. */
export interface IntegracionSesion {
  /**
   * Localiza el asiento antes de enviar sesion.
   * @param usuarioId - Identidad confirmada por SQL.
   * @returns Mesa reservada u ocupada, o null si no conserva asiento.
   */
  mesaDeUsuario?: (usuarioId: number) => string | null;
  /**
   * Vincula mesa y suscripciones tras autenticar.
   * @param socket - Conexión abierta con identidad ya vinculada.
   * @param sesion - Datos persistentes de la sesión validada.
   * @returns Sin valor.
   * @throws Error Propaga fallos de la integración al enrutador.
   */
  alAutenticar?: (socket: SocketConexion, sesion: Sesion) => void;
  /**
   * Limpia recursos antes de borrar la identidad de la conexión.
   * @param socket - Conexión cuya identidad todavía está disponible.
   * @param motivo - Desconexión reserva el asiento; sesión indica revocación o caducidad.
   * @returns Sin valor.
   * @throws Error Propaga fallos del callback a su llamador.
   */
  alCerrar?: (socket: SocketConexion, motivo: "desconexion" | "sesion") => void;
}

/** Reloj inyectable para probar caducidad sin esperar los siete días de una sesión. */
export interface RelojSesion {
  /**
   * Consulta el tiempo del servidor.
   * @returns Tiempo actual en epoch ms.
   */
  ahora: () => number;
  /**
   * Programa la caducidad de un token compartido por varias conexiones.
   * @param accion - Limpieza de conexiones al vencer la sesión.
   * @param demoraMs - Espera en milisegundos.
   * @returns Identificador opaco del temporizador.
   */
  programar: (accion: () => void, demoraMs: number) => unknown;
  /**
   * Cancela la caducidad cuando ya no quedan conexiones del token.
   * @param temporizador - Identificador devuelto por programar.
   * @returns Sin valor.
   */
  cancelar: (temporizador: unknown) => void;
}

/**
 * Conecta registro/login/reanudar/logout con la sesión de cada socket.
 * Los errores de registro, login, reanudación y logout ocurren al ejecutar sus handlers;
 * el enrutador los convierte en respuestas públicas, incluida SESION_INVALIDA.
 * @param sesiones - Servicio persistente de autenticación.
 * @param adicionales - Handlers de otras tareas, sin sustituir los de autenticación.
 * @param integracion - Vinculación y limpieza de recursos de la aplicación.
 * @param opcionesReloj - Sustituye reloj/timers solo para pruebas de caducidad.
 * @returns Enrutador con validación de sesiones persistentes para intenciones protegidas.
 * @throws ErrorJuego MENSAJE_INVALIDO | USUARIO_EXISTE | CREDENCIALES_INVALIDAS |
 * NO_AUTENTICADO | YA_AUTENTICADO | SESION_INVALIDA | ERROR_INTERNO al ejecutar sus handlers;
 * el enrutador convierte los fallos en respuestas públicas.
 */
export function crearEnrutadorAutenticado(
  sesiones: Sesiones, adicionales: ManejadoresEnrutador = {}, integracion: IntegracionSesion = {},
  opcionesReloj: Partial<RelojSesion> = {},
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
    try { integracion.alCerrar?.(socket, motivo); }
    finally {
      if (socket.data.usuarioId !== undefined) {
        try { socket.unsubscribe(topicUsuario(socket.data.usuarioId)); }
        catch (error) { console.error("Error al retirar la suscripcion privada", error); }
      }
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
  }
  function cancelarCaducidad(token: string): void {
    const caducidad = caducidades.get(token);
    if (caducidad) reloj.cancelar(caducidad.temporizador);
    caducidades.delete(token);
  }
  function invalidarToken(token: string, origen?: SocketConexion): void {
    for (const conexion of [...conexionesPorToken.get(token) ?? []]) {
      // Revocar un token afecta a todas sus pestañas, aunque falle la limpieza de una mesa.
      try { limpiarSesion(conexion); }
      catch (error) { console.error("Error al limpiar una sesion revocada", error); }
      if (conexion !== origen && conexion.readyState === WebSocket.OPEN) {
        try { conexion.send(JSON.stringify({ type: "error", codigo: "SESION_INVALIDA", mensaje: MENSAJES_ERROR.SESION_INVALIDA })); }
        catch (error) { console.error("Error al avisar de una sesion revocada", error); }
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
    const mesaId = integracion.mesaDeUsuario?.(sesion.usuario.id) ?? null;
    if (socket.readyState === WebSocket.OPEN) {
      try {
        Object.assign(socket.data, { usuarioId: sesion.usuario.id, token: sesion.token, usuario: sesion.usuario, equipado: sesion.equipado });
        socket.subscribe(topicUsuario(sesion.usuario.id));
        const conexiones = conexionesPorToken.get(sesion.token) ?? new Set<SocketConexion>();
        conexiones.add(socket);
        conexionesPorToken.set(sesion.token, conexiones);
        programarCaducidad(sesion);
        integracion.alAutenticar?.(socket, sesion);
      } catch (error) {
        // Si la integración falla, el error de login no debe dejar identidad ni suscripciones.
        try { limpiarSesion(socket); }
        catch (errorLimpieza) { console.error("Error al revertir la vinculacion", errorLimpieza); }
        throw error;
      }
    }
    // expiraEn sirve al timer del servidor; el contrato público continúa estricto y sin metadata.
    return { type: "sesion", token: sesion.token, usuario: sesion.usuario,
      billetera: sesion.billetera, equipado: sesion.equipado, mesaId };
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
  }, (socket) => limpiarSesion(socket, "desconexion"));
}
