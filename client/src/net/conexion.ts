/**
 * Implementación real del `Transporte` sobre WebSocket nativo del navegador.
 *
 * Responsabilidades (y nada más): abrir y reabrir el socket con espera creciente,
 * validar con Zod todo lo que entra y sale, correlacionar respuestas por `reqId`
 * con un tiempo límite, y avisar a los oyentes. La lógica de sesión (reanudar, token)
 * vive en `state/controlador.ts`.
 *
 * Decisiones:
 * - Sin conexión NO se encola nada: una apuesta guardada y enviada al reconectar
 *   llegaría en otra fase o en otra ronda. Se rechaza con `SIN_CONEXION` y el usuario reintenta.
 * - Al cerrarse el socket se rechazan todas las peticiones pendientes: su respuesta ya no llegará.
 */
import { MensajeClienteSchema, MensajeServidorSchema, type MensajeServidor } from "@blackjack/shared";
import { RECONEXION_MS, TIMEOUT_PETICION_MS } from "../config";
import { ErrorPeticion, errorLocal } from "./erroresLocales";
import type { EstadoConexion, EventoTransporte, Intencion, OyenteTransporte, Transporte } from "./transporte";

/** Subconjunto de la API de `WebSocket` que usa la conexión (permite un socket falso en pruebas). */
export interface SocketMinimo {
  readonly readyState: number;
  onopen: ((evento: Event) => void) | null;
  onclose: ((evento: CloseEvent) => void) | null;
  onerror: ((evento: Event) => void) | null;
  onmessage: ((evento: MessageEvent) => void) | null;
  send(datos: string): void;
  close(): void;
}

/** Valor de `readyState` cuando el socket está abierto (igual que `WebSocket.OPEN`). */
const SOCKET_ABIERTO = 1;

/** Dependencias inyectables de la conexión; todas tienen un valor por defecto del navegador. */
export interface OpcionesConexion {
  /** URL del WebSocket (ver `urlWebSocket` en config). */
  url: string;
  /** Crea el socket; por defecto `new WebSocket(url)`. */
  crearSocket?: (url: string) => SocketMinimo;
  /** Programa una función; por defecto `setTimeout`. */
  programar?: (funcion: () => void, ms: number) => unknown;
  /** Cancela lo programado; por defecto `clearTimeout`. */
  cancelar?: (temporizador: unknown) => void;
  /** Genera el `reqId`; por defecto `crypto.randomUUID`. */
  generarId?: () => string;
  /** Espera máxima por respuesta, en ms. */
  timeoutMs?: number;
  /** Esperas entre reintentos de reconexión, en ms. */
  esperas?: readonly number[];
}

/** Petición enviada que espera su respuesta. */
interface Pendiente {
  resolver: (mensaje: MensajeServidor) => void;
  rechazar: (error: ErrorPeticion) => void;
  temporizador: unknown;
}

/**
 * Calcula la espera antes del siguiente intento de reconexión: 1 s, 2 s, 4 s, 8 s y luego 10 s siempre.
 * @param intento - Número de intento fallido consecutivo, empezando en 0.
 * @param esperas - Tabla de esperas; el último valor se repite.
 * @returns Milisegundos a esperar.
 */
export function retrasoReconexion(intento: number, esperas: readonly number[] = RECONEXION_MS): number {
  const indice = Math.min(Math.max(0, Math.floor(intento)), esperas.length - 1);
  return esperas[indice] ?? 0;
}

/** Transporte WebSocket con reconexión automática y validación en ambos sentidos. */
export class Conexion implements Transporte {
  private readonly url: string;
  private readonly crearSocket: (url: string) => SocketMinimo;
  private readonly programar: (funcion: () => void, ms: number) => unknown;
  private readonly cancelar: (temporizador: unknown) => void;
  private readonly generarId: () => string;
  private readonly timeoutMs: number;
  private readonly esperas: readonly number[];

