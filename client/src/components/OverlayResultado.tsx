/**
 * Pantalla de resultado de la ronda (T-29), sobre la mesa y con el fondo translúcido para no
 * perder el contexto. La tarjeta entra desde abajo creciendo con un rebote y al cerrarse hace
 * el camino inverso. Cada tono tiene su propio ambiente:
 * - victoria (gana, blackjack): rayos dorados girando, estallido de confeti, fichas que salen
 *   volando girando como monedas, barrido de luz y la ganancia contando hacia arriba;
 * - empate: rayos azules lentos y chispas que suben, con una frase de ánimo;
 * - derrota (pierde, pasado): viñeta rojiza, sin fiesta, el ícono tiembla una vez, la pérdida
 *   "se escurre" hacia abajo y una frase de aliento.
 *
 * Solo dibuja lo que mandó el servidor en `ronda.resultado`; no calcula pagos.
 * Se cierra con "Continuar", Esc o tocando el fondo, y sola cuando empieza la siguiente ronda.
 */
import type { CartaVisible, ResultadoJugador } from "@blackjack/shared";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Mano } from "./Carta";
import {
  PRESENTACION_RESULTADO,
  generarFichasVolando,
  generarParticulas,
  netoResultado,
  semillaDeTexto,
  type TonoResultado,
} from "./efectosResultado";
import { Ficha } from "./Ficha";
import { useConteo, usePresencia } from "./movimiento";

/** Duración de la entrada de la tarjeta, en ms. */
const ENTRADA_MS = 650;
/** Duración de la salida (más corta: al cerrar, el usuario ya quiere volver a la mesa). */
const SALIDA_MS = 380;
/** Duración del conteo de la ganancia. */
const CONTEO_MS = 1100;

/** Clases de la tarjeta, del título y del botón por tono. */
const ESTILO_TONO: Record<TonoResultado, { tarjeta: string; titulo: string; boton: string; detalle: string }> = {
  victoria: {
    tarjeta:
      "resultado-brillo border-4 border-yellow-100 bg-linear-to-b from-amber-200 via-yellow-300 to-amber-500 text-emerald-950 shadow-[0_0_80px_rgb(250_204_21_/_0.65)]",
    titulo: "text-emerald-950 drop-shadow-[0_2px_0_rgb(255_255_255_/_0.6)]",
    boton: "bg-emerald-900 text-amber-200 hover:bg-emerald-800",
    detalle: "text-emerald-900",
  },
  empate: {
    tarjeta: "border-2 border-sky-300/60 bg-linear-to-b from-slate-800 to-sky-950 text-sky-50 shadow-[0_0_60px_rgb(56_189_248_/_0.35)]",
    titulo: "text-sky-200",
    boton: "bg-sky-400 text-slate-950 hover:bg-sky-300",
    detalle: "text-sky-200/80",
  },
  derrota: {
    tarjeta: "border-2 border-red-400/40 bg-linear-to-b from-slate-800 to-slate-950 text-slate-100 shadow-2xl",
    titulo: "text-red-300",
    boton: "bg-slate-200 text-slate-900 hover:bg-white",
    detalle: "text-slate-400",
  },
};

/** Lo que se necesita para dibujar el resultado propio. */
export interface DatosResultado {
  rondaId: string;
  propio: ResultadoJugador;
  dealer: { cartas: CartaVisible[]; total: number };
}

/** Props de la pantalla de resultado. */
interface PropsOverlayResultado {
  /** Resultado a mostrar; se conserva el último durante la animación de salida. */
  datos: DatosResultado | null;
  /** Si debe verse (falso → reproduce la salida y se desmonta). */
  visible: boolean;
  /** El usuario la cerró (Continuar, Esc o fondo). Debe ser estable (`useCallback`). */
  alCerrar: () => void;
}

/**
 * Resultado animado de la ronda.
 * @param props - Datos, visibilidad y cierre.
 * @returns Capa del resultado, o nada si no hay que mostrarla.
 */
