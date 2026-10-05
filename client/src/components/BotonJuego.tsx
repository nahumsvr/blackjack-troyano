/**
 * Botón grande de las acciones de la partida (Apostar, Pedir, Plantarse), con aspecto de
 * botón de casino: degradado, brillo superior, canto inferior que se hunde al presionar e ícono.
 * Deshabilitado se ve gris y plano, para que quede claro que no es tu momento de actuar.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Colores disponibles. */
export type VarianteBotonJuego = "oro" | "verde" | "rojo";

/** Clases de color de cada variante (degradado, canto y texto). */
const CLASE_VARIANTE: Record<VarianteBotonJuego, string> = {
  oro: "border-amber-700 from-amber-200 via-amber-300 to-amber-500 text-emerald-950",
  verde: "border-emerald-800 from-emerald-300 via-emerald-400 to-emerald-600 text-emerald-950",
  rojo: "border-rose-800 from-rose-300 via-rose-400 to-rose-600 text-rose-950",
};

/** Props del botón: las de un `<button>` más variante, ícono y llamada de atención. */
interface PropsBotonJuego extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante: VarianteBotonJuego;
  /** Ícono decorativo a la izquierda del texto. */
  icono: ReactNode;
  /** Late para llamar la atención (p. ej. cuando es tu turno). */
  llamando?: boolean;
}

/**
 * Botón de acción de la partida.
 * @param props - Variante, ícono, `llamando` y las props normales de un botón.
 * @returns Botón estilizado.
 */
export function BotonJuego({ variante, icono, llamando = false, className = "", children, ...resto }: PropsBotonJuego): ReactNode {
  return (
    <button
      type="button"
      {...resto}
      className={`group relative inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl border-b-4 bg-linear-to-b px-6 py-3 text-lg font-black tracking-wide uppercase shadow-lg shadow-black/30 transition-all duration-150 select-none focus-visible:ring-4 focus-visible:ring-white/70 focus-visible:outline-none enabled:hover:-translate-y-0.5 enabled:hover:shadow-xl enabled:hover:brightness-110 enabled:active:translate-y-0.5 enabled:active:border-b-2 disabled:cursor-not-allowed disabled:border-slate-800 disabled:from-slate-600 disabled:via-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none ${CLASE_VARIANTE[variante]} ${
        llamando ? "animate-latido" : ""
      } ${className}`}
    >
      {/* Brillo superior, como en una ficha o botón plástico; desaparece al deshabilitar. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-1 h-1/3 rounded-xl bg-white/35 group-disabled:hidden" />
      <span aria-hidden="true" className="relative flex h-7 w-7 items-center justify-center rounded-full bg-black/15 text-base group-disabled:bg-black/20">
        {icono}
      </span>
      <span className="relative">{children}</span>
    </button>
  );
}
