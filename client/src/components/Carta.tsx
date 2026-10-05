/**
 * Carta de la baraja dibujada solo con CSS (sin imágenes externas): esquinas con rango y palo,
 * palo grande al centro, rojo para ♥ ♦. La carta oculta del dealer (`{oculta:true}`) se dibuja
 * con el reverso; su valor nunca llega al cliente antes de la fase DEALER.
 *
 * Animación de entrada:
 * - "repartir": la carta sale volando del zapato del dealer hasta su lugar (ver `origenCartas.ts`)
 *   boca abajo y, al llegar, se descubre (las visibles tienen dos caras sobre un eje 3D);
 * - "voltear": solo se descubre (la carta tapada del dealer al revelarse).
 * El valor ya llegó del servidor; el vuelo y la vuelta son solo efectos visuales.
 * `Mano` muestra además el total en la esquina superior derecha de la última carta.
 * T-40 podrá pasar el reverso equipado del jugador; por ahora hay un reverso único.
 */
import type { CartaVista, CartaVisible } from "@blackjack/shared";
import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ESPERA_TOTAL_MS, retrasoReparto } from "./movimiento";
import { OrigenCartas, calcularVuelo, type Vuelo } from "./origenCartas";

/** Tamaños disponibles. */
export type TamanoCarta = "normal" | "chica";
/** Animación con la que aparece la carta. */
export type EntradaCarta = "repartir" | "voltear";

/** Nombre hablado de cada palo (para lectores de pantalla). */
const NOMBRE_PALO: Record<CartaVisible["palo"], string> = { "♠": "picas", "♥": "corazones", "♦": "diamantes", "♣": "tréboles" };

/** Clase de la vuelta de cada entrada: al repartir, se descubre al terminar el vuelo. */
const CLASE_VUELTA: Record<EntradaCarta, string> = { repartir: "animate-descubrir", voltear: "animate-voltear" };

/** Clases de cada tamaño: caja, radio del borde, texto de esquina y palo central. */
const MEDIDAS: Record<TamanoCarta, { caja: string; radio: string; esquina: string; centro: string }> = {
  normal: { caja: "h-20 w-14", radio: "rounded-md", esquina: "text-sm", centro: "text-3xl" },
  chica: { caja: "h-14 w-10", radio: "rounded", esquina: "text-[10px]", centro: "text-xl" },
};

/** Trama del reverso clásico: rombos con dos franjas diagonales. */
const ESTILO_REVERSO: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px)",
};

/** Clases del reverso (compartidas por la carta oculta y la cara trasera de las visibles). */
const CLASES_REVERSO = "border-2 border-white bg-sky-800 shadow-md";

/** Props de la carta. */
interface PropsCarta {
  carta: CartaVista;
  tamano?: TamanoCarta;
  entrada?: EntradaCarta;
  /** Espera antes de la animación, para repartir las cartas de una mano una tras otra. */
  retrasoMs?: number;
}

/**
 * Mide, una sola vez al montarse y antes de pintar, desde dónde debe volar la carta.
 * Mientras no se mide no hay animación; como `useLayoutEffect` corre antes del primer cuadro,
 * la carta nunca se ve en su lugar final antes de salir del zapato.
 * @param entrada - Animación pedida (solo "repartir" vuela).
 * @returns Referencia para la caja de la carta y el vuelo medido (`null` si no vuela o aún no se mide).
 */
function useVuelo(entrada: EntradaCarta): [RefObject<HTMLDivElement | null>, Vuelo | null] {
  const origen = useContext(OrigenCartas);
  const caja = useRef<HTMLDivElement>(null);
  const medido = useRef(false);
  const [vuelo, setVuelo] = useState<Vuelo | null>(null);
  useLayoutEffect(() => {
    // Una sola medición: en StrictMode el efecto se repite y la carta ya podría estar animándose.
    if (entrada !== "repartir" || medido.current || caja.current === null) return;
    medido.current = true;
    setVuelo(calcularVuelo(origen?.current?.getBoundingClientRect() ?? null, caja.current.getBoundingClientRect()));
  }, [entrada, origen]);
  return [caja, vuelo];
}

/**
 * Dibuja una carta: vuela desde el zapato boca abajo y se descubre (o solo se voltea).
 * @param props - Carta del snapshot, tamaño, animación de entrada y retraso.
 * @returns Elemento de la carta con etiqueta accesible ("A de picas", "carta oculta").
 */
