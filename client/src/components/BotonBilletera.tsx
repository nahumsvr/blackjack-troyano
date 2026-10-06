/**
 * Botón de cabecera que muestra las fichas del usuario y abre el menú lateral de la billetera.
 * Las fichas salen del último mensaje `billetera` del servidor. Cuando cambian, el número
 * destella (verde si subió, rojo si bajó) y la diferencia flota sobre el botón, para que el
 * jugador note de inmediato lo que ganó, apostó o compró.
 */
import { useState, type ReactNode } from "react";
import { useJuego } from "../state/store";

/** Props del botón. */
interface PropsBotonBilletera {
  alAbrir: () => void;
}

/** Último cambio de saldo; `id` crece en cada cambio para reiniciar la animación. */
interface CambioFichas {
  id: number;
  delta: number;
}

/**
 * Botón con el saldo de fichas.
 * @param props - Acción para abrir el menú.
 * @returns Botón de billetera.
 */
export function BotonBilletera({ alAbrir }: PropsBotonBilletera): ReactNode {
  const { estado } = useJuego();
  const fichas = estado.billetera?.fichas;
  const [previas, setPrevias] = useState(fichas);
  const [cambio, setCambio] = useState<CambioFichas | null>(null);
  // Ajuste durante el render: el cambio se detecta en el mismo cuadro en que llega la billetera.
  if (fichas !== previas) {
    setPrevias(fichas);
    // La primera billetera (de "…" a un número) no es una ganancia: no se anima.
    if (fichas !== undefined && previas !== undefined) setCambio({ id: (cambio?.id ?? 0) + 1, delta: fichas - previas });
  }

  const subio = cambio !== null && cambio.delta > 0;
  return (
    <button
      type="button"
      onClick={alAbrir}
      aria-label="Abrir billetera"
      className="relative flex items-center gap-2 rounded-full border border-amber-400/60 bg-emerald-900 px-3 py-1 transition-transform hover:bg-emerald-800 active:scale-95"
    >
      <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border-2 border-dashed border-white bg-amber-500" />
      <span key={cambio?.id ?? 0} className={`inline-block font-semibold tabular-nums ${cambio === null ? "" : subio ? "animate-subio" : "animate-bajo"}`}>
        {fichas === undefined ? "…" : fichas.toLocaleString("es-MX")}
      </span>
      <span className="text-sm text-emerald-200">fichas</span>
      {cambio !== null && (
        <span
          key={`delta-${cambio.id}`}
          aria-hidden="true"
          className={`pointer-events-none absolute -top-4 right-3 animate-flotar text-sm font-black drop-shadow ${subio ? "text-emerald-300" : "text-red-300"}`}
        >
          {subio ? "+" : "−"}
          {Math.abs(cambio.delta).toLocaleString("es-MX")}
        </span>
      )}
    </button>
  );
}
