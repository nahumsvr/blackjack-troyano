/** Dealer del servidor; comparte Mano y se planta en todo diecisiete. */
import { DEALER_PLANTARSE_EN } from "../config";
import type { Baraja } from "./Baraja";
import { Mano } from "./Mano";

/** Ejecuta la regla fija del dealer sin decidir resultados ni mover saldos. */
export class Dealer {
  /** @param mano - Mano inicial, vacía por defecto. @returns Dealer con mano propia. */
  constructor(readonly mano = new Mano()) {}

  /** @returns true con dieciséis o menos; false también con diecisiete blando. */
  debePedir(): boolean { return this.mano.total() < DEALER_PLANTARSE_EN; }

  /**
   * @param baraja - Suministro de cartas del servidor, sustituible por un zapato fijo en tests.
   * @returns Completa la mano hasta alcanzar el umbral de plantarse.
   * @throws ErrorJuego ERROR_INTERNO si el zapato se agota.
   */
  jugar(baraja: Pick<Baraja, "sacar">): void {
    while (this.debePedir()) this.mano.agregar(baraja.sacar());
  }
}
