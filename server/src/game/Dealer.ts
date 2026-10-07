/** Dealer del servidor; comparte Mano y se planta en todo diecisiete. */
import { DEALER_PLANTARSE_EN } from "../config";
import type { Baraja } from "./Baraja";
import { Mano } from "./Mano";

/** Ejecuta la regla fija del dealer sin decidir resultados ni mover saldos. */
export class Dealer {
  /**
   * Crea un dealer que conserva la mano recibida; por defecto crea una mano vacía.
   * @param mano - Mano inicial compartida con el llamador si se proporciona.
   * @returns Dealer sin decisiones de pago ni acceso a la billetera.
   */
  constructor(readonly mano = new Mano()) {}

  /**
   * Consulta si el total del dealer está por debajo del umbral de plantarse.
   * @returns true con dieciséis o menos; false también con diecisiete blando.
   */
  debePedir(): boolean { return this.mano.total() < DEALER_PLANTARSE_EN; }

  /**
   * Completa la mano del dealer aplicando la regla de plantarse configurada.
   * @param baraja - Suministro de cartas del servidor, sustituible por un zapato fijo en tests.
   * @returns Sin valor; conserva las cartas añadidas en su mano.
   * @throws ErrorJuego ERROR_INTERNO si el zapato se agota.
   */
  jugar(baraja: Pick<Baraja, "sacar">): void {
    while (this.debePedir()) this.mano.agregar(baraja.sacar());
  }
}
