/**
 * Carta de la baraja dibujada solo con CSS (sin imágenes externas): esquinas con rango y palo,
 * palo grande al centro, rojo para ♥ ♦. La carta oculta del dealer (`{oculta:true}`) se dibuja
 * con el reverso; su valor nunca llega al cliente antes de la fase DEALER.
 * T-40 podrá pasar el reverso equipado del jugador; por ahora hay un reverso único.
 */
import type { CartaVista, CartaVisible } from "@blackjack/shared";
import type { CSSProperties, ReactNode } from "react";

/** Tamaños disponibles. */
export type TamanoCarta = "normal" | "chica";

/** Nombre hablado de cada palo (para lectores de pantalla). */
const NOMBRE_PALO: Record<CartaVisible["palo"], string> = { "♠": "picas", "♥": "corazones", "♦": "diamantes", "♣": "tréboles" };

/** Clases de cada tamaño: caja, texto de esquina y palo central. */
const MEDIDAS: Record<TamanoCarta, { caja: string; esquina: string; centro: string }> = {
  normal: { caja: "h-20 w-14 rounded-md", esquina: "text-sm", centro: "text-3xl" },
  chica: { caja: "h-14 w-10 rounded", esquina: "text-[10px]", centro: "text-xl" },
};

/** Trama del reverso clásico: rombos con dos franjas diagonales. */
const ESTILO_REVERSO: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px)",
};

/** Props de la carta. */
interface PropsCarta {
  carta: CartaVista;
  tamano?: TamanoCarta;
}

/**
 * Dibuja una carta visible o su reverso.
 * @param props - Carta del snapshot y tamaño.
 * @returns Elemento de la carta con etiqueta accesible ("A de picas", "carta oculta").
 */
export function Carta({ carta, tamano = "normal" }: PropsCarta): ReactNode {
  const medidas = MEDIDAS[tamano];
  if ("oculta" in carta) {
    return (
      <div
        role="img"
        aria-label="carta oculta"
        className={`${medidas.caja} shrink-0 border-2 border-white bg-sky-800 shadow-md`}
        style={ESTILO_REVERSO}
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
      role="img"
      aria-label={`${carta.rango} de ${NOMBRE_PALO[carta.palo]}`}
      className={`${medidas.caja} ${color} relative shrink-0 border border-slate-300 bg-white shadow-md select-none`}
    >
      <span className="absolute top-0.5 left-1">{esquina}</span>
      <span className={`absolute inset-0 flex items-center justify-center ${medidas.centro}`}>{carta.palo}</span>
      <span className="absolute right-1 bottom-0.5 rotate-180">{esquina}</span>
    </div>
  );
}

/** Props de una mano (fila de cartas encimadas). */
interface PropsMano {
  cartas: CartaVista[];
  tamano?: TamanoCarta;
}

/**
 * Cartas encimadas como en una mesa real; cada carta nueva queda encima de la anterior.
 * @param props - Cartas y tamaño.
 * @returns Fila de cartas, o nada si no hay cartas.
 */
export function Mano({ cartas, tamano = "normal" }: PropsMano): ReactNode {
  if (cartas.length === 0) return null;
  const encimado = tamano === "normal" ? "-space-x-7" : "-space-x-5";
  return (
    <div className={`flex ${encimado}`}>
      {cartas.map((carta, posicion) => (
        // El orden de las cartas no cambia dentro de una ronda: la posición es una clave estable.
        <Carta key={posicion} carta={carta} tamano={tamano} />
      ))}
    </div>
  );
}
