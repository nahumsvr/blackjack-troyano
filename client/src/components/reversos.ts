/**
 * Diseños del reverso de las cartas, uno por cada artículo `reverso` del catálogo (`seed.sql`).
 * Se dibujan solo con CSS (degradados y sombras), sin imágenes externas. `Carta` los aplica a la
 * carta oculta y a la cara trasera de las visibles; T-40 pasará el reverso equipado de cada
 * jugador. Un id desconocido cae en el clásico para que un artículo nuevo no rompa la mesa.
 */
import type { CSSProperties } from "react";

/** Diseño de un reverso: clases de Tailwind (borde, fondo) y estilo en línea (tramas). */
export interface DisenoReverso {
  clases: string;
  estilo: CSSProperties;
}

/** Reverso que usa la mesa mientras nadie haya equipado otro (el gratuito del catálogo). */
export const REVERSO_PREDETERMINADO = "reverso_clasico";

/** Trama de rombos con dos franjas diagonales, compartida por el clásico y el rojo. */
const TRAMA_ROMBOS: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px)",
};

/** Reverso clásico azul: también es el respaldo de cualquier id sin diseño. */
const CLASICO: DisenoReverso = { clases: "border-2 border-white bg-sky-800 shadow-md", estilo: TRAMA_ROMBOS };

/** Diseño de cada reverso del catálogo, por id de artículo. */
export const DISENO_REVERSO: Readonly<Partial<Record<string, DisenoReverso>>> = {
  [REVERSO_PREDETERMINADO]: CLASICO,
  reverso_rojo: { clases: "border-2 border-white bg-red-800 shadow-md", estilo: TRAMA_ROMBOS },
  reverso_neon: {
    clases: "border-2 border-fuchsia-400 bg-slate-950",
    estilo: {
      backgroundImage: "repeating-linear-gradient(135deg, rgba(34,211,238,.4) 0 1px, transparent 1px 6px)",
      boxShadow: "0 0 8px rgba(232,121,249,.8), inset 0 0 6px rgba(34,211,238,.6)",
    },
  },
  reverso_oro: {
    clases: "border-2 border-amber-100 shadow-md",
    estilo: {
      // Medallón claro al centro sobre un degradado dorado, con un marco interior más oscuro.
      backgroundImage:
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,.55) 0 18%, transparent 19%), linear-gradient(135deg, #b45309, #fcd34d 45%, #b45309)",
      boxShadow: "inset 0 0 0 3px rgba(120,53,15,.55)",
    },
  },
  reverso_pixel: {
    clases: "border-2 border-white shadow-md",
    estilo: {
      // Tablero de dos colores: cada cuadro de 4 px parece un pixel grande.
      backgroundImage: "conic-gradient(#4f46e5 25%, #22d3ee 0 50%, #4f46e5 0 75%, #22d3ee 0)",
      backgroundSize: "8px 8px",
    },
  },
};

/**
 * Diseño con el que se dibuja un reverso.
 * @param id - Id del artículo `reverso` (p. ej. `asiento.reverso`); si se omite, el predeterminado.
 * @returns Diseño del reverso, o el clásico si el id no tiene diseño propio.
 */
export function disenoReverso(id?: string): DisenoReverso {
  return (id === undefined ? undefined : DISENO_REVERSO[id]) ?? CLASICO;
}