export function OverlayResultado({ datos, visible, alCerrar }: PropsOverlayResultado): ReactNode {
  // Se guardan los últimos datos para poder animar la salida aunque el resultado ya se haya borrado del estado.
  const [ultimos, setUltimos] = useState(datos);
  if (datos !== null && datos.rondaId !== ultimos?.rondaId) setUltimos(datos);
  const mostrados = datos ?? ultimos;
  const { montado, saliendo } = usePresencia(visible && mostrados !== null, SALIDA_MS);

  const rondaId = mostrados?.rondaId ?? null;
  const resultado = mostrados?.propio.resultado ?? "empate";
  const presentacion = PRESENTACION_RESULTADO[resultado];
  const neto = mostrados === null ? 0 : netoResultado(mostrados.propio.apuesta, mostrados.propio.pago);
  const conteo = useConteo(presentacion.tono === "victoria" ? neto : 0, CONTEO_MS, ENTRADA_MS * 0.6);
  const particulas = useMemo(() => (rondaId === null ? [] : generarParticulas(resultado, semillaDeTexto(rondaId))), [rondaId, resultado]);
  const fichasVolando = useMemo(
    () => (rondaId === null ? [] : generarFichasVolando(resultado, semillaDeTexto(rondaId))),
    [rondaId, resultado],
  );

  // Foco y teclado: al abrir, el foco va a "Continuar"; al cerrar vuelve a donde estaba.
  const botonContinuar = useRef<HTMLButtonElement>(null);
  const abierto = visible && rondaId !== null;
  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    botonContinuar.current?.focus({ preventScroll: true });
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      if (previo?.isConnected === true) previo.focus({ preventScroll: true });
    };
  }, [abierto, rondaId, alCerrar]);

  if (!montado || mostrados === null) return null;
  const { tono, titulo, icono, frase } = presentacion;
  const estilo = ESTILO_TONO[tono];
  const { apuesta, pago } = mostrados.propio;
  const duraciones = { "--entrada": `${ENTRADA_MS}ms`, "--salida": `${SALIDA_MS}ms` } as CSSProperties;

  return (
    <div
      style={duraciones}
      className={`fixed inset-0 z-[45] flex items-center justify-center p-4 ${saliendo ? "resultado-saliendo pointer-events-none" : ""}`}
    >
      <div aria-hidden="true" onClick={alCerrar} className={`resultado-fondo resultado-fondo-${tono}`} />

      <div aria-hidden="true" className="resultado-efectos efecto-decorativo">
        {tono !== "derrota" && <div className={`resultado-rayos resultado-rayos-${tono}`} />}
        {particulas.map((particula, indice) => (
          <span
            // Las partículas no cambian dentro de una ronda: el índice es una clave estable.
            key={indice}
            className={tono === "empate" ? "resultado-chispa" : "resultado-confeti"}
            style={
              {
                "--dx": `${particula.dx}px`,
                "--dy": `${particula.dy}px`,
                "--giro": `${particula.giro}deg`,
                "--retraso": `${particula.retrasoMs}ms`,
                "--color": particula.color,
                "--ancho": `${particula.ancho}px`,
                "--alto": `${particula.alto}px`,
                "--radio": particula.radio,
              } as CSSProperties
            }
          />
        ))}
        {fichasVolando.map((ficha, indice) => (
          <span
            // Igual que las partículas: fijas durante la ronda.
            key={`ficha-${indice}`}
            className="resultado-ficha"
            style={
              {
                "--dx": `${ficha.dx}px`,
                "--dy": `${ficha.dy}px`,
                "--giro": `${ficha.giro}deg`,
                "--retraso": `${ficha.retrasoMs}ms`,
                "--ancho": `${ficha.ancho}px`,
                "--giro-ms": `${ficha.giroMs}ms`,
              } as CSSProperties
            }
          >
            <Ficha cantidad={ficha.valor} tamano="libre" />
          </span>
        ))}
      </div>

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="resultado-titulo"
        aria-describedby="resultado-frase"
        className={`resultado-tarjeta flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl px-6 py-6 text-center ${estilo.tarjeta}`}
      >
        <span aria-hidden="true" className={`inline-block text-6xl resultado-icono-${tono}`}>
          {icono}
        </span>
        <h2 id="resultado-titulo" className={`text-4xl font-black tracking-tight ${estilo.titulo}`}>
          {titulo}
        </h2>

        {tono === "victoria" && (
          <p className="text-5xl font-black tabular-nums">
            <span className="sr-only">Ganas {neto} fichas</span>
            <span aria-hidden="true">+{conteo.toLocaleString("es-MX")}</span>
            <span aria-hidden="true" className="ml-1 text-lg font-bold">
              fichas
            </span>
          </p>
        )}
        {tono === "empate" && <p className="text-2xl font-black text-sky-100">Recuperas {pago.toLocaleString("es-MX")} fichas</p>}
        {tono === "derrota" && (
          <p className="resultado-perdida text-3xl font-black text-red-300 tabular-nums">−{apuesta.toLocaleString("es-MX")} fichas</p>
        )}

        <p id="resultado-frase" className="text-sm font-medium">
          {frase}
        </p>

        <div className={`mt-1 flex flex-col items-center gap-1 text-xs ${estilo.detalle}`}>
          <span>
            Apostaste {apuesta.toLocaleString("es-MX")} · recibes {pago.toLocaleString("es-MX")}
          </span>
          <span className="flex items-center gap-2">
            Dealer: <strong>{mostrados.dealer.total}</strong>
            <Mano cartas={mostrados.dealer.cartas} tamano="chica" />
          </span>
        </div>

        <button
          ref={botonContinuar}
          type="button"
          onClick={alCerrar}
          className={`mt-3 rounded-full px-6 py-2 font-bold transition-transform active:scale-95 ${estilo.boton}`}
        >
          Continuar
        </button>
      </section>
    </div>
  );
}
