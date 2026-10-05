/**
 * Cuenta regresiva de la fase o del turno. Usa el `finEn` del servidor corregido con el
 * desfase medido por `ping`, para que todas las laptops muestren el mismo número.
 */
import { useEffect, useState, type ReactNode } from "react";
import { msRestantes } from "../net/reloj";

/** Cada cuánto se redibuja la cuenta, en ms (menos de 1 s para no saltarse segundos). */
const REFRESCO_MS = 250;

/** Props del reloj. */
interface PropsReloj {
  /** Epoch ms del servidor en que vence; `null` oculta el reloj. */
  finEn: number | null;
  /** Desfase del reloj del servidor respecto al local, en ms. */
  desfaseMs: number;
}

/**
 * Muestra los segundos restantes.
 * @param props - `finEn` y desfase.
 * @returns Segundos restantes o nada si no hay reloj.
 */
export function Reloj({ finEn, desfaseMs }: PropsReloj): ReactNode {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (finEn === null) return;
    const intervalo = setInterval(() => setAhora(Date.now()), REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [finEn]);
  const restante = msRestantes(finEn, ahora, desfaseMs);
  if (restante === null) return null;
  return (
    <span className="font-mono text-xl tabular-nums" aria-label="Tiempo restante">
      {Math.ceil(restante / 1000)} s
    </span>
  );
}
