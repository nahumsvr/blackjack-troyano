/**
 * Utilidades de animación compartidas por los componentes: preferencia de "reducir movimiento",
 * montaje con animación de salida, conteo animado de números y el ritmo del reparto de cartas.
 * Las funciones puras (`suavizarSalida`, `valorConteo`, `retrasoReparto`) se prueban en
 * `test/movimiento.test.ts`.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

/** Tiempo entre carta y carta durante el reparto inicial. */
export const INTERVALO_REPARTO_MS = 120;
/** Espera del total desde que sale su última carta: vuelo más vuelta, para no adelantar el valor. */
export const ESPERA_TOTAL_MS = 800;

/**
 * Retraso de salida de una carta para que el reparto inicial se vea como en un casino: una carta
 * a cada jugador de izquierda a derecha, luego al dealer, y después la segunda vuelta.
 * Las cartas pedidas después (posición 2 en adelante) salen de inmediato.
 * @param posicion - Posición de la carta en la mano (0 = primera).
 * @param orden - Turno de reparto de esa mano (0 = primer jugador por la izquierda; el dealer es el último).
 * @param participantes - Manos que reciben cartas en el reparto (jugadores con cartas + dealer).
 * @returns Retraso en ms.
 */
export function retrasoReparto(posicion: number, orden: number, participantes: number): number {
  if (posicion > 1) return 0;
  return (posicion * participantes + orden) * INTERVALO_REPARTO_MS;
}

/** Consulta CSS de la preferencia del sistema operativo. */
const CONSULTA_MENOS_MOVIMIENTO = "(prefers-reduced-motion: reduce)";

/**
 * Curva "ease-out cúbica": arranca rápido y frena al final, como un contador que se asienta.
 * @param progreso - Avance lineal entre 0 y 1 (se recorta a ese rango).
 * @returns Avance suavizado entre 0 y 1.
 */
export function suavizarSalida(progreso: number): number {
  const p = Math.min(1, Math.max(0, progreso));
  return 1 - (1 - p) ** 3;
}

/**
 * Valor que muestra un contador animado en un instante dado.
 * @param objetivo - Número final (entero).
 * @param transcurridoMs - Tiempo desde que debía empezar el conteo (negativo = aún no empieza).
 * @param duracionMs - Duración total del conteo.
 * @returns Entero entre 0 y `objetivo`.
 */
export function valorConteo(objetivo: number, transcurridoMs: number, duracionMs: number): number {
  if (duracionMs <= 0) return objetivo;
  return Math.round(objetivo * suavizarSalida(transcurridoMs / duracionMs));
}

/**
 * Se suscribe a los cambios de la preferencia de movimiento.
 * @param alCambiar - Callback de React.
 * @returns Función para cancelar la suscripción.
 */
function suscribirMovimiento(alCambiar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_MENOS_MOVIMIENTO);
  consulta.addEventListener("change", alCambiar);
  return () => consulta.removeEventListener("change", alCambiar);
}

/**
 * Indica si el usuario pidió reducir el movimiento en su sistema operativo.
 * El CSS ya acorta las animaciones; este hook sirve a la lógica en JS (p. ej. los contadores).
 * @returns `true` si se deben evitar las animaciones.
 */
export function usePrefiereMenosMovimiento(): boolean {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia(CONSULTA_MENOS_MOVIMIENTO).matches,
    () => false,
  );
}

/** Estado de un elemento que entra y sale con animación. */
export interface Presencia {
  /** Debe estar en el DOM (visible o terminando de salir). */
  montado: boolean;
  /** Está reproduciendo la animación de salida. */
  saliendo: boolean;
}

/**
 * Mantiene montado un elemento mientras reproduce su animación de salida.
 * Se usa un temporizador y no `animationend` porque con "reducir movimiento" la animación
 * puede no dispararse, y el elemento se quedaría montado para siempre.
 * @param visible - Si el elemento debería verse.
 * @param salidaMs - Duración de la animación de salida.
 * @returns Si está montado y si está saliendo.
 */
export function usePresencia(visible: boolean, salidaMs: number): Presencia {
  const [montado, setMontado] = useState(visible);
  // Ajuste durante el render (patrón recomendado por React para estado derivado): entra sin esperar un efecto.
  if (visible && !montado) setMontado(true);
  useEffect(() => {
    if (visible || !montado) return;
    const temporizador = setTimeout(() => setMontado(false), salidaMs);
    return () => clearTimeout(temporizador);
  }, [visible, montado, salidaMs]);
  return { montado: montado || visible, saliendo: montado && !visible };
}

/**
 * Cuenta animada de 0 hasta `objetivo` (con "reducir movimiento" muestra el valor final de inmediato).
 * @param objetivo - Número final.
 * @param duracionMs - Duración del conteo.
 * @param retrasoMs - Espera antes de empezar (p. ej. hasta que termine de entrar la tarjeta).
 * @returns Valor a mostrar en este cuadro.
 */
export function useConteo(objetivo: number, duracionMs: number, retrasoMs = 0): number {
  const menosMovimiento = usePrefiereMenosMovimiento();
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (menosMovimiento) return;
    const inicio = performance.now() + retrasoMs;
    let cuadro = 0;
    const avanzar = (ahora: number) => {
      const transcurrido = ahora - inicio;
      setValor(valorConteo(objetivo, transcurrido, duracionMs));
      if (transcurrido < duracionMs) cuadro = requestAnimationFrame(avanzar);
    };
    cuadro = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(cuadro);
  }, [objetivo, duracionMs, retrasoMs, menosMovimiento]);
  return menosMovimiento ? objetivo : valor;
}
