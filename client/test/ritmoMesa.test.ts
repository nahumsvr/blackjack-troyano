/**
 * Pruebas del ritmo de la mesa: cuánto se espera antes de mostrar cada cambio de fase.
 */
import { describe, expect, test } from "bun:test";
import type { MesaEstado } from "@blackjack/shared";
import {
  ESPERA_ANTES_DEALER_MS,
  ESPERA_PASO_DEALER_MS,
  ESPERA_REPARTO_MS,
  ESPERA_RESULTADO_MS,
  ESPERA_TRAS_REPARTO_MS,
  VISTA_RESULTADO_MIN_MS,
  retrasoAntesDe,
} from "../src/components/ritmoMesa";

/** Snapshot mínimo en la fase pedida. */
function mesa(fase: MesaEstado["fase"], id = "mesa-1"): MesaEstado {
  return { id, nombre: id, fase, finEn: null, turnoDe: null, dealer: { cartas: [], total: null }, asientos: [] } as unknown as MesaEstado;
}

describe("retrasoAntesDe", () => {
  test("sin snapshot previo o en otra mesa se muestra de inmediato", () => {
    expect(retrasoAntesDe(null, mesa("REPARTO"), 0)).toBe(0);
    expect(retrasoAntesDe(mesa("APUESTAS", "a"), mesa("REPARTO", "b"), 0)).toBe(0);
  });

  test("espera 2 s antes de repartir", () => {
    expect(retrasoAntesDe(mesa("APUESTAS"), mesa("REPARTO"), 0)).toBe(ESPERA_REPARTO_MS);
    expect(ESPERA_REPARTO_MS).toBe(2000);
  });

  test("descuenta lo que el snapshot actual ya lleva en pantalla", () => {
    expect(retrasoAntesDe(mesa("APUESTAS"), mesa("REPARTO"), 1500)).toBe(500);
    expect(retrasoAntesDe(mesa("APUESTAS"), mesa("REPARTO"), 5000)).toBe(0);
  });

  test("el reparto pasa a los turnos sin pausa", () => {
    expect(retrasoAntesDe(mesa("REPARTO"), mesa("TURNOS"), 0)).toBe(0);
  });

  test("el dealer destapa tras una pausa y cada paso suyo se espacia", () => {
    expect(retrasoAntesDe(mesa("TURNOS"), mesa("DEALER"), 0)).toBe(ESPERA_ANTES_DEALER_MS);
    expect(retrasoAntesDe(mesa("REPARTO"), mesa("DEALER"), 0)).toBe(ESPERA_TRAS_REPARTO_MS);
    expect(retrasoAntesDe(mesa("DEALER"), mesa("DEALER"), 0)).toBe(ESPERA_PASO_DEALER_MS);
    expect(retrasoAntesDe(mesa("DEALER"), mesa("PAGOS"), 0)).toBe(ESPERA_PASO_DEALER_MS);
  });

  test("los pagos no se cortan: la ronda siguiente espera a que el resultado se vea", () => {
    const minimo = ESPERA_RESULTADO_MS + VISTA_RESULTADO_MIN_MS;
    expect(retrasoAntesDe(mesa("PAGOS"), mesa("APUESTAS"), 0)).toBe(minimo);
    expect(retrasoAntesDe(mesa("PAGOS"), mesa("ESPERANDO"), minimo)).toBe(0);
    expect(retrasoAntesDe(mesa("PAGOS"), mesa("PAGOS"), 0)).toBe(0);
  });
});
