/**
 * Relojes animados de la mesa: un temporizador circular (fase o turno, en la cabecera) y una
 * barra de tiempo (bajo la placa del jugador en turno). Ambos usan el `finEn` del servidor
 * corregido con el desfase medido por `ping`, para que todas las laptops vean lo mismo, y se
 * vacían de forma continua. El color avisa la urgencia: verde → ámbar → rojo en los últimos segundos.
 */
import type { ReactNode } from "react";
import { useCuentaRegresiva, type NivelUrgencia } from "./cuentaRegresiva";

/** Radio del anillo dentro de su caja de 48×48. */
const RADIO_ANILLO = 21;
/** Largo del trazo del anillo completo. */
const CIRCUNFERENCIA = 2 * Math.PI * RADIO_ANILLO;

/** Color del trazo (SVG) por nivel de urgencia. */
const COLOR_TRAZO: Record<NivelUrgencia, string> = { calma: "#34d399", atencion: "#fbbf24", urgente: "#f87171" };
/** Clase de color de la barra por nivel de urgencia. */
const COLOR_BARRA: Record<NivelUrgencia, string> = { calma: "bg-emerald-400", atencion: "bg-amber-400", urgente: "bg-red-400" };

/** Props comunes de los relojes. */
interface PropsReloj {
  /** Epoch ms del servidor en que vence; `null` oculta el reloj. */
  finEn: number | null;
  /** Desfase del reloj del servidor respecto al local, en ms. */
  desfaseMs: number;
}

/**
 * Temporizador circular: el anillo se vacía y al centro quedan los segundos.
 * En los últimos segundos se pone rojo y cada número entra con un pequeño golpe.
 * @param props - `finEn` y desfase.
 * @returns Anillo con los segundos, o nada si no hay reloj.
 */
export function Reloj({ finEn, desfaseMs }: PropsReloj): ReactNode {
  const cuenta = useCuentaRegresiva(finEn, desfaseMs);
  if (cuenta === null) return null;
  const urgencia = cuenta.nivel;
  return (
    <div role="timer" aria-label={`Quedan ${cuenta.segundos} segundos`} className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={RADIO_ANILLO} fill="rgb(2 44 34 / 0.85)" stroke="rgb(255 255 255 / 0.12)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={RADIO_ANILLO}
          fill="none"
          stroke={COLOR_TRAZO[urgencia]}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - cuenta.fraccion)}
          className="transition-[stroke] duration-300"
        />
      </svg>
      <span
        // En modo urgente cada segundo es un elemento nuevo, así la animación se repite por segundo.
        key={urgencia === "urgente" ? cuenta.segundos : "normal"}
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center font-mono text-lg font-bold tabular-nums ${
          urgencia === "urgente" ? "animate-tic text-red-300" : ""
        }`}
      >
        {cuenta.segundos}
      </span>
    </div>
  );
}

/**
 * Barra de tiempo delgada (p. ej. el turno de un jugador).
 * @param props - `finEn` y desfase.
 * @returns Barra que se vacía de izquierda a derecha, o nada si no hay reloj.
 */
export function BarraTiempo({ finEn, desfaseMs }: PropsReloj): ReactNode {
  const cuenta = useCuentaRegresiva(finEn, desfaseMs);
  if (cuenta === null) return null;
  return (
    <div
      role="progressbar"
      aria-label="Tiempo del turno"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(cuenta.fraccion * 100)}
      aria-valuetext={`${cuenta.segundos} segundos`}
      className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/40"
    >
      <div className={`h-full rounded-full transition-colors duration-300 ${COLOR_BARRA[cuenta.nivel]}`} style={{ width: `${cuenta.fraccion * 100}%` }} />
    </div>
  );
}
