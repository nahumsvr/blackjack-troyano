/** Limita la admisión, valida el contrato y aísla errores por conexión sin depender de SQL. */
import {
  crearErrorValidacion, extraerReqId, ErrorJuego, MENSAJES_ERROR, MensajeClienteSchema,
  type Equipado, type MensajeCliente, type MensajeServidor, type UsuarioVista,
} from "@blackjack/shared";
import type { ServerWebSocket } from "bun";
import { MENSAJE_MAX_BYTES, MENSAJES_POR_SEGUNDO, VENTANA_MENSAJES_MS, MENSAJES_PENDIENTES_MAX,
  RECHAZOS_CONSECUTIVOS_MAX, CONEXION_SIN_PROGRESO_MS, ACCESOS_POR_SEGUNDO, ACCESOS_SIMULTANEOS_MAX } from "../config";

/** Sesión asociada por los handlers de autenticación, nunca por entrada del cliente. */
export interface DatosConexion {
  conexionId?: string;
  mesaId?: string;
  usuarioId?: number;
  token?: string;
  usuario?: UsuarioVista;
  equipado?: Equipado;
}
export type SocketConexion = ServerWebSocket<DatosConexion>;
/** Contexto de diagnóstico del servidor; no registra frames, contraseñas ni tokens. */
export interface ContextoErrorEnrutador {
  conexionId?: string;
  usuarioId?: number;
  mesaId?: string;
  tipo?: MensajeCliente["type"];
  reqId?: string;
}
type TraficoConexion = { llegadas: number[]; pendientes: number; rechazos: number; bloqueada: boolean; vigilancia?: ReturnType<typeof setTimeout> };
/** Temporizadores sustituibles para probar una conexión colgada sin esperar tiempo real. */
export interface VigilanciaEnrutador {
  /**
   * Programa el cierre por falta de progreso.
   * @param accion - Cierre del transporte, sin cancelar el handler en curso.
   * @param demora - Plazo configurado en milisegundos.
   * @returns Identificador cancelable del timeout.
   */
  programar(accion: () => void, demora: number): ReturnType<typeof setTimeout>;
  /**
   * Retira el plazo de una conexión que completó trabajo o cerró.
   * @param id - Identificador devuelto por programar.
   * @returns Sin valor.
   */
  cancelar(id: ReturnType<typeof setTimeout>): void;
}
type TipoManejado = Exclude<MensajeCliente["type"], "ping">;
/** Cada handler recibe solo su intención validada y devuelve la respuesta directa. */
type ManejadoresIntenciones = Partial<{
  [Tipo in TipoManejado]: (
    socket: SocketConexion, mensaje: Extract<MensajeCliente, { type: Tipo }>,
  ) => MensajeServidor | Promise<MensajeServidor>;
}>;
export type ManejadoresEnrutador = ManejadoresIntenciones & {
  /** Mantiene una exclusión compartida hasta enviar la respuesta directa. */
  serializar?: (socket: SocketConexion, mensaje: MensajeCliente, responder: () => Promise<void>) => Promise<void>;
};

/** Enrutador común; los servicios de auth, mesa y economía se conectan por inyección. */
export class Enrutador {
  private readonly pendientes = new WeakMap<SocketConexion, Promise<void>>();
  private readonly trafico = new WeakMap<SocketConexion, TraficoConexion>();
  private readonly accesos: number[] = [];
  private accesosActivos = 0;
  /**
   * Crea el punto común de admisión, validación y despacho por conexión.
   * @param manejadores - Intenciones implementadas por las tareas siguientes.
   * @param registrarError - Registra excepciones inesperadas y su contexto solo en el servidor.
   * @param validarSesion - Comprueba vigencia/revocación antes de ejecutar intenciones protegidas.
   * @param limpiarConexion - Libera recursos de la conexión al cerrar el transporte.
   * @param ahora - Reloj monótono del servidor; inyectable para probar fronteras sin esperas.
   * @param vigilancia - Timeout sustituible para verificar falta de progreso.
   * @returns Enrutador con ping disponible incluso sin servicios instalados.
   */
  constructor(
    private readonly manejadores: ManejadoresEnrutador = {},
    private readonly registrarError: (error: unknown, contexto: ContextoErrorEnrutador) => void = (error, contexto) => console.error("Error interno en Enrutador", contexto, error),
    private readonly validarSesion?: (socket: SocketConexion) => Promise<void>,
    private readonly limpiarConexion?: (socket: SocketConexion) => void,
    private readonly ahora: () => number = () => performance.now(),
    private readonly vigilancia: VigilanciaEnrutador = { programar: (accion, demora) => setTimeout(accion, demora).unref(), cancelar: clearTimeout },
  ) {}