  private socket: SocketMinimo | null = null;
  private estado: EstadoConexion = "cerrado";
  private intento = 0;
  private temporizadorReconexion: unknown = null;
  /** `true` mientras el usuario de la clase quiere estar conectado (entre `conectar` y `cerrar`). */
  private activa = false;
  private readonly pendientes = new Map<string, Pendiente>();
  private readonly oyentes = new Set<OyenteTransporte>();

  /**
   * @param opciones - URL y dependencias inyectables (ver `OpcionesConexion`).
   */
  constructor(opciones: OpcionesConexion) {
    this.url = opciones.url;
    this.crearSocket = opciones.crearSocket ?? ((url) => new WebSocket(url));
    this.programar = opciones.programar ?? ((funcion, ms) => setTimeout(funcion, ms));
    this.cancelar = opciones.cancelar ?? ((temporizador) => clearTimeout(temporizador as ReturnType<typeof setTimeout>));
    this.generarId = opciones.generarId ?? (() => crypto.randomUUID());
    this.timeoutMs = opciones.timeoutMs ?? TIMEOUT_PETICION_MS;
    this.esperas = opciones.esperas ?? RECONEXION_MS;
  }

  /** Estado actual de la conexión. */
  get estadoActual(): EstadoConexion {
    return this.estado;
  }

  /** Abre la conexión. No hace nada si ya está abierta o abriéndose. */
  conectar(): void {
    if (this.activa) return;
    this.activa = true;
    this.intento = 0;
    this.abrirSocket("conectando");
  }

  /** Cierra la conexión, cancela la reconexión y rechaza las peticiones pendientes con `SIN_CONEXION`. */
  cerrar(): void {
    this.activa = false;
    if (this.temporizadorReconexion !== null) this.cancelar(this.temporizadorReconexion);
    this.temporizadorReconexion = null;
    const socket = this.socket;
    this.socket = null;
    if (socket !== null) {
      this.desligar(socket);
      try {
        socket.close();
      } catch {
        // Cerrar un socket que ya falló puede lanzar; no hay nada más que hacer.
      }
    }
    this.rechazarPendientes();
    this.cambiarEstado("cerrado");
  }

  /**
   * Valida y envía una intención; resuelve con la respuesta que repite su `reqId`.
   * @param intencion - Mensaje del cliente sin `reqId`.
   * @returns Respuesta directa del servidor.
   * @throws ErrorPeticion MENSAJE_CLIENTE_INVALIDO | SIN_CONEXION | SIN_RESPUESTA | código del servidor.
   */
  enviar(intencion: Intencion): Promise<MensajeServidor> {
    const reqId = this.generarId();
    const validado = MensajeClienteSchema.safeParse({ ...intencion, reqId });
    if (!validado.success) {
      // Es un error de programación del cliente (la UI valida antes); nunca se manda al servidor.
      console.warn("Intención inválida, no se envía:", intencion, validado.error.issues);
      return Promise.reject(errorLocal("MENSAJE_CLIENTE_INVALIDO"));
    }
    const socket = this.socket;
    if (socket === null || socket.readyState !== SOCKET_ABIERTO) return Promise.reject(errorLocal("SIN_CONEXION"));
    return new Promise<MensajeServidor>((resolver, rechazar) => {
      try {
        socket.send(JSON.stringify(validado.data));
      } catch {
        rechazar(errorLocal("SIN_CONEXION"));
        return;
      }
      const temporizador = this.programar(() => {
        if (this.pendientes.delete(reqId)) rechazar(errorLocal("SIN_RESPUESTA"));
      }, this.timeoutMs);
      this.pendientes.set(reqId, { resolver, rechazar, temporizador });
    });
  }

