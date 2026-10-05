/**
 * Geometría de la mesa dibujada: dónde va el paño ovalado y dónde se sienta cada jugador.
 * Las posiciones salen de una elipse, así la mesa conserva la forma en cualquier ancho.
 * Está separado de `MesaVisual.tsx` para poder probarlo y para que la recarga en caliente
 * de React funcione (un archivo de componentes solo debe exportar componentes).
 */

/** Rectángulo del paño, en % del contenedor (márgenes desde cada borde). */
export const PANO = { izquierda: 8, derecha: 8, arriba: 4, abajo: 12 } as const;

/** Elipse del borde del paño: centro y radios en % del contenedor, derivados de `PANO`. */
const ELIPSE = {
  centroX: (PANO.izquierda + (100 - PANO.derecha)) / 2,
  centroY: (PANO.arriba + (100 - PANO.abajo)) / 2,
  radioX: (100 - PANO.izquierda - PANO.derecha) / 2,
  radioY: (100 - PANO.arriba - PANO.abajo) / 2,
};

/**
 * Ángulo (grados, 0 = derecha, 90 = abajo) de cada asiento. Recorren el borde inferior de
 * izquierda a derecha y dejan libre la parte superior, donde trabaja el dealer.
 */
const ANGULOS_ASIENTO = [165, 125, 90, 55, 15] as const;

/** Índices de los asientos, en orden. */
export const INDICES_ASIENTO = [0, 1, 2, 3, 4] as const;

/** Índice válido de asiento. */
export type IndiceAsiento = (typeof INDICES_ASIENTO)[number];

/** Posición en % del ancho (`x`) y del alto (`y`) del contenedor. */
export interface Posicion {
  x: number;
  y: number;
}

/**
 * Punto del borde del paño donde se sienta un jugador.
 * @param indice - Índice del asiento (0–4).
 * @returns Coordenadas en porcentaje, redondeadas a centésimas.
 */
export function posicionAsiento(indice: IndiceAsiento): Posicion {
  const radianes = (ANGULOS_ASIENTO[indice] * Math.PI) / 180;
  const redondear = (valor: number) => Math.round(valor * 100) / 100;
  return {
    x: redondear(ELIPSE.centroX + ELIPSE.radioX * Math.cos(radianes)),
    y: redondear(ELIPSE.centroY + ELIPSE.radioY * Math.sin(radianes)),
  };
}