  /**
   * Libera los recursos inyectados sin guardar closures en los datos de cada socket.
   * @param socket - Conexión cerrada; su identidad sigue disponible para el callback.
   * @returns Nada.
   */
  cerrar(socket: SocketConexion): void {
    const trafico = this.trafico.get(socket);
    if (trafico?.vigilancia !== undefined) this.vigilancia.cancelar(trafico.vigilancia);
    this.trafico.delete(socket);
    this.limpiarConexion?.(socket);
  }

  /**
   * Admite antes de encolar; valida tamaño/JSON/Zod y convierte fallos en error público.
   * @param socket - Conexión que originó la intención.
   * @param datos - Frame textual o binario recibido por Bun.
   * @returns Finalización de la respuesta; los errores de dominio no se propagan.
   */
  manejar(socket: SocketConexion, datos: string | Buffer): Promise<void> {
    let trafico: TraficoConexion;
    try {
      if (socket.readyState !== WebSocket.OPEN) return Promise.resolve();
      if (this.trafico.get(socket)?.bloqueada) return Promise.resolve();
      trafico = this.admitir(socket);
    } catch (error) {
      this.responderError(socket, error, this.contexto(socket, undefined, this.extraerReqId(datos)));
      const trafico = this.trafico.get(socket);
      if (trafico && ++trafico.rechazos >= RECHAZOS_CONSECUTIVOS_MAX) this.cerrarConexion(socket, trafico, "Demasiadas solicitudes");
      return Promise.resolve();
    }
    // Auth y logout de un mismo socket conservan el orden aunque hagan consultas async.
    const anterior = this.pendientes.get(socket) ?? Promise.resolve();
    const actual = anterior.catch(() => {}).then(() => this.procesar(socket, datos));
    this.pendientes.set(socket, actual);
    const limpiar = () => {
      trafico.pendientes--;
      if (this.trafico.get(socket) === trafico && !trafico.bloqueada) this.vigilar(socket, trafico);
      if (this.pendientes.get(socket) === actual) this.pendientes.delete(socket);
    };
    void actual.then(limpiar, limpiar);
    return actual;
  }

