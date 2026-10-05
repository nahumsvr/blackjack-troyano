/**
 * Mesa dibujada: un paño ovalado con borde de madera, el dealer al centro y los 5 asientos
 * rodeándolo por el borde inferior, como en un casino. El jugador de esta pestaña se ve siempre
 * abajo al centro y más grande (la mesa se gira con `lugarVisual`, sin cambiar el orden). Las posiciones salen de una elipse
 * (`posicionesMesa.ts`), así que la mesa se adapta a cualquier ancho manteniendo la proporción.
 * Cada asiento se ancla por su placa: la placa queda sobre el borde de madera y las cartas
 * y la ficha hacia adentro del paño, mirando al dealer.
 * En pantallas angostas (celular) los asientos se acomodan en una cuadrícula bajo el dealer,
 * con el asiento propio primero y a todo lo ancho.
 * La mesa comparte con sus cartas (contexto `OrigenCartas`) dónde está el zapato del dealer,
 * para que al repartir vuelen desde ahí hasta cada jugador.
 */
import type { MesaEstado } from "@blackjack/shared";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { Asiento, AsientoLibre } from "./Asiento";
import { ManoDealer } from "./ManoDealer";
import { OrigenCartas } from "./origenCartas";
import { INDICES_ASIENTO, PANO, lugarVisual, posicionAsiento } from "./posicionesMesa";

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
  /** Desfase con el reloj del servidor, para la barra de tiempo del turno. */
  desfaseMs: number;
  /** Contenido extra sobre el paño, bajo el dealer (p. ej. el resultado de la ronda). */
  children?: ReactNode;
}

/**
 * Mesa con dealer al centro y jugadores alrededor.
 * @param props - Snapshot de la mesa, usuario propio, desfase del reloj y contenido central opcional.
 * @returns La mesa dibujada.
 */
export function MesaVisual({ mesa, miId, desfaseMs, children }: PropsMesaVisual): ReactNode {
  const hayCentro = Boolean(children);
  // Zapato del dealer: origen del vuelo de todas las cartas de la mesa.
  const zapato = useRef<HTMLElement | null>(null);
  const indicePropio = INDICES_ASIENTO.find((indice) => mesa.asientos[indice]?.usuarioId === miId) ?? null;
  // Orden del reparto inicial: jugadores con cartas de izquierda a derecha en pantalla y al final el dealer.
  const ordenReparto = INDICES_ASIENTO.filter((indice) => (mesa.asientos[indice]?.cartas.length ?? 0) > 0).sort(
    (a, b) => lugarVisual(a, indicePropio) - lugarVisual(b, indicePropio),
  );
  const participantes = ordenReparto.length + 1;
  return (
    <OrigenCartas value={zapato}>
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
      <div className="relative flex justify-center md:absolute md:top-[24%] md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
        <ManoDealer dealer={mesa.dealer} participantes={participantes} />
      </div>

      {/* Las reglas son decorativas: ceden su lugar a las pistas y al resultado cuando los hay. */}
      {!hayCentro && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[43%] left-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center text-xs font-semibold tracking-[0.25em] text-amber-200/60 uppercase md:block"
        >
          El blackjack paga 3 a 2
          <br />
          El dealer se planta en 17
        </div>
      )}

      {hayCentro && (
        <div className="relative flex justify-center md:absolute md:top-[43%] md:left-1/2 md:z-10 md:-translate-x-1/2 md:-translate-y-1/2">
          {children}
        </div>
      )}

      <ul className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 md:static">
        {INDICES_ASIENTO.map((indice) => {
          const asiento = mesa.asientos[indice] ?? null;
          const posicion = posicionAsiento(lugarVisual(indice, indicePropio));
          const esPropio = indice === indicePropio;
          // Las coordenadas viajan como variables CSS y solo se aplican desde `md` (en celular hay cuadrícula).
          const coordenadas = { "--x": `${posicion.x}%`, "--y": `${posicion.y}%` } as CSSProperties;
          return (
            <li
              key={indice}
              style={coordenadas}
              className={`flex justify-center md:absolute md:top-[var(--y)] md:left-[var(--x)] md:-translate-x-1/2 md:-translate-y-[78%] ${
                esPropio ? "order-first col-span-full md:z-10" : ""
              }`}
            >
              {asiento === null ? (
                <AsientoLibre />
              ) : (
                <Asiento
                  asiento={asiento}
                  enTurno={mesa.turnoDe === asiento.usuarioId}
                  propio={esPropio}
                  reparto={{ orden: Math.max(0, ordenReparto.indexOf(indice)), participantes }}
                  // El reloj de TURNOS es el del jugador en turno: se dibuja como barra bajo su placa.
                  relojTurno={mesa.fase === "TURNOS" && mesa.turnoDe === asiento.usuarioId ? { finEn: mesa.finEn, desfaseMs } : null}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
    </OrigenCartas>
  );
}
