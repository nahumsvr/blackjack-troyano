/** Valida el contrato compartido y despacha intenciones sin depender de SQL (T-07). */
import {
  crearErrorValidacion, ErrorJuego, MENSAJES_ERROR, MensajeClienteSchema,
  type Equipado, type MensajeCliente, type MensajeServidor, type UsuarioVista,
} from "@blackjack/shared";
import type { ServerWebSocket } from "bun";
import { MENSAJE_MAX_BYTES } from "../config";

/** Sesión asociada por los handlers de autenticación, nunca por entrada del cliente. */
export interface DatosConexion {
  conexionId?: string;
  mesaId?: string;
  usuarioId?: number;
  token?: string;
  usuario?: UsuarioVista;
  equipado?: Equipado;
}
/** Socket nativo con identidad y suscripciones administradas exclusivamente por el servidor. */
export type SocketConexion = ServerWebSocket<DatosConexion>;
type TipoManejado = Exclude<MensajeCliente["type"], "ping">;
/** Cada handler recibe solo su intención validada y devuelve la respuesta directa. */
type ManejadoresIntenciones = Partial<{
  [Tipo in TipoManejado]: (
    socket: SocketConexion, mensaje: Extract<MensajeCliente, { type: Tipo }>,
  ) => MensajeServidor | Promise<MensajeServidor>;
}>;
/** Intenciones opcionales y exclusión compartida para componer los servicios del servidor. */
export type ManejadoresEnrutador = ManejadoresIntenciones & {
  /**
   * Mantiene una exclusión compartida hasta enviar la respuesta directa.
   * @param socket - Conexión con identidad validada.
   * @param mensaje - Intención validada con el contrato compartido.
   * @param responder - Ejecuta el handler y envía su respuesta dentro de la exclusión.
   * @returns Confirmación de que terminó la operación y se liberó la exclusión.
   * @throws Error Propaga fallos del handler al try/catch del enrutador.
   */
  serializar?: (socket: SocketConexion, mensaje: MensajeCliente, responder: () => Promise<void>) => Promise<void>;
};

/** Enrutador común; los servicios de auth, mesa y economía se conectan por inyección. */
export class Enrutador {
  private readonly pendientes = new WeakMap<SocketConexion, Promise<void>>();
  /**
   * Compone handlers y callbacks de sesión sin acoplar el transporte a SQL.
   * @param manejadores - Intenciones implementadas por las tareas siguientes.
   * @param registrarError - Registra excepciones inesperadas solo en el servidor.
   * @param validarSesion - Comprueba vigencia/revocación antes de ejecutar intenciones protegidas.
   * @param limpiarConexion - Libera recursos de la conexión al cerrar el transporte.
   * @returns Enrutador con ping disponible incluso sin servicios instalados.
   */
  constructor(
    private readonly manejadores: ManejadoresEnrutador = {},
    private readonly registrarError: (error: unknown) => void = (error) => console.error("Error interno en Enrutador", error),
    private readonly validarSesion?: (socket: SocketConexion) => Promise<void>,
    private readonly limpiarConexion?: (socket: SocketConexion) => void,
  ) {}

  /**
   * Libera los recursos inyectados sin guardar closures en los datos de cada socket.
   * @param socket - Conexión cerrada; su identidad sigue disponible para el callback.
   * @returns Nada.
   * @throws Error Propaga fallos del callback de limpieza; el transporte los captura al cerrar.
   */
  cerrar(socket: SocketConexion): void { this.limpiarConexion?.(socket); }

  /**
   * Valida tamaño, JSON y esquema; conserva reqId y convierte fallos en error público.
   * @param socket - Conexión que originó la intención.
   * @param datos - Frame textual o binario recibido por Bun.
   * @returns Finalización de la respuesta, o sin envío si el socket ya cerró;
   * los errores de dominio se convierten en mensajes públicos.
   * @throws Error Si falla el envío o el registrador de errores inyectado; los handlers
   * y validaciones se capturan y responden con su código o ERROR_INTERNO.
   */
  manejar(socket: SocketConexion, datos: string | Buffer): Promise<void> {
    // Auth y logout de un mismo socket conservan el orden aunque hagan consultas async.
    const anterior = this.pendientes.get(socket) ?? Promise.resolve();
    const actual = anterior.catch(() => {}).then(() => this.procesar(socket, datos));
    this.pendientes.set(socket, actual);
    const limpiar = () => { if (this.pendientes.get(socket) === actual) this.pendientes.delete(socket); };
    void actual.then(limpiar, limpiar);
    return actual;
  }

