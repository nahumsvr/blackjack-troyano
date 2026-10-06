/**
 * Errores que se originan en el propio cliente (sin conexión, sin respuesta, mensaje mal armado)
 * y la clase `ErrorPeticion`, con la que se rechaza cualquier petición fallida,
 * venga el código del servidor (`@blackjack/shared`) o de aquí.
 */
import type { CodigoError } from "@blackjack/shared";

/** Mensaje en español de cada error local. */
export const MENSAJES_ERROR_LOCAL = {
  SIN_CONEXION: "Sin conexión con el servidor; reintentando…",
  SIN_RESPUESTA: "El servidor no respondió a tiempo; intenta de nuevo.",
  MENSAJE_CLIENTE_INVALIDO: "No se pudo enviar la acción porque sus datos no son válidos.",
} as const;

/** Código de un error generado en el cliente. */
export type CodigoErrorLocal = keyof typeof MENSAJES_ERROR_LOCAL;

/** Código de cualquier error que puede rechazar una petición. */
export type CodigoErrorPeticion = CodigoError | CodigoErrorLocal;

/** Error con el que se rechaza una petición; `message` siempre es texto apto para mostrar. */
export class ErrorPeticion extends Error {
  readonly codigo: CodigoErrorPeticion;

  /**
   * Crea el error de una petición fallida.
   * @param codigo - Código del servidor o local.
   * @param mensaje - Texto para el usuario (el `mensaje` del servidor o uno de `MENSAJES_ERROR_LOCAL`).
   */
  constructor(codigo: CodigoErrorPeticion, mensaje: string) {
    super(mensaje);
    this.name = "ErrorPeticion";
    this.codigo = codigo;
  }
}

/**
 * Crea un `ErrorPeticion` para un error generado en el cliente.
 * @param codigo - Código local.
 * @returns Error con el mensaje en español correspondiente.
 */
export function errorLocal(codigo: CodigoErrorLocal): ErrorPeticion {
  return new ErrorPeticion(codigo, MENSAJES_ERROR_LOCAL[codigo]);
}
