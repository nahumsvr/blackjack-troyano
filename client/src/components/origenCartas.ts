/**
 * De dónde salen las cartas al repartirse. `MesaVisual` publica en este contexto la referencia
 * al zapato del dealer (el mazo dibujado junto a sus cartas); cada `Carta`, al montarse, mide
 * dónde quedó y dónde está el zapato, y vuela desde ahí hasta su lugar frente al jugador.
 * Fuera de la mesa (p. ej. en la pantalla de resultado) no hay zapato y la carta solo cae un poco.
 */
import { createContext, type RefObject } from "react";

/** Referencia al elemento del zapato del dealer, o `null` fuera de la mesa. */
export const OrigenCartas = createContext<RefObject<HTMLElement | null> | null>(null);

/** Rectángulo mínimo para calcular el vuelo (compatible con `DOMRect`). */
export interface Caja {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Desplazamiento de partida de una carta, en px, relativo a su lugar final. */
export interface Vuelo {
  x: number;
  y: number;
}

/** Caída corta que se usa cuando no hay zapato del que salir. */
export const VUELO_SIN_ORIGEN: Vuelo = { x: 0, y: -32 };

/**
 * Desde dónde debe empezar a moverse una carta para que parezca salir del zapato:
 * la diferencia entre el centro del zapato y el centro del lugar final de la carta.
 * @param origen - Caja del zapato, o `null` si no hay.
 * @param destino - Caja de la carta en su lugar final (medida antes de animar).
 * @returns Desplazamiento inicial en px (redondeado).
 */
export function calcularVuelo(origen: Caja | null, destino: Caja): Vuelo {
  if (origen === null) return VUELO_SIN_ORIGEN;
  return {
    x: Math.round(origen.left + origen.width / 2 - (destino.left + destino.width / 2)),
    y: Math.round(origen.top + origen.height / 2 - (destino.top + destino.height / 2)),
  };
}
