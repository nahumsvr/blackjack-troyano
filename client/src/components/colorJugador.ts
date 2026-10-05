/**
 * Color de identificación de cada jugador en la mesa.
 *
 * El color se asigna por ASIENTO (0–4), no por id de usuario: con 5 asientos y 5 colores
 * se garantiza que dos jugadores de la misma mesa nunca compartan color, y como el índice
 * del asiento lo decide el servidor, todas las pantallas ven a cada jugador del mismo color.
 * Un jugador conserva su color mientras siga sentado en ese asiento.
 *
 * Se evitan a propósito los tonos que ya tienen significado en la UI: verde (paño),
 * ámbar (turno y botones principales) y rojo (errores y "desconectado").
 * Las clases van escritas completas porque Tailwind solo genera las que encuentra literales.
 */
import type { Asiento } from "@blackjack/shared";

/** Clases de Tailwind de un color de jugador. */
export interface ColorJugador {
  /** Nombre del color, para lectores de pantalla y el manual de usuario. */
  nombre: string;
  /** Borde izquierdo grueso del asiento. */
  borde: string;
  /** Color del nombre del jugador. */
  texto: string;
  /** Fondo del punto junto al nombre. */
  punto: string;
}

/** Un color por asiento, en el orden de los índices 0 a 4. Tonos separados en el círculo cromático. */
const COLORES_POR_ASIENTO: readonly [ColorJugador, ColorJugador, ColorJugador, ColorJugador, ColorJugador] = [
  { nombre: "azul", borde: "border-l-sky-400", texto: "text-sky-300", punto: "bg-sky-400" },
  { nombre: "rosa", borde: "border-l-pink-400", texto: "text-pink-300", punto: "bg-pink-400" },
  { nombre: "naranja", borde: "border-l-orange-400", texto: "text-orange-300", punto: "bg-orange-400" },
  { nombre: "lima", borde: "border-l-lime-400", texto: "text-lime-300", punto: "bg-lime-400" },
  { nombre: "violeta", borde: "border-l-violet-400", texto: "text-violet-300", punto: "bg-violet-400" },
];

/**
 * Devuelve el color del jugador sentado en un asiento.
 * @param indice - Índice del asiento (0–4), tal como viene en el snapshot de la mesa.
 * @returns Clases del color de ese asiento.
 */
export function colorDeAsiento(indice: Asiento["indice"]): ColorJugador {
  return COLORES_POR_ASIENTO[indice];
}
