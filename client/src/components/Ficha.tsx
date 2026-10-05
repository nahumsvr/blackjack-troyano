/**
 * Ficha de casino dibujada en SVG con la cantidad apostada. El color depende del monto,
 * como en un casino real, para que las apuestas grandes se distingan de un vistazo.
 */
import type { ReactNode } from "react";

/** Colores de la ficha por monto mínimo, de mayor a menor. */
const COLORES_FICHA: ReadonlyArray<{ desde: number; color: string }> = [
  { desde: 500, color: "#7e22ce" }, // morada
  { desde: 100, color: "#111827" }, // negra
  { desde: 50, color: "#0369a1" }, // azul
];
/** Color de la ficha para montos menores al último nivel. */
const COLOR_FICHA_BASE = "#b45309"; // café

/**
 * Color de la ficha para un monto.
 * @param cantidad - Fichas apostadas.
 * @returns Color hexadecimal.
 */
export function colorFicha(cantidad: number): string {
  return COLORES_FICHA.find((nivel) => cantidad >= nivel.desde)?.color ?? COLOR_FICHA_BASE;
}

/** Props de la ficha. */
interface PropsFicha {
  cantidad: number;
}

/**
 * Ficha con el monto al centro y el canto rayado.
 * @param props - Monto apostado.
 * @returns SVG accesible ("apuesta de 100 fichas").
 */
export function Ficha({ cantidad }: PropsFicha): ReactNode {
  const color = colorFicha(cantidad);
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 drop-shadow" role="img" aria-label={`apuesta de ${cantidad} fichas`}>
      <circle cx="20" cy="20" r="19" fill={color} />
      {/* Canto rayado: un trazo punteado blanco sobre el borde. */}
      <circle cx="20" cy="20" r="16.5" fill="none" stroke="white" strokeWidth="4" strokeDasharray="5.2 5.2" />
      <circle cx="20" cy="20" r="12" fill={color} stroke="rgba(255,255,255,.7)" strokeWidth="1" />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="10" fontWeight="700">
        {cantidad}
      </text>
    </svg>
  );
}
