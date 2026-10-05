/**
 * Guarda el token de sesión para `reanudar` al recargar la página.
 * `localStorage` puede lanzar (modo privado, cuota llena, almacenamiento bloqueado):
 * en ese caso el token vive solo en memoria y la sesión dura lo que dure la pestaña.
 */
import { CLAVE_TOKEN } from "../config";

/** Lugar donde se guarda el token de sesión. */
export interface AlmacenToken {
  /** @returns El token guardado o `null`. */
  leer(): string | null;
  /** @param token - Token a guardar. */
  guardar(token: string): void;
  /** Borra el token guardado. */
  borrar(): void;
}

/**
 * Crea un almacén respaldado por `localStorage`, con memoria como respaldo si falla.
 * @param obtenerStorage - Devuelve el `Storage` a usar; acceder a `window.localStorage` ya puede lanzar.
 * @returns Almacén que nunca lanza.
 */
export function crearAlmacenToken(obtenerStorage: () => Storage = () => window.localStorage): AlmacenToken {
  let enMemoria: string | null = null;
  return {
    leer() {
      try {
        return obtenerStorage().getItem(CLAVE_TOKEN) ?? enMemoria;
      } catch {
        return enMemoria;
      }
    },
    guardar(token) {
      enMemoria = token;
      try {
        obtenerStorage().setItem(CLAVE_TOKEN, token);
      } catch {
        // Sin almacenamiento persistente: basta con la copia en memoria.
      }
    },
    borrar() {
      enMemoria = null;
      try {
        obtenerStorage().removeItem(CLAVE_TOKEN);
      } catch {
        // Nada que borrar si el almacenamiento no está disponible.
      }
    },
  };
}
