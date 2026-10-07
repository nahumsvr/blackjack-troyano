/** Valoración pura de manos; el As se ajusta sin alterar cartas ni depender de la mesa. */
import { Carta } from "./Carta";

/** Mano de blackjack cuyo total usa como máximo un As de valor once. */
export class Mano {
  private readonly contenido: Carta[];

  /**
   * Crea una mano copiando las cartas iniciales para no compartir su contenedor.
   * @param cartas - Cartas iniciales opcionales; se copia el contenedor.
   * @returns Mano independiente del arreglo recibido.
   */
  constructor(cartas: readonly Carta[] = []) { this.contenido = [...cartas]; }

  /**
   * Consulta las cartas sin compartir el contenedor interno de la mano.
   * @returns Copia de las cartas inmutables, en orden de reparto.
   */
  get cartas(): readonly Carta[] { return [...this.contenido]; }

  /**
   * Añade una carta al final de la mano sin ajustar ni decidir el resultado.
   * @param carta - Carta extraída del zapato.
   * @returns Sin valor.
   */
  agregar(carta: Carta): void { this.contenido.push(carta); }

  /**
   * Calcula el total ajustando un As a once cuando no provoca pasarse.
   * @returns Mayor total que no excede 21, o el mínimo si todos exceden 21.
   */
  total(): number {
    const minimo = this.minimo();
    return this.tieneAs() && minimo + 10 <= 21 ? minimo + 10 : minimo;
  }

  /**
   * Comprueba si el total actual incluye un As valorado en once.
   * @returns true si un As cuenta once en el total actual.
   */
  esBlanda(): boolean { return this.tieneAs() && this.minimo() + 10 <= 21; }

  /**
   * Distingue el natural de un veintiuno obtenido con más cartas.
   * @returns true únicamente para un 21 con las dos cartas iniciales.
   */
  esBlackjack(): boolean { return this.contenido.length === 2 && this.total() === 21; }

  /**
   * Comprueba si la mano pierde incluso con todos los Ases a uno.
   * @returns true si el total supera 21 incluso contando todos los Ases como uno.
   */
  estaPasada(): boolean { return this.total() > 21; }

  private minimo(): number { return this.contenido.reduce((total, carta) => total + carta.valorBase(), 0); }
  private tieneAs(): boolean { return this.contenido.some((carta) => carta.rango === "A"); }
}
