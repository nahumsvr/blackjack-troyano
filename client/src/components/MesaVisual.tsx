/**
 * Mesa dibujada: un paño ovalado con borde de madera, el dealer al centro y los 5 asientos
 * rodeándolo por el borde inferior, como en un casino. Las posiciones salen de una elipse
 * (`posicionesMesa.ts`), así que la mesa se adapta a cualquier ancho manteniendo la proporción.
 * Cada asiento se ancla por su placa: la placa queda sobre el borde de madera y las cartas
 * y la ficha hacia adentro del paño, mirando al dealer.
 * En pantallas angostas (celular) los asientos se acomodan en una cuadrícula bajo el dealer.
 */
import type { MesaEstado } from "@blackjack/shared";
import type { CSSProperties, ReactNode } from "react";
import { Asiento, AsientoLibre } from "./Asiento";
import { ManoDealer } from "./ManoDealer";
import { INDICES_ASIENTO, PANO, posicionAsiento } from "./posicionesMesa";

/** Estilo del paño: verde con luz al centro y borde de madera. */
const ESTILO_PANO: CSSProperties = {
  background: "radial-gradient(ellipse at 50% 40%, #1f8a4c 0%, #146c3a 55%, #0d4f2a 100%)",
  boxShadow: "inset 0 0 40px rgba(0,0,0,.45), 0 0 0 14px #6b3e1d, 0 0 0 17px #3f2410, 0 12px 30px rgba(0,0,0,.5)",
};

/** Props de la mesa dibujada. */
interface PropsMesaVisual {
  mesa: MesaEstado;
  /** Id del usuario de esta pestaña, para marcar su asiento. */
  miId: number | null;
  /** Contenido extra sobre el paño, bajo el dealer (p. ej. el resultado de la ronda). */
  children?: ReactNode;
}

/**
 * Mesa con dealer al centro y jugadores alrededor.
 * @param props - Snapshot de la mesa, usuario propio y contenido central opcional.
 * @returns La mesa dibujada.
 */
export function MesaVisual({ mesa, miId, children }: PropsMesaVisual): ReactNode {
  return (
    <section
      aria-label={`Mesa ${mesa.nombre}`}
      className="relative flex flex-col gap-6 rounded-3xl bg-emerald-800 p-4 md:block md:aspect-[16/9] md:rounded-none md:bg-transparent md:p-0"
    >
      {/* Paño ovalado: solo en pantallas medianas o más; en celular el fondo del contenedor hace de paño. */}
      <div
        aria-hidden="true"
        className="absolute hidden rounded-[50%] md:block"
        style={{ ...ESTILO_PANO, left: `${PANO.izquierda}%`, right: `${PANO.derecha}%`, top: `${PANO.arriba}%`, bottom: `${PANO.abajo}%` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[41%] left-1/2 hidden -translate-x-1/2 text-center text-xs font-semibold tracking-[0.25em] text-amber-200/60 uppercase md:block"
      >
        El blackjack paga 3 a 2
        <br />
        El dealer se planta en 17
      </div>

      <div className="relative flex justify-center md:absolute md:top-[24%] md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
        <ManoDealer dealer={mesa.dealer} />
      </div>

      {Boolean(children) && (
        <div className="relative flex justify-center md:absolute md:top-[60%] md:left-1/2 md:z-10 md:-translate-x-1/2 md:-translate-y-1/2">
          {children}
        </div>
      )}

      <ul className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 md:static">
        {INDICES_ASIENTO.map((indice) => {
          const asiento = mesa.asientos[indice] ?? null;
          const posicion = posicionAsiento(indice);
          // Las coordenadas viajan como variables CSS y solo se aplican desde `md` (en celular hay cuadrícula).
          const coordenadas = { "--x": `${posicion.x}%`, "--y": `${posicion.y}%` } as CSSProperties;
          return (
            <li
              key={indice}
              style={coordenadas}
              className="flex justify-center md:absolute md:top-[var(--y)] md:left-[var(--x)] md:-translate-x-1/2 md:-translate-y-[78%]"
            >
              {asiento === null ? (
                <AsientoLibre />
              ) : (
                <Asiento asiento={asiento} enTurno={mesa.turnoDe === asiento.usuarioId} propio={asiento.usuarioId === miId} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
