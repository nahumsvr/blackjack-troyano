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
  alCerrar?: () => void;
}
export type SocketConexion = ServerWebSocket<DatosConexion>;
type TipoManejado = Exclude<MensajeCliente["type"], "ping">;
/** Cada handler recibe solo su intención validada y devuelve la respuesta directa. */
export type ManejadoresEnrutador = Partial<{
  [Tipo in TipoManejado]: (
    socket: SocketConexion, mensaje: Extract<MensajeCliente, { type: Tipo }>,
  ) => MensajeServidor | Promise<MensajeServidor>;
}>;

/** Enrutador común; los servicios de auth, mesa y economía se conectan por inyección. */
export class Enrutador {
  private readonly pendientes = new WeakMap<SocketConexion, Promise<void>>();
  /**
   * @param manejadores - Intenciones implementadas por las tareas siguientes.
   * @param registrarError - Registra excepciones inesperadas solo en el servidor.
   * @param validarSesion - Comprueba vigencia/revocación antes de ejecutar intenciones protegidas.
   * @returns Enrutador con ping disponible incluso sin servicios instalados.
   */
  constructor(
    private readonly manejadores: ManejadoresEnrutador = {},
    private readonly registrarError: (error: unknown) => void = (error) => console.error("Error interno en Enrutador", error),
    private readonly validarSesion?: (socket: SocketConexion) => Promise<void>,
  ) {}

  /**
   * Valida tamaño, JSON y esquema; conserva reqId y convierte fallos en error público.
   * @param socket - Conexión que originó la intención.
   * @param datos - Frame textual o binario recibido por Bun.
   * @returns Finalización de la respuesta; los errores de dominio no se propagan.
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
      // Un cierre durante la validación SQL no puede crear un asiento huérfano.
      if (socket.readyState !== WebSocket.OPEN) return;
      const respuesta = await this.despachar(socket, mensaje);
      // La correlación pertenece al transporte: un handler no puede heredar reqId de otra petición.
      this.enviar(socket, { ...respuesta, reqId });
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
    const manejador = this.manejadores[tipo];
    // Un servicio pendiente devuelve un error explícito; nunca una confirmación falsa.
    if (!manejador) throw new ErrorJuego("ERROR_INTERNO");
    return manejador(socket, mensaje);
  }

  private enviar(socket: SocketConexion, mensaje: MensajeServidor): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(mensaje));
  }
}
