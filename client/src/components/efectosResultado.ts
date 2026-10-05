/**
 * Datos de presentación del resultado de la ronda: textos, tono (victoria, empate o derrota) y
 * las partículas de la celebración. Todo es puro y determinista: las partículas salen de un
 * generador pseudoaleatorio sembrado con el `rondaId`, así el render no depende de `Math.random`
 * y todas las laptops ven la misma animación. Se prueba en `test/efectosResultado.test.ts`.
 */
import type { Resultado } from "@blackjack/shared";

/** Tono emocional del resultado; decide colores, efectos y animación del ícono. */
export type TonoResultado = "victoria" | "empate" | "derrota";

/** Cómo se presenta cada resultado. */
export interface PresentacionResultado {
  tono: TonoResultado;
  titulo: string;
  /** Emoji grande (decorativo; el título ya lo dice en texto). */
  icono: string;
  /** Frase de ánimo acorde al resultado. */
  frase: string;
}

/** Presentación de cada resultado posible del contrato. */
export const PRESENTACION_RESULTADO: Record<Resultado, PresentacionResultado> = {
  blackjack: { tono: "victoria", titulo: "¡Blackjack!", icono: "🃏", frase: "¡Mano perfecta! El blackjack paga 3 a 2." },
  gana: { tono: "victoria", titulo: "¡Ganaste!", icono: "🏆", frase: "Le ganaste al dealer. ¡Sigue así!" },
  empate: { tono: "empate", titulo: "Empate", icono: "🤝", frase: "Nadie pierde esta vez. ¡La próxima es tuya!" },
  pierde: { tono: "derrota", titulo: "Perdiste", icono: "😮‍💨", frase: "Esta vez ganó la casa. La siguiente mano empieza de cero." },
  pasado: { tono: "derrota", titulo: "Te pasaste", icono: "💥", frase: "Superaste 21. A la próxima, plántate a tiempo." },
};

/**
 * Ganancia o pérdida neta de la ronda.
 * @param apuesta - Fichas apostadas.
 * @param pago - Fichas devueltas por el servidor (incluye la apuesta si no se perdió).
 * @returns `pago - apuesta` (positivo al ganar, 0 al empatar, negativo al perder).
 */
export function netoResultado(apuesta: number, pago: number): number {
  return pago - apuesta;
}

/** Una partícula de confeti o chispa, con sus valores ya resueltos para CSS. */
export interface Particula {
  /** Desplazamiento horizontal final del estallido, en px. */
  dx: number;
  /** Desplazamiento vertical final del estallido, en px (negativo = hacia arriba). */
  dy: number;
  /** Giro total en grados. */
  giro: number;
  retrasoMs: number;
  color: string;
  ancho: number;
  alto: number;
  /** Radio del borde (CSS): círculo o rectángulo. */
  radio: string;
}

/** Parámetros de un efecto de partículas. */
interface ConfigParticulas {
  cantidad: number;
  paleta: readonly string[];
  distanciaMin: number;
  distanciaMax: number;
  /** Retraso máximo de salida, para que no salgan todas en el mismo cuadro. */
  retrasoMaxMs: number;
  /** Empuje hacia arriba, en px (el confeti "sube" antes de caer). */
  empujeArriba: number;
}

/** Colores del confeti: oro, esmeralda, rosa y cielo, sobre el paño verde. */
const PALETA_FIESTA = ["#fde047", "#f59e0b", "#34d399", "#f472b6", "#38bdf8", "#ffffff"] as const;
/** Colores de las chispas del empate: azules y blanco, más tranquilos. */
const PALETA_CHISPAS = ["#bae6fd", "#7dd3fc", "#e0f2fe", "#ffffff"] as const;

/** Efecto de partículas de cada resultado; la derrota no lleva (sería celebrar una pérdida). */
const EFECTO_PARTICULAS: Record<Resultado, ConfigParticulas | null> = {
  blackjack: { cantidad: 80, paleta: PALETA_FIESTA, distanciaMin: 160, distanciaMax: 460, retrasoMaxMs: 500, empujeArriba: 120 },
  gana: { cantidad: 50, paleta: PALETA_FIESTA, distanciaMin: 140, distanciaMax: 380, retrasoMaxMs: 250, empujeArriba: 100 },
  empate: { cantidad: 18, paleta: PALETA_CHISPAS, distanciaMin: 90, distanciaMax: 260, retrasoMaxMs: 2400, empujeArriba: 0 },
  pierde: null,
  pasado: null,
};

/**
 * Hash FNV-1a de 32 bits de un texto, para sembrar el generador.
 * @param texto - Texto cualquiera (p. ej. el `rondaId`).
 * @returns Entero sin signo de 32 bits.
 */
