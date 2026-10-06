/**
 * Asiento de un jugador en la mesa: cartas (hacia el dealer), ficha con la apuesta y
 * placa con el nombre. El color de la placa identifica al jugador (ver `colorJugador.ts`);
 * el turno se marca con un halo ámbar que late y una barra con el tiempo que le queda.
 * Las cartas llegan volando desde el zapato del dealer y el total va en la esquina superior
 * derecha de la última carta. La ficha entra rebotando al apostar. El asiento propio se
 * dibuja más grande (cartas, ficha, total y placa) porque es el que el jugador sigue de cerca.
 * Los asientos vacíos se dibujan como lugar libre.
 */
import type { Asiento as DatosAsiento, EstadoJugador } from "@blackjack/shared";
import type { ReactNode } from "react";
import { Mano, type TamanoCarta, type TonoTotal } from "./Carta";
import { colorDeAsiento } from "./colorJugador";
import { Ficha, type TamanoFicha } from "./Ficha";
import { BarraTiempo } from "./Reloj";

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

/** Estados que pintan el total de otro color (el resto, normal). */
const TONO_TOTAL: Partial<Record<EstadoJugador, TonoTotal>> = { PASADO: "pasado", BLACKJACK: "blackjack" };

/** Medidas de un asiento: el propio es más grande. */
interface MedidaAsiento {
  carta: TamanoCarta;
  ficha: TamanoFicha;
  zonaCartas: string;
  zonaFicha: string;
  placa: string;
  estado: string;
}

/** Medidas de los asientos de los demás jugadores. */
const MEDIDA_OTROS: MedidaAsiento = {
  carta: "chica",
  ficha: "normal",
  zonaCartas: "min-h-14",
  zonaFicha: "h-10",
  placa: "w-36",
  estado: "text-xs",
};
/** Medidas del asiento propio. */
const MEDIDA_PROPIA: MedidaAsiento = {
  carta: "normal",
  ficha: "grande",
  zonaCartas: "min-h-20",
  zonaFicha: "h-14",
  placa: "w-44 text-lg",
  estado: "text-sm",
};

/** Props del asiento ocupado. */
interface PropsAsiento {
  asiento: DatosAsiento;
  /** Es su turno de jugar. */
  enTurno: boolean;
  /** Es el jugador de esta pestaña. */
  propio: boolean;
  /** Turno de esta mano en el reparto inicial (para que las cartas salgan en orden de casino). */
  reparto?: { orden: number; participantes: number };
  /** Reloj del turno si este jugador está en turno; `null` en otro caso. */
  relojTurno?: { finEn: number | null; desfaseMs: number } | null;
}

/**
 * Asiento ocupado.
 * @param props - Datos del asiento, marcas de turno y jugador propio, turno de reparto y reloj del turno.
 * @returns Elemento del asiento.
 */
export function Asiento({ asiento, enTurno, propio, reparto, relojTurno = null }: PropsAsiento): ReactNode {
  const color = colorDeAsiento(asiento.indice);
  const hayCartas = asiento.cartas.length > 0;
  const medida = propio ? MEDIDA_PROPIA : MEDIDA_OTROS;
  return (
    <div data-color={color.nombre} className={`flex flex-col items-center gap-1 ${asiento.conectado ? "" : "opacity-60"}`}>
      <div className={`flex items-end gap-1 ${medida.zonaCartas}`}>
        <Mano
          cartas={asiento.cartas}
          tamano={medida.carta}
          total={hayCartas ? asiento.total : undefined}
          tonoTotal={TONO_TOTAL[asiento.estado] ?? "normal"}
          reparto={reparto}
        />
      </div>
      <div className={medida.zonaFicha}>
        {asiento.apuesta > 0 && (
          <span key={asiento.apuesta} className="inline-block animate-ficha">
            <Ficha cantidad={asiento.apuesta} tamano={medida.ficha} />
          </span>
        )}
      </div>
      <div
        className={`relative rounded-lg border-2 bg-emerald-950/85 px-2 py-1 text-center shadow-lg transition-shadow ${medida.placa} ${color.borde} ${
          enTurno ? "ring-4 ring-amber-300 shadow-amber-300/50" : ""
        }`}
      >
        {/* El latido va en una capa aparte porque el anillo de Tailwind también usa box-shadow. */}
        {enTurno && <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-latido rounded-lg" />}
        <div className={`truncate font-semibold ${color.texto}`}>
          {asiento.usuario}
          {propio && " (tú)"}
        </div>
        <div className={`text-emerald-200 ${medida.estado}`}>{asiento.conectado ? TEXTO_ESTADO[asiento.estado] : "Desconectado"}</div>
        {relojTurno !== null && <BarraTiempo finEn={relojTurno.finEn} desfaseMs={relojTurno.desfaseMs} />}
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