  private async procesar(socket: SocketConexion, datos: string | Buffer): Promise<void> {
    if (socket.readyState !== WebSocket.OPEN || this.trafico.get(socket)?.bloqueada) return;
    let reqId: string | undefined;
    let tipo: MensajeCliente["type"] | undefined;
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
      tipo = mensaje.type;
      const esAcceso = mensaje.type === "registro" || mensaje.type === "login" || mensaje.type === "reanudar";
      if (esAcceso && socket.data.usuarioId !== undefined) throw new ErrorJuego("YA_AUTENTICADO");
      if (!esAcceso && mensaje.type !== "ping" && socket.data.usuarioId === undefined) {
        throw new ErrorJuego("NO_AUTENTICADO");
      }
      if (!esAcceso && mensaje.type !== "ping") await this.validarSesion?.(socket);
      if (socket.readyState !== WebSocket.OPEN || this.trafico.get(socket)?.bloqueada) return;
      const responder = async () => {
        const costoso = mensaje.type === "registro" || mensaje.type === "login";
        if (costoso) this.admitirAcceso();
        let respuesta: MensajeServidor;
        try { respuesta = await this.despachar(socket, mensaje); }
        finally { if (costoso) this.accesosActivos--; }
        // La correlación pertenece al transporte; la exclusión termina después del envío.
        this.enviar(socket, { ...respuesta, reqId });
      };
      if (this.manejadores.serializar) await this.manejadores.serializar(socket, mensaje, responder);
      else await responder();
    } catch (error) {
      this.responderError(socket, error, this.contexto(socket, tipo, reqId));
    }
  }

  private admitir(socket: SocketConexion): TraficoConexion {
    const ahora = this.ahora();
    const trafico = this.trafico.get(socket) ?? { llegadas: [], pendientes: 0, rechazos: 0, bloqueada: false };
    while (trafico.llegadas.length && ahora - trafico.llegadas[0]! >= VENTANA_MENSAJES_MS) trafico.llegadas.shift();
    this.trafico.set(socket, trafico);
    // Contar al llegar impide que una consulta SQL lenta difiera el control de ritmo.
    // Solo conservamos timestamps admitidos; los rechazos no generan trabajo en la cola.
    if (trafico.llegadas.length >= MENSAJES_POR_SEGUNDO || trafico.pendientes >= MENSAJES_PENDIENTES_MAX) {
      throw new ErrorJuego("DEMASIADAS_SOLICITUDES");
    }
    trafico.llegadas.push(ahora);
    trafico.rechazos = 0;
    trafico.pendientes++;
    if (trafico.pendientes === 1) this.vigilar(socket, trafico);
    return trafico;
  }

  private admitirAcceso(): void {
    const ahora = this.ahora();
    while (this.accesos.length && ahora - this.accesos[0]! >= VENTANA_MENSAJES_MS) this.accesos.shift();
    if (this.accesos.length >= ACCESOS_POR_SEGUNDO || this.accesosActivos >= ACCESOS_SIMULTANEOS_MAX) {
      throw new ErrorJuego("DEMASIADAS_SOLICITUDES");
    }
    this.accesos.push(ahora);
    this.accesosActivos++;
  }

  private vigilar(socket: SocketConexion, trafico: TraficoConexion): void {
    if (trafico.vigilancia !== undefined) this.vigilancia.cancelar(trafico.vigilancia);
    trafico.vigilancia = undefined;
    if (trafico.pendientes > 0) trafico.vigilancia = this.vigilancia.programar(() => {
      this.registrarFallo(new Error("Conexión sin progreso"), this.contexto(socket));
      this.cerrarConexion(socket, trafico, "Conexion sin progreso");
    }, CONEXION_SIN_PROGRESO_MS);
  }

  private cerrarConexion(socket: SocketConexion, trafico: TraficoConexion, motivo: string): void {
    trafico.bloqueada = true;
    if (trafico.vigilancia !== undefined) this.vigilancia.cancelar(trafico.vigilancia);
    trafico.vigilancia = undefined;
    // Bloquear antes de cerrar impide procesar más frames mientras Bun vacía el buffer.
    // Diferir el cierre permite enviar el último error fuera del callback de recepción.
    trafico.vigilancia = setTimeout(() => {
      trafico.vigilancia = undefined;
      try { socket.close(1008, motivo); }
      catch (error) { this.registrarFallo(error, this.contexto(socket)); }
    }, 0);
  }

  private extraerReqId(datos: string | Buffer): string | undefined {
    if (typeof datos !== "string" || Buffer.byteLength(datos, "utf8") > MENSAJE_MAX_BYTES) return;
    try {
      const entrada: unknown = JSON.parse(datos);
      return extraerReqId(entrada);
    } catch { /* Un frame malformado saturado responde sin correlación inventada. */ }
  }

  private contexto(socket: SocketConexion, tipo?: MensajeCliente["type"], reqId?: string): ContextoErrorEnrutador {
    const { conexionId, usuarioId, mesaId } = socket.data;
    return { conexionId, usuarioId, mesaId, tipo, reqId };
  }

  private registrarFallo(error: unknown, contexto: ContextoErrorEnrutador): void {
    try { this.registrarError(error, contexto); }
    catch { /* El fallo del destino de logs no puede impedir la respuesta ni tumbar el transporte. */ }
  }

  private responderError(socket: SocketConexion, error: unknown, contexto: ContextoErrorEnrutador): void {
    const codigo = error instanceof ErrorJuego ? error.codigo : "ERROR_INTERNO";
    if (!(error instanceof ErrorJuego)) this.registrarFallo(error, contexto);
    try { this.enviar(socket, { type: "error", codigo, mensaje: MENSAJES_ERROR[codigo], reqId: contexto.reqId }); }
    catch (errorEnvio) { this.registrarFallo(errorEnvio, contexto); }
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
      case "doblar": return this.ejecutar("doblar", socket, mensaje);
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
