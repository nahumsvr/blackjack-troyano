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
  /** Borde del asiento. */
  borde: string;
  /** Color del nombre del jugador. */
  texto: string;
}

/** Un color por asiento, en el orden de los índices 0 a 4. Tonos separados en el círculo cromático. */
const COLORES_POR_ASIENTO: readonly [ColorJugador, ColorJugador, ColorJugador, ColorJugador, ColorJugador] = [
  { nombre: "azul", borde: "border-sky-400", texto: "text-sky-300" },
  { nombre: "rosa", borde: "border-pink-400", texto: "text-pink-300" },
  { nombre: "naranja", borde: "border-orange-400", texto: "text-orange-300" },
  { nombre: "lima", borde: "border-lime-400", texto: "text-lime-300" },
  { nombre: "violeta", borde: "border-violet-400", texto: "text-violet-300" },
];

/**
 * Devuelve el color del jugador sentado en un asiento.
 * @param indice - Índice del asiento (0–4), tal como viene en el snapshot de la mesa.
 * @returns Clases del color de ese asiento.
 */
export function colorDeAsiento(indice: Asiento["indice"]): ColorJugador {
  return COLORES_POR_ASIENTO[indice];
}
