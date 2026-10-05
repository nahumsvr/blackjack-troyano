/**
 * Sincronización con el reloj del servidor. Los relojes (`finEn`) son del servidor;
 * si cada laptop usara su propia hora, la cuenta regresiva diferiría entre pantallas.
 * Se estima el desfase con un `ping`/`pong` (algoritmo de Cristian) y se aplica al dibujar.
 */

/**
 * Estima cuánto va adelantado el reloj del servidor respecto al local.
 * Supone que la ida y la vuelta tardan lo mismo, así que el servidor respondió a la mitad del viaje.
 * @param enviadoEn - `Date.now()` local al enviar el `ping`.
 * @param recibidoEn - `Date.now()` local al recibir el `pong`.
 * @param horaServidor - Campo `t` del `pong` (epoch ms del servidor).
 * @returns Desfase en ms (positivo si el servidor va adelantado).
 */
export function calcularDesfase(enviadoEn: number, recibidoEn: number, horaServidor: number): number {
  return Math.round(horaServidor - (enviadoEn + recibidoEn) / 2);
}

/**
 * Milisegundos que faltan para que venza un reloj del servidor, vistos desde este cliente.
 * @param finEn - Epoch ms del servidor en que vence la fase o el turno; `null` si no hay reloj.
 * @param ahoraLocal - `Date.now()` local.
 * @param desfase - Resultado de `calcularDesfase`.
 * @returns Ms restantes (nunca negativos) o `null` si no hay reloj.
 */
export function msRestantes(finEn: number | null, ahoraLocal: number, desfase: number): number | null {
  if (finEn === null) return null;
  return Math.max(0, finEn - (ahoraLocal + desfase));
}
