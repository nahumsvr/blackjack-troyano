/** Resolución pura de una apuesta; calcula el pago total sin acceder a SQL ni a la mesa. */
import { CantidadApuestaSchema, ErrorJuego, type Resultado } from "@blackjack/shared";
import { PAGO_BLACKJACK_NUMERADOR, PAGO_BLACKJACK_DENOMINADOR, PAGO_GANADOR, FACTOR_DOBLAR } from "../config";
import { Mano } from "./Mano";

/**
 * Resuelve una mano y devuelve la apuesta incluida en el pago; el débito ocurrió antes.
 * @param mano - Mano final del jugador.
 * @param manoDealer - Mano final revelada del dealer.
 * @param apuesta - Apuesta válida del contrato (múltiplo de diez para un pago 3:2 entero).
 * @param doblada - Confirma una apuesta duplicada con exactamente tres cartas.
 * @returns Resultado de dominio y pago entero total: natural 2.5x, victoria 2x, empate 1x.
 * @throws ErrorJuego CANTIDAD_INVALIDA si la apuesta no cumple el contrato.
 */
export function resolver(mano: Mano, manoDealer: Mano, apuesta: number, doblada = false): { resultado: Resultado; pago: number } {
  const inicial = doblada ? apuesta / FACTOR_DOBLAR : apuesta;
  if (!CantidadApuestaSchema.safeParse(inicial).success || (doblada && mano.cartas.length !== 3)) {
    throw new ErrorJuego("CANTIDAD_INVALIDA");
  }
  // El jugador pasado ya perdió: que el dealer también se pase no revierte la pérdida.
  if (mano.estaPasada()) return { resultado: "pasado", pago: 0 };
  if (manoDealer.esBlackjack()) {
    return mano.esBlackjack() ? { resultado: "empate", pago: apuesta } : { resultado: "pierde", pago: 0 };
  }
  // Un 21 de tres o más cartas no tiene prioridad sobre un natural.
  if (mano.esBlackjack()) {
    return { resultado: "blackjack", pago: apuesta * PAGO_BLACKJACK_NUMERADOR / PAGO_BLACKJACK_DENOMINADOR };
  }
  if (manoDealer.estaPasada() || mano.total() > manoDealer.total()) return { resultado: "gana", pago: apuesta * PAGO_GANADOR };
  if (mano.total() === manoDealer.total()) return { resultado: "empate", pago: apuesta };
  return { resultado: "pierde", pago: 0 };
}