  /**
   * Registra un oyente de eventos de conexión y mensajes.
   * @param oyente - Función a notificar.
   * @returns Función que cancela la suscripción.
   */
  suscribir(oyente: OyenteTransporte): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  /**
   * Crea un socket nuevo y le conecta los manejadores.
   * @param estadoInicial - `conectando` la primera vez, `reconectando` en reintentos.
   */
  private abrirSocket(estadoInicial: EstadoConexion): void {
    this.temporizadorReconexion = null;
    this.cambiarEstado(estadoInicial);
    let socket: SocketMinimo;
    try {
      socket = this.crearSocket(this.url);
    } catch (error) {
      // URL inválida o navegador sin WebSocket: se trata como un cierre y se reintenta.
      console.warn("No se pudo crear el WebSocket:", error);
      this.programarReconexion();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.intento = 0;
      this.cambiarEstado("conectado");
    };
    socket.onmessage = (evento) => this.recibir(evento.data);
    // `onerror` siempre va seguido de `onclose`; la reconexión se decide solo allí.
    socket.onerror = () => {};
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.rechazarPendientes();
      if (this.activa) this.programarReconexion();
    };
  }

  /** Programa el siguiente intento de reconexión con espera creciente. */
  private programarReconexion(): void {
    this.cambiarEstado("reconectando");
    const espera = retrasoReconexion(this.intento, this.esperas);
    this.intento += 1;
    this.temporizadorReconexion = this.programar(() => {
      if (this.activa) this.abrirSocket("reconectando");
    }, espera);
  }

  /**
   * Procesa un frame recibido: JSON → Zod → resolver la petición pendiente → notificar.
   * Nunca lanza: un mensaje roto se registra y se ignora.
   * @param datos - Contenido del frame.
   */
  private recibir(datos: unknown): void {
    if (typeof datos !== "string") {
      console.warn("Frame no textual ignorado");
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(datos);
    } catch {
      console.warn("Mensaje del servidor que no es JSON, ignorado:", datos.slice(0, 200));
      return;
    }
    const validado = MensajeServidorSchema.safeParse(json);
    if (!validado.success) {
      console.warn("Mensaje del servidor fuera de contrato, ignorado:", json, validado.error.issues);
      return;
    }
    const mensaje = validado.data;
    if (mensaje.reqId !== undefined) this.resolverPendiente(mensaje.reqId, mensaje);
    this.emitir({ tipo: "mensaje", mensaje });
  }

  /**
   * Resuelve o rechaza la petición que corresponde a un `reqId`.
   * @param reqId - Identificador repetido por el servidor.
   * @param mensaje - Respuesta recibida.
   */
  private resolverPendiente(reqId: string, mensaje: MensajeServidor): void {
    const pendiente = this.pendientes.get(reqId);
    if (pendiente === undefined) return; // Llegó tarde (ya venció) o es de otra pestaña: se ignora.
    this.pendientes.delete(reqId);
    this.cancelar(pendiente.temporizador);
    if (mensaje.type === "error") pendiente.rechazar(new ErrorPeticion(mensaje.codigo, mensaje.mensaje));
    else pendiente.resolver(mensaje);
  }

  /** Rechaza todas las peticiones pendientes con `SIN_CONEXION`. */
  private rechazarPendientes(): void {
    for (const pendiente of this.pendientes.values()) {
      this.cancelar(pendiente.temporizador);
      pendiente.rechazar(errorLocal("SIN_CONEXION"));
    }
    this.pendientes.clear();
  }

  /**
   * Quita los manejadores de un socket para que sus eventos tardíos no afecten a la conexión.
   * @param socket - Socket a desligar.
   */
  private desligar(socket: SocketMinimo): void {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
  }

  /**
   * Cambia el estado y lo notifica solo si es distinto del actual.
   * @param estado - Nuevo estado.
   */
  private cambiarEstado(estado: EstadoConexion): void {
    if (this.estado === estado) return;
    this.estado = estado;
    this.emitir({ tipo: "conexion", estado });
  }

  /**
   * Notifica a todos los oyentes. Un oyente que lanza no impide notificar a los demás
   * ni rompe el manejador del socket.
   * @param evento - Evento a notificar.
   */
  private emitir(evento: EventoTransporte): void {
    for (const oyente of this.oyentes) {
      try {
        oyente(evento);
      } catch (error) {
        console.error("Error en un oyente del transporte:", error);
      }
    }
  }
}
