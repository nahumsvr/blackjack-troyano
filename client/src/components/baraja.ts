/**
 * Las 52 cartas de una baraja francesa, generadas desde el contrato de `shared`
 * (`CartaVisibleSchema`) para no repetir aquí los palos ni los rangos. Solo las usa el
 * muestrario de cartas del modo mock: en la mesa las cartas siempre vienen del servidor.
 */
import { CartaVisibleSchema, type CartaVisible } from "@blackjack/shared";

/**
 * Baraja completa, ordenada por palo y, dentro de cada palo, por rango (A, 2…10, J, Q, K).
 * @returns 52 cartas visibles distintas.
 */
export function baraja52(): CartaVisible[] {
  const { palo, rango } = CartaVisibleSchema.shape;
  return palo.options.flatMap((unPalo) => rango.options.map((unRango) => ({ palo: unPalo, rango: unRango })));
}
