/** Pruebas de la baraja del muestrario de cartas. */
import { CartaVisibleSchema } from "@blackjack/shared";
import { describe, expect, test } from "bun:test";
import { baraja52 } from "../src/components/baraja";

describe("baraja52", () => {
  const baraja = baraja52();

  test("tiene 52 cartas distintas y todas cumplen el contrato", () => {
    expect(baraja).toHaveLength(52);
    expect(new Set(baraja.map((carta) => `${carta.rango}${carta.palo}`)).size).toBe(52);
    for (const carta of baraja) expect(CartaVisibleSchema.parse(carta)).toEqual(carta);
  });

  test("hay 13 cartas de cada palo", () => {
    for (const palo of CartaVisibleSchema.shape.palo.options) {
      expect(baraja.filter((carta) => carta.palo === palo)).toHaveLength(13);
    }
  });
});
