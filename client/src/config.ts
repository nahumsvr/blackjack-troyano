/**
 * Valores configurables propios del cliente (tiempos de red y dirección del WebSocket).
 * Los límites del juego y la economía NO viven aquí: vienen de `@blackjack/shared`
 * o de los mensajes del servidor, que es la única fuente de verdad.
 */

/** Esperas entre reintentos de reconexión, en ms; el último se repite indefinidamente. */
export const RECONEXION_MS: readonly number[] = [1000, 2000, 4000, 8000, 10000];

/** Tiempo máximo que una petición con `reqId` espera respuesta antes de fallar con `SIN_RESPUESTA`. */
export const TIMEOUT_PETICION_MS = 8000;

/** Clave de `localStorage` donde se guarda el token de sesión para `reanudar`. */
export const CLAVE_TOKEN = "blackjack.token";

/**
 * Construye la URL del WebSocket a partir del host que sirvió la página.
 * Funciona en desarrollo (proxy de Vite) y en producción (Bun sirve el build) sin cambios.
 * @param ubicacion - `window.location` o un objeto equivalente (inyectable en pruebas).
 * @returns URL `ws://` o `wss://` apuntando a `/ws` del mismo host.
 */
export function urlWebSocket(ubicacion: Pick<Location, "protocol" | "host">): string {
  const esquema = ubicacion.protocol === "https:" ? "wss" : "ws";
  return `${esquema}://${ubicacion.host}/ws`;
}