  private async procesar(socket: SocketConexion, datos: string | Buffer): Promise<void> {
    if (socket.readyState !== WebSocket.OPEN) return;
    let reqId: string | undefined;
    try {
      // No fijar maxPayloadLength a 16 KB: Bun cerraría el socket antes de responder
      // al frame de 1 MB exigido por T-07. Se conserva el techo nativo de 16 MB.
      if (typeof datos !== "string" || Buffer.byteLength(datos, "utf8") > MENSAJE_MAX_BYTES) {
        throw new ErrorJuego("MENSAJE_INVALIDO");
      }
      let entrada: unknown;
      try {
        entrada = JSON.parse(datos);
      } catch {
        throw new ErrorJuego("MENSAJE_INVALIDO");
      }
      const validado = MensajeClienteSchema.safeParse(entrada);
      if (!validado.success) {
        this.enviar(socket, crearErrorValidacion(entrada, validado.error));
        return;
      }
      const mensaje = validado.data;
      reqId = mensaje.reqId;
      const esAcceso = mensaje.type === "registro" || mensaje.type === "login" || mensaje.type === "reanudar";
      if (esAcceso && socket.data.usuarioId !== undefined) throw new ErrorJuego("YA_AUTENTICADO");
      if (!esAcceso && mensaje.type !== "ping" && socket.data.usuarioId === undefined) {
        throw new ErrorJuego("NO_AUTENTICADO");
      }
      if (!esAcceso && mensaje.type !== "ping") await this.validarSesion?.(socket);
      if (socket.readyState !== WebSocket.OPEN) return;
      const responder = async () => {
        const respuesta = await this.despachar(socket, mensaje);
        // La correlación pertenece al transporte; la exclusión termina después del envío.
        this.enviar(socket, { ...respuesta, reqId });
      };
      if (this.manejadores.serializar) await this.manejadores.serializar(socket, mensaje, responder);
      else await responder();
    } catch (error) {
      const codigo = error instanceof ErrorJuego ? error.codigo : "ERROR_INTERNO";
      if (!(error instanceof ErrorJuego)) this.registrarError(error);
      this.enviar(socket, { type: "error", codigo, mensaje: MENSAJES_ERROR[codigo], reqId });
    }
  }

  private despachar(socket: SocketConexion, mensaje: MensajeCliente): MensajeServidor | Promise<MensajeServidor> {
    switch (mensaje.type) {
      case "ping": return { type: "pong", t: Date.now() };
      case "registro": return this.ejecutar("registro", socket, mensaje);
      case "login": return this.ejecutar("login", socket, mensaje);
      case "reanudar": return this.ejecutar("reanudar", socket, mensaje);
      case "logout": return this.ejecutar("logout", socket, mensaje);
      case "lobby.listar": return this.ejecutar("lobby.listar", socket, mensaje);
      case "mesa.unirse": return this.ejecutar("mesa.unirse", socket, mensaje);
      case "mesa.salir": return this.ejecutar("mesa.salir", socket, mensaje);
      case "apostar": return this.ejecutar("apostar", socket, mensaje);
      case "pedir": return this.ejecutar("pedir", socket, mensaje);
      case "plantarse": return this.ejecutar("plantarse", socket, mensaje);
      case "billetera.consultar": return this.ejecutar("billetera.consultar", socket, mensaje);
      case "fichas.comprar": return this.ejecutar("fichas.comprar", socket, mensaje);
      case "tienda.catalogo": return this.ejecutar("tienda.catalogo", socket, mensaje);
      case "tienda.comprar": return this.ejecutar("tienda.comprar", socket, mensaje);
      case "inventario.listar": return this.ejecutar("inventario.listar", socket, mensaje);
      case "inventario.equipar": return this.ejecutar("inventario.equipar", socket, mensaje);
      case "movimientos.listar": return this.ejecutar("movimientos.listar", socket, mensaje);
    }
  }

  private ejecutar<Tipo extends TipoManejado>(
    tipo: Tipo, socket: SocketConexion, mensaje: Extract<MensajeCliente, { type: Tipo }>,
  ): MensajeServidor | Promise<MensajeServidor> {
    const intenciones: ManejadoresIntenciones = this.manejadores;
    const manejador = intenciones[tipo];
    // Un servicio pendiente devuelve un error explícito; nunca una confirmación falsa.
    if (!manejador) throw new ErrorJuego("ERROR_INTERNO");
    return manejador(socket, mensaje);
  }

  private enviar(socket: SocketConexion, mensaje: MensajeServidor): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(mensaje));
  }
}
