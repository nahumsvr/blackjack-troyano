/** Zapato de varios mazos; el motor rebaraja únicamente entre rondas. */
import { ErrorJuego, type CartaVisible } from "@blackjack/shared";
import { NUM_MAZOS, UMBRAL_REBARAJAR } from "../config";
import { Carta } from "./Carta";

const PALOS = ["♠", "♥", "♦", "♣"] as const satisfies readonly CartaVisible["palo"][];
const RANGOS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const satisfies readonly CartaVisible["rango"][];

function indiceSeguro(limite: number): number {
  const espacio = 2 ** 32;
  const techo = espacio - espacio % limite;
  const muestra = new Uint32Array(1);
  // Rechazar la franja sobrante evita favorecer índices con el operador módulo.
  do { crypto.getRandomValues(muestra); } while (muestra[0]! >= techo);
  return muestra[0]! % limite;
}

/** Conserva cartas únicas por instancia y usa Fisher–Yates con aleatoriedad criptográfica. */
export class Baraja {
  private cartas: Carta[] = [];

  /**
   * @param numMazos - Cantidad de mazos completos; por defecto la configuración.
   * @returns Zapato completo barajado.
   * @throws ErrorJuego ERROR_INTERNO si la configuración no es un entero positivo.
   */
  constructor(private readonly numMazos = NUM_MAZOS) {
    if (!Number.isSafeInteger(numMazos) || numMazos <= 0) throw new ErrorJuego("ERROR_INTERNO");
    this.barajar();
  }

  /** @returns Número de cartas disponibles sin exponer ni alterar su orden. */
  get restantes(): number { return this.cartas.length; }

  /** @returns Repone todos los mazos y mezcla en sitio; llamar solo antes del reparto. */
  barajar(): void {
    this.cartas = [];
    for (let mazo = 0; mazo < this.numMazos; mazo++) {
      for (const palo of PALOS) for (const rango of RANGOS) this.cartas.push(new Carta(palo, rango));
    }
    for (let indice = this.cartas.length - 1; indice > 0; indice--) {
      const otro = indiceSeguro(indice + 1);
      [this.cartas[indice], this.cartas[otro]] = [this.cartas[otro]!, this.cartas[indice]!];
    }
  }

  /**
   * @returns Siguiente carta; nunca repone el zapato a mitad de una mano.
   * @throws ErrorJuego ERROR_INTERNO si se intenta sacar de un zapato agotado.
   */
  sacar(): Carta {
    const carta = this.cartas.pop();
    if (!carta) throw new ErrorJuego("ERROR_INTERNO");
    return carta;
  }

  /** @returns true solo por debajo del umbral configurado (51 de 208 con cuatro mazos). */
  necesitaRebarajar(): boolean {
    return this.restantes < this.numMazos * PALOS.length * RANGOS.length * UMBRAL_REBARAJAR;
  }
}