export function semillaDeTexto(texto: string): number {
  // Constantes estándar de FNV-1a (base de desplazamiento y primo de 32 bits).
  let hash = 0x811c9dc5;
  for (const caracter of texto) {
    hash ^= caracter.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Generador pseudoaleatorio mulberry32: rápido, determinista y suficiente para efectos visuales.
 * @param semilla - Entero de 32 bits.
 * @returns Función que devuelve números en [0, 1).
 */
export function crearAleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    // Constantes propias del algoritmo mulberry32.
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Partículas de la celebración de un resultado. Los ángulos se reparten parejo alrededor del
 * centro (con un poco de azar) para que el estallido se vea lleno, no amontonado de un lado.
 * @param resultado - Resultado del jugador.
 * @param semilla - Semilla (normalmente `semillaDeTexto(rondaId)`).
 * @returns Partículas a dibujar; vacío si el resultado no lleva efecto.
 */
export function generarParticulas(resultado: Resultado, semilla: number): Particula[] {
  const efecto = EFECTO_PARTICULAS[resultado];
  if (efecto === null) return [];
  const azar = crearAleatorio(semilla);
  const particulas: Particula[] = [];
  for (let i = 0; i < efecto.cantidad; i++) {
    const angulo = ((i + azar() * 0.8) / efecto.cantidad) * 2 * Math.PI;
    const distancia = efecto.distanciaMin + azar() * (efecto.distanciaMax - efecto.distanciaMin);
    const redonda = azar() < 0.35;
    const ancho = 6 + Math.round(azar() * 6);
    particulas.push({
      dx: Math.round(Math.cos(angulo) * distancia),
      dy: Math.round(Math.sin(angulo) * distancia - efecto.empujeArriba),
      giro: Math.round((azar() * 2 - 1) * 900),
      retrasoMs: Math.round(azar() * efecto.retrasoMaxMs),
      color: efecto.paleta[Math.floor(azar() * efecto.paleta.length)] ?? "#ffffff",
      ancho,
      alto: redonda ? ancho : Math.round(ancho * 0.45),
      radio: redonda ? "9999px" : "2px",
    });
  }
  return particulas;
}

/** Una ficha que sale volando en la celebración. */
export interface FichaVolando {
  dx: number;
  dy: number;
  giro: number;
  retrasoMs: number;
  /** Diámetro en px. */
  ancho: number;
  /** Duración de cada vuelta "de moneda", en ms (distinta por ficha para que no giren sincronizadas). */
  giroMs: number;
  /** Denominación dibujada (decide el color de la ficha). */
  valor: number;
}

/** Denominaciones de las fichas que vuelan (una de cada color de `Ficha`). */
const VALORES_FICHA_VOLANDO = [10, 50, 100, 500] as const;

/** Cuántas fichas vuelan en cada victoria; el resto de resultados no lanza fichas. */
const CANTIDAD_FICHAS_VOLANDO: Partial<Record<Resultado, number>> = { blackjack: 26, gana: 16 };

/**
 * Fichas que salen volando de detrás de la tarjeta al ganar. Salen hacia arriba y a los lados
 * (abanico de 200° centrado arriba) para que se vean "brincar" del premio y luego caen.
 * @param resultado - Resultado del jugador.
 * @param semilla - Semilla (normalmente `semillaDeTexto(rondaId)`); determinista como el confeti.
 * @returns Fichas a dibujar; vacío si el resultado no es una victoria.
 */
export function generarFichasVolando(resultado: Resultado, semilla: number): FichaVolando[] {
  const cantidad = CANTIDAD_FICHAS_VOLANDO[resultado] ?? 0;
  // Semilla distinta a la del confeti para que no repitan trayectorias.
  const azar = crearAleatorio(semilla ^ 0x5bd1e995);
  const fichas: FichaVolando[] = [];
  for (let i = 0; i < cantidad; i++) {
    // Ángulo entre 170° y 370° (pasando por 270° = arriba), repartido parejo con algo de azar.
    const angulo = ((170 + ((i + azar()) / cantidad) * 200) * Math.PI) / 180;
    const distancia = 180 + azar() * 260;
    fichas.push({
      dx: Math.round(Math.cos(angulo) * distancia),
      dy: Math.round(Math.sin(angulo) * distancia),
      giro: Math.round((azar() * 2 - 1) * 540),
      // Dos oleadas: la mitad sale de inmediato y la otra justo después.
      retrasoMs: Math.round((i % 2) * 220 + azar() * 160),
      ancho: 26 + Math.round(azar() * 14),
      giroMs: 380 + Math.round(azar() * 380),
      valor: VALORES_FICHA_VOLANDO[Math.floor(azar() * VALORES_FICHA_VOLANDO.length)] ?? 100,
    });
  }
  return fichas;
}
