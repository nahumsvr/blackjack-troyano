/**
 * Mano del dealer, al centro de la mesa. Mientras haya una carta oculta el total se muestra
 * como "?": el servidor manda `total: null` y nunca el valor de la carta tapada.
 * Al revelarse, la carta tapada se voltea (su clave cambia, así que React la monta de nuevo
 * con la animación "voltear"); las demás cartas entran repartidas boca abajo y se descubren.
 * A su derecha está el zapato (el mazo) del que salen volando todas las cartas de la mesa,
 * y el total va en la esquina superior derecha de su última carta, como en los jugadores.
 */
import type { DealerVista } from "@blackjack/shared";
import { useContext, type ReactNode } from "react";
import { Carta, TotalMano, type TonoTotal } from "./Carta";
import { OrigenCartas } from "./origenCartas";
import { retrasoReparto } from "./movimiento";

/** Posición de la carta que el dealer recibe boca abajo en el reparto. */
const POSICION_CARTA_TAPADA = 1;

/** Cartas dibujadas en el zapato (solo decorativo: da volumen al mazo). */
const CARTAS_ZAPATO = 3;

/**
 * Tono del total del dealer.
 * @param dealer - Vista del dealer.
 * @returns "pasado" si superó 21, "blackjack" con 21 en dos cartas, o "normal".
 */
function tonoDealer(dealer: DealerVista): TonoTotal {
  if (dealer.total === null) return "normal";
  if (dealer.total > 21) return "pasado";
  return dealer.total === 21 && dealer.cartas.length === 2 ? "blackjack" : "normal";
}

/** Props de la mano del dealer. */
interface PropsManoDealer {
  dealer: DealerVista;
  /** Manos que reciben cartas en el reparto inicial; el dealer recibe la última de cada vuelta. */
  participantes: number;
}

/**
 * Cartas y total del dealer.
 * @param props - Vista del dealer del snapshot y manos del reparto.
 * @returns Bloque del dealer.
 */
export function ManoDealer({ dealer, participantes }: PropsManoDealer): ReactNode {
  const zapato = useContext(OrigenCartas);
  const retraso = (posicion: number) => retrasoReparto(posicion, participantes - 1, participantes);
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-xs font-semibold tracking-[0.3em] text-emerald-100/80 uppercase">Dealer</span>
      <div className="relative flex min-h-20 items-center">
        {/* Zapato: de aquí salen volando todas las cartas (MesaVisual comparte su referencia).
            Va antes que las cartas en el árbol para que su referencia ya exista cuando ellas se midan. */}
        <div ref={zapato === null ? undefined : (elemento) => void (zapato.current = elemento)} aria-hidden="true" className="absolute top-1/2 left-full ml-10 h-20 w-14 -translate-y-1/2">
          {Array.from({ length: CARTAS_ZAPATO }, (_, capa) => (
            <div key={capa} className="absolute inset-0" style={{ transform: `translate(${capa * -2}px, ${capa * -2}px) rotate(8deg)` }}>
              <Carta carta={{ oculta: true }} entrada="voltear" />
            </div>
          ))}
        </div>
        {dealer.cartas.length === 0 ? (
          <div className="h-20 w-14 rounded-md border-2 border-dashed border-emerald-200/30" aria-label="sin cartas" />
        ) : (
          <div className="relative flex -space-x-7">
            {dealer.cartas.map((carta, posicion) => {
              const oculta = "oculta" in carta;
              // La segunda carta es la tapada: si ya se ve, es porque se acaba de revelar.
              const revelada = !oculta && posicion === POSICION_CARTA_TAPADA;
              return (
                <Carta
                  key={`${posicion}-${oculta ? "oculta" : "visible"}`}
                  carta={carta}
                  entrada={revelada ? "voltear" : "repartir"}
                  retrasoMs={revelada ? 0 : retraso(posicion)}
                />
              );
            })}
            <TotalMano
              key={dealer.total ?? "?"}
              total={dealer.total}
              tamano="normal"
              tono={tonoDealer(dealer)}
              etiqueta="total del dealer"
              retrasoUltimaMs={retraso(dealer.cartas.length - 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