export function Carta({ carta, tamano = "normal", entrada = "repartir", retrasoMs = 0 }: PropsCarta): ReactNode {
  const medidas = MEDIDAS[tamano];
  const [caja, vuelo] = useVuelo(entrada);
  const retraso: CSSProperties = { animationDelay: `${retrasoMs}ms` };
  const estiloVuelo: CSSProperties =
    vuelo === null ? {} : ({ ...retraso, "--desde-x": `${vuelo.x}px`, "--desde-y": `${vuelo.y}px` } as CSSProperties);
  const claseVuelo = vuelo === null ? "" : "animate-volar-carta";

  if ("oculta" in carta) {
    return (
      <div
        ref={caja}
        role="img"
        aria-label="carta oculta"
        className={`${medidas.caja} ${medidas.radio} ${CLASES_REVERSO} ${claseVuelo} relative shrink-0`}
        style={{ ...ESTILO_REVERSO, ...estiloVuelo }}
      />
    );
  }
  const color = carta.palo === "♥" || carta.palo === "♦" ? "text-red-600" : "text-slate-900";
  const esquina = (
    <span className={`flex flex-col items-center leading-none font-bold ${medidas.esquina}`}>
      <span>{carta.rango}</span>
      <span>{carta.palo}</span>
    </span>
  );
  return (
    <div
      ref={caja}
      role="img"
      aria-label={`${carta.rango} de ${NOMBRE_PALO[carta.palo]}`}
      className={`${medidas.caja} ${claseVuelo} carta-3d shrink-0 select-none`}
      style={estiloVuelo}
    >
      <div className={`carta-interior ${CLASE_VUELTA[entrada]}`} style={retraso}>
        <div aria-hidden="true" className={`carta-cara ${medidas.radio} ${color} border border-slate-300 bg-white shadow-md`}>
          <span className="absolute top-0.5 left-1">{esquina}</span>
          <span className={`absolute inset-0 flex items-center justify-center ${medidas.centro}`}>{carta.palo}</span>
          <span className="absolute right-1 bottom-0.5 rotate-180">{esquina}</span>
        </div>
        <div aria-hidden="true" className={`carta-cara carta-reverso ${medidas.radio} ${CLASES_REVERSO}`} style={ESTILO_REVERSO} />
      </div>
    </div>
  );
}

/** Cómo se pinta el total: normal, pasado (rojo) o blackjack (dorado). */
export type TonoTotal = "normal" | "pasado" | "blackjack";

/** Colores del total por tono. */
const CLASE_TONO_TOTAL: Record<TonoTotal, string> = {
  normal: "bg-emerald-950 text-white ring-white/80",
  pasado: "bg-red-600 text-white ring-red-200",
  blackjack: "bg-amber-400 text-emerald-950 ring-amber-100",
};
/** Medidas del total por tamaño de carta. */
const MEDIDA_TOTAL: Record<TamanoCarta, string> = {
  normal: "-top-3 -right-3 h-7 min-w-7 px-1.5 text-sm",
  chica: "-top-2.5 -right-2.5 h-5 min-w-5 px-1 text-[11px]",
};

/** Props del total. */
interface PropsTotalMano {
  /** Total; `null` se muestra como "?" (el dealer con carta oculta). */
  total: number | null;
  tamano: TamanoCarta;
  tono?: TonoTotal;
  /** Texto para lectores de pantalla (p. ej. "total del dealer"). */
  etiqueta: string;
  /** Retraso de salida de la última carta: el total espera a que llegue y se descubra. */
  retrasoUltimaMs?: number;
}

/**
 * Total de la mano en la esquina superior derecha de la última carta. Aparece con un rebote
 * cuando la carta nueva ya llegó y se descubrió, para no adelantar el resultado.
 * Se usa dentro de un contenedor `relative` cuyo borde derecho es el de la última carta, con
 * `key={total}` para que cada total nuevo sea un elemento nuevo y la animación se repita.
 * @param props - Total, tamaño, tono y etiqueta accesible.
 * @returns Insignia redonda con el total.
 */
export function TotalMano({ total, tamano, tono = "normal", etiqueta, retrasoUltimaMs = 0 }: PropsTotalMano): ReactNode {
  return (
    <span
      style={{ animationDelay: `${retrasoUltimaMs + ESPERA_TOTAL_MS}ms` }}
      aria-label={`${etiqueta}: ${total ?? "desconocido"}`}
      className={`absolute z-10 flex animate-total items-center justify-center rounded-full font-black tabular-nums shadow-md ring-2 ${MEDIDA_TOTAL[tamano]} ${CLASE_TONO_TOTAL[tono]}`}
    >
      {total ?? "?"}
    </span>
  );
}

/** Props de una mano (fila de cartas encimadas). */
interface PropsMano {
  cartas: CartaVista[];
  tamano?: TamanoCarta;
  /** Total a mostrar sobre la última carta; si se omite no se muestra. */
  total?: number | null;
  tonoTotal?: TonoTotal;
  /** Turno de esta mano en el reparto inicial y cuántas manos lo reciben (ver `retrasoReparto`). */
  reparto?: { orden: number; participantes: number };
}

/**
 * Cartas encimadas como en una mesa real; cada carta nueva queda encima de la anterior y el
 * total va en la esquina superior derecha de la última.
 * @param props - Cartas, tamaño, total opcional y turno de reparto.
 * @returns Fila de cartas, o nada si no hay cartas.
 */
export function Mano({ cartas, tamano = "normal", total, tonoTotal = "normal", reparto = { orden: 0, participantes: 1 } }: PropsMano): ReactNode {
  if (cartas.length === 0) return null;
  const retraso = (posicion: number) => retrasoReparto(posicion, reparto.orden, reparto.participantes);
  const encimado = tamano === "normal" ? "-space-x-7" : "-space-x-5";
  return (
    <div className={`relative flex ${encimado}`}>
      {cartas.map((carta, posicion) => (
        // El orden de las cartas no cambia dentro de una ronda: la posición es una clave estable.
        <Carta key={posicion} carta={carta} tamano={tamano} retrasoMs={retraso(posicion)} />
      ))}
      {total !== undefined && (
        <TotalMano
          key={total ?? "?"}
          total={total}
          tamano={tamano}
          tono={tonoTotal}
          etiqueta="total de la mano"
          retrasoUltimaMs={retraso(cartas.length - 1)}
        />
      )}
    </div>
  );
}
