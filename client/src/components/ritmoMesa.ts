/**
 * Ritmo de la mesa: el servidor publica los cambios de fase de golpe (reparto, jugada completa del
 * dealer y pagos salen en el mismo instante), así que dibujarlos tal cual haría que todo ocurra
 * a la vez. Este módulo decide cuánto esperar antes de MOSTRAR cada snapshot para que la mesa se
 * vea con calma: pausa antes de repartir, el dealer destapa y saca cartas una a una, y el
 * resultado aparece un rato después de la última carta.
 * Es solo presentación: el estado real sigue siendo el del servidor y las acciones del jugador
 * se validan allí. La lógica es pura (se prueba en `test/ritmoMesa.test.ts`); el hook que la
 * aplica con temporizadores es `useMesaPresentada.ts`.
 */
import type { MesaEstado } from "@blackjack/shared";

/** Pausa desde que se cierran las apuestas hasta que salen las cartas. */
export const ESPERA_REPARTO_MS = 2000;
/** Tiempo para que termine el reparto antes de que el dealer destape (solo si el dealer tiene blackjack). */
export const ESPERA_TRAS_REPARTO_MS = 2500;
/** Pausa entre la última jugada del jugador y el momento en que el dealer destapa su carta. */
export const ESPERA_ANTES_DEALER_MS = 800;
/** Tiempo entre un paso del dealer (destapar, sacar carta) y el siguiente: vuelo + vuelta de la carta. */
export const ESPERA_PASO_DEALER_MS = 1400;
/** Pausa desde que el dealer termina hasta que aparece el resultado de la ronda. */
export const ESPERA_RESULTADO_MS = 1000;
/** Tiempo mínimo que el resultado se queda en pantalla antes de pasar a la siguiente ronda. */
export const VISTA_RESULTADO_MIN_MS = 3500;

/**
 * Cuánto esperar antes de mostrar un snapshot, dado el que se está mostrando.
 * @param actual - Snapshot que se ve ahora (`null` si aún no hay ninguno: se muestra de inmediato).
 * @param siguiente - Snapshot en espera.
 * @param transcurridoMs - Tiempo que `actual` lleva en pantalla.
 * @returns Espera en ms desde que `actual` se mostró (0 = mostrar ya).
 */
export function retrasoAntesDe(actual: MesaEstado | null, siguiente: MesaEstado, transcurridoMs: number): number {
  if (actual === null || actual.id !== siguiente.id) return 0;
  const pausa = pausaEntre(actual.fase, siguiente.fase);
  return Math.max(0, pausa - transcurridoMs);
}

/**
 * Pausa que corresponde a una transición de fase.
 * @param de - Fase que se ve.
 * @param a - Fase que sigue.
 * @returns Duración mínima, en ms, que `de` debe permanecer en pantalla.
 */
function pausaEntre(de: MesaEstado["fase"], a: MesaEstado["fase"]): number {
  if (de === "APUESTAS" && a === "REPARTO") return ESPERA_REPARTO_MS;
  if (de === "REPARTO" && a === "DEALER") return ESPERA_TRAS_REPARTO_MS;
  if (de === "TURNOS" && a === "DEALER") return ESPERA_ANTES_DEALER_MS;
  // Destapar, cada carta nueva del dealer y el paso a PAGOS: un paso por snapshot.
  if (de === "DEALER" && (a === "DEALER" || a === "PAGOS")) return ESPERA_PASO_DEALER_MS;
  // Pasar de los pagos a la ronda siguiente espera a que el resultado haya podido verse.
  if (de === "PAGOS" && (a === "APUESTAS" || a === "ESPERANDO")) return ESPERA_RESULTADO_MS + VISTA_RESULTADO_MIN_MS;
  return 0;
}
