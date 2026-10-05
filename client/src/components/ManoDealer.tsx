/**
 * Mano del dealer, al centro de la mesa. Mientras haya una carta oculta el total se muestra
 * como "?": el servidor manda `total: null` y nunca el valor de la carta tapada.
 */
import type { DealerVista } from "@blackjack/shared";
import type { ReactNode } from "react";
import { Carta } from "./Carta";

/** Props de la mano del dealer. */
interface PropsManoDealer {
  dealer: DealerVista;
}

/**
 * Cartas y total del dealer.
 * @param props - Vista del dealer del snapshot.
 * @returns Bloque del dealer.
 */
export function ManoDealer({ dealer }: PropsManoDealer): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold tracking-[0.3em] text-emerald-100/80 uppercase">Dealer</span>
      <div className="flex min-h-20 items-center gap-2">
        {dealer.cartas.length === 0 ? (
          <div className="h-20 w-14 rounded-md border-2 border-dashed border-emerald-200/30" aria-label="sin cartas" />
        ) : (
          <div className="flex -space-x-7">
            {dealer.cartas.map((carta, posicion) => (
              <Carta key={posicion} carta={carta} />
            ))}
          </div>
        )}
      </div>
      {dealer.cartas.length > 0 && (
        <span className="rounded-full bg-emerald-950/80 px-2 text-sm font-bold" aria-label="total del dealer">
          {dealer.total ?? "?"}
        </span>
      )}
    </div>
  );
}
