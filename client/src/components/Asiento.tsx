/**
 * Asiento de un jugador en la mesa: cartas (hacia el dealer), ficha con la apuesta y
 * placa con el nombre. El color de la placa identifica al jugador (ver `colorJugador.ts`);
 * el turno se marca con un halo ámbar. Los asientos vacíos se dibujan como lugar libre.
 */
import type { Asiento as DatosAsiento, EstadoJugador } from "@blackjack/shared";
import type { ReactNode } from "react";
import { Mano } from "./Carta";
import { colorDeAsiento } from "./colorJugador";
import { Ficha } from "./Ficha";

/** Texto visible de cada estado del jugador. */
const TEXTO_ESTADO: Record<EstadoJugador, string> = {
  ESPERANDO_RONDA: "Espera la siguiente ronda",
  SIN_APUESTA: "Sin apuesta",
  APOSTADO: "Apostó",
  JUGANDO: "Jugando",
  PLANTADO: "Plantado",
  PASADO: "Se pasó",
  BLACKJACK: "¡Blackjack!",
};

/** Props del asiento ocupado. */
interface PropsAsiento {
  asiento: DatosAsiento;
  /** Es su turno de jugar. */
  enTurno: boolean;
  /** Es el jugador de esta pestaña. */
  propio: boolean;
}

/**
 * Asiento ocupado.
 * @param props - Datos del asiento y marcas de turno y jugador propio.
 * @returns Elemento del asiento.
 */
export function Asiento({ asiento, enTurno, propio }: PropsAsiento): ReactNode {
  const color = colorDeAsiento(asiento.indice);
  const hayCartas = asiento.cartas.length > 0;
  return (
    <div data-color={color.nombre} className={`flex flex-col items-center gap-1 ${asiento.conectado ? "" : "opacity-60"}`}>
      <div className="flex min-h-14 items-end gap-1">
        <Mano cartas={asiento.cartas} tamano="chica" />
        {hayCartas && (
          <span className={`rounded-full px-1.5 text-xs font-bold ${asiento.estado === "PASADO" ? "bg-red-700" : "bg-emerald-950/80"}`}>
            {asiento.total}
          </span>
        )}
      </div>
      <div className="h-10">{asiento.apuesta > 0 && <Ficha cantidad={asiento.apuesta} />}</div>
      <div
        className={`w-36 rounded-lg border-2 bg-emerald-950/85 px-2 py-1 text-center shadow-lg ${color.borde} ${
          enTurno ? "ring-4 ring-amber-300 shadow-amber-300/50" : ""
        }`}
      >
        <div className={`truncate font-semibold ${color.texto}`}>
          {asiento.usuario}
          {propio && " (tú)"}
        </div>
        <div className="text-xs text-emerald-200">{asiento.conectado ? TEXTO_ESTADO[asiento.estado] : "Desconectado"}</div>
      </div>
    </div>
  );
}

/**
 * Lugar libre de la mesa.
 * @returns Círculo punteado con la leyenda "Libre".
 */
export function AsientoLibre(): ReactNode {
  return (
    <div className="flex flex-col items-center justify-end gap-1">
      <div className="flex h-14 w-36 items-center justify-center rounded-lg border-2 border-dashed border-emerald-400/40 text-sm text-emerald-300/70">
        Libre
      </div>
    </div>
  );
}
