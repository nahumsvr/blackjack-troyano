/**
 * Interfaz común del transporte del cliente. La implementa `Conexion` (WebSocket real)
 * y la implementará el servidor falso del mock (T-12), para que el resto de la app
 * no sepa con cuál habla.
 */
import type { EntradaMensajeCliente, MensajeServidor } from "@blackjack/shared";

/** Estado de la conexión con el servidor. */
export type EstadoConexion = "conectando" | "conectado" | "reconectando" | "cerrado";

/**
 * Intención del cliente sin `reqId`: el transporte lo asigna.
 * El condicional distribuye `Omit` sobre cada miembro de la unión para no perder el discriminante.
 */
export type Intencion = EntradaMensajeCliente extends infer M ? (M extends unknown ? Omit<M, "reqId"> : never) : never;

/** Valor de `type` de una intención (`apostar`, `pedir`…). */
export type TipoIntencion = Intencion["type"];

/** Evento que el transporte notifica a sus oyentes. */
export type EventoTransporte =
  | { tipo: "conexion"; estado: EstadoConexion }
  | { tipo: "mensaje"; mensaje: MensajeServidor };

/** Función que recibe los eventos del transporte. */
export type OyenteTransporte = (evento: EventoTransporte) => void;

/** Canal bidireccional con el servidor. */
export interface Transporte {
  /** Abre la conexión (o la reabre tras `cerrar`). Idempotente si ya está abierta o abriéndose. */
  conectar(): void;
  /** Cierra la conexión sin reintentar y rechaza las peticiones pendientes. */
  cerrar(): void;
  /**
   * Envía una intención y espera su respuesta directa (la que repite el `reqId`).
   * @param intencion - Mensaje del cliente sin `reqId`.
   * @returns La respuesta del servidor (cualquier tipo distinto de `error`).
   * @throws ErrorPeticion SIN_CONEXION | SIN_RESPUESTA | MENSAJE_CLIENTE_INVALIDO | código del servidor.
   */
  enviar(intencion: Intencion): Promise<MensajeServidor>;
  /**
   * Registra un oyente de eventos.
   * @param oyente - Función a llamar con cada evento.
   * @returns Función que cancela la suscripción.
   */
  suscribir(oyente: OyenteTransporte): () => void;
}
