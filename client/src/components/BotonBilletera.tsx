/**
 * Botón de cabecera que muestra las fichas del usuario y abre el menú lateral de la billetera.
 * Las fichas salen del último mensaje `billetera` del servidor.
 */
import type { ReactNode } from "react";
import { useJuego } from "../state/store";

/** Props del botón. */
interface PropsBotonBilletera {
  alAbrir: () => void;
}

/**
 * Botón con el saldo de fichas.
 * @param props - Acción para abrir el menú.
 * @returns Botón de billetera.
 */
export function BotonBilletera({ alAbrir }: PropsBotonBilletera): ReactNode {
  const { estado } = useJuego();
  const fichas = estado.billetera?.fichas;
  return (
    <button
      type="button"
      onClick={alAbrir}
      aria-label="Abrir billetera"
      className="flex items-center gap-2 rounded-full border border-amber-400/60 bg-emerald-900 px-3 py-1 hover:bg-emerald-800"
    >
      <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border-2 border-dashed border-white bg-amber-500" />
      <span className="font-semibold tabular-nums">{fichas === undefined ? "…" : fichas.toLocaleString("es-MX")}</span>
      <span className="text-sm text-emerald-200">fichas</span>
    </button>
  );
}
