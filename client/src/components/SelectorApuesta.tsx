/**
 * Selector de apuesta (T-28): fichas que se tocan para sumar a la apuesta, un campo para
 * escribir la cantidad exacta y el botón Apostar. Valida con el mismo esquema del contrato
 * antes de enviar y explica el motivo cuando no se puede; el servidor vuelve a validar.
 */
import type { ReactNode } from "react";
import { VALORES_FICHA_APUESTA, sumarFicha, type ValidacionCantidad } from "../state/validacion";
import { BotonJuego } from "./BotonJuego";
import { Ficha } from "./Ficha";

/** Props del selector. */
interface PropsSelectorApuesta {
  /** Texto del campo (controlado por la pantalla para conservarlo entre rondas). */
  texto: string;
  alCambiar: (texto: string) => void;
  /** Fichas del usuario según la última `billetera`. */
  fichas: number;
  /** Resultado de validar `texto` (con `validarApuesta`). */
  validacion: ValidacionCantidad;
  /** Se puede apostar ahora (conectado, fase, sin petición pendiente). */
  habilitado: boolean;
  /** Hay una apuesta enviándose. */
  enviando: boolean;
  alApostar: (cantidad: number) => void;
}

/**
 * Fichas para armar la apuesta, campo de cantidad y botón Apostar.
 * @param props - Estado del campo, validación y acciones.
 * @returns Selector de apuesta.
 */
export function SelectorApuesta({ texto, alCambiar, fichas, validacion, habilitado, enviando, alApostar }: PropsSelectorApuesta): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-3" role="group" aria-label="Fichas para sumar a la apuesta">
        {VALORES_FICHA_APUESTA.map((valor) => {
          const siguiente = sumarFicha(texto, valor, fichas);
          return (
            <button
              key={valor}
              type="button"
              aria-label={`Sumar ${valor} a la apuesta`}
              disabled={!habilitado || siguiente === null}
              onClick={() => siguiente !== null && alCambiar(String(siguiente))}
              className="rounded-full transition-transform duration-150 focus-visible:ring-4 focus-visible:ring-white/70 focus-visible:outline-none enabled:hover:-translate-y-1.5 enabled:hover:rotate-6 enabled:active:scale-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Ficha cantidad={valor} tamano="grande" />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          value={texto}
          onChange={(evento) => alCambiar(evento.target.value)}
          aria-label="Fichas a apostar"
          aria-invalid={!validacion.ok}
          aria-describedby="motivo-apuesta"
          className="w-32 rounded-xl border-2 border-amber-400/50 bg-emerald-950 py-2 text-center text-2xl font-black tabular-nums transition-colors focus:border-amber-300 focus:outline-none aria-[invalid=true]:border-red-400/70"
        />
        <button
          type="button"
          onClick={() => alCambiar("")}
          disabled={texto === ""}
          className="rounded-xl border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-800 disabled:opacity-40"
        >
          Limpiar
        </button>
      </div>

      <BotonJuego
        variante="oro"
        icono="●"
        disabled={!habilitado || !validacion.ok}
        onClick={() => validacion.ok && alApostar(validacion.cantidad)}
      >
        {enviando ? "Apostando…" : validacion.ok ? `Apostar ${validacion.cantidad}` : "Apostar"}
      </BotonJuego>
      <p id="motivo-apuesta" aria-live="polite" className="min-h-5 text-sm text-amber-300">
        {validacion.ok ? "" : validacion.motivo}
      </p>
    </div>
  );
}
