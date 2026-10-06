/** Carta del motor; convierte a la vista del contrato sin exponer detalles del zapato. */
import type { CartaVisible } from "@blackjack/shared";

/** Carta inmutable; cada mazo contiene su propia instancia de cada palo y rango. */
export class Carta {
  /**
   * @param palo - Palo definido en el contrato compartido.
   * @param rango - Rango definido en el contrato compartido.
   * @returns Carta cuyo valor del As se ajustará en Mano.
   */
  constructor(readonly palo: CartaVisible["palo"], readonly rango: CartaVisible["rango"]) {
    Object.freeze(this);
  }

  /** @returns Valor mínimo: As vale uno y las figuras diez. */
  valorBase(): number {
    if (this.rango === "A") return 1;
    if (this.rango === "J" || this.rango === "Q" || this.rango === "K") return 10;
    return Number(this.rango);
  }

  /** @returns Objeto independiente con solo los campos públicos del contrato. */
  aVista(): CartaVisible {
    return { palo: this.palo, rango: this.rango };
  }
}
