/** T-15: composición, extracción sin reemplazo y umbral exacto del zapato. */
import { describe, expect, test } from "bun:test";
import { ErrorJuego } from "@blackjack/shared";
import { Baraja } from "../src/game/Baraja";
import { Carta } from "../src/game/Carta";

describe("Carta", () => {
  test("As, números y figuras tienen el valor base correcto", () => {
    for (const [rango, valor] of [["A", 1], ["2", 2], ["10", 10], ["J", 10], ["Q", 10], ["K", 10]] as const) {
      expect(new Carta("♠", rango).valorBase()).toBe(valor);
    }
  });
  test("la vista no comparte datos mutables con la carta", () => {
    const carta = new Carta("♥", "A");
    carta.aVista().rango = "K";
    expect(carta.aVista()).toEqual({ palo: "♥", rango: "A" });
    expect(Object.isFrozen(carta)).toBe(true);
  });
});

describe("Baraja", () => {
  test("cada rebarajado contiene 208 instancias y cuatro copias de las 52 vistas", () => {
    const baraja = new Baraja();
    for (let ronda = 0; ronda < 3; ronda++) {
      expect(baraja.restantes).toBe(208);
      const cartas = Array.from({ length: 208 }, () => baraja.sacar());
      expect(new Set(cartas).size).toBe(208);
      const frecuencias = new Map<string, number>();
      for (const carta of cartas) {
        const clave = JSON.stringify(carta.aVista());
        frecuencias.set(clave, (frecuencias.get(clave) ?? 0) + 1);
      }
      expect(frecuencias.size).toBe(52);
      expect([...frecuencias.values()].every((cantidad) => cantidad === 4)).toBe(true);
      expect(baraja.restantes).toBe(0);
      expect(() => baraja.sacar()).toThrow(new ErrorJuego("ERROR_INTERNO"));
      baraja.barajar();
    }
  });
  test("no rebaraja con 52 cartas y sí con 51; repone 208 al barajar", () => {
    const baraja = new Baraja();
    for (let indice = 0; indice < 156; indice++) baraja.sacar();
    expect(baraja.restantes).toBe(52);
    expect(baraja.necesitaRebarajar()).toBe(false);
    baraja.sacar();
    expect(baraja.restantes).toBe(51);
    expect(baraja.necesitaRebarajar()).toBe(true);
    baraja.barajar();
    expect(baraja.restantes).toBe(208);
    expect(baraja.necesitaRebarajar()).toBe(false);
  });
  test("rechaza una configuración de mazos inválida", () => {
    for (const cantidad of [0, -1, 1.5, Infinity]) {
      expect(() => new Baraja(cantidad)).toThrow(new ErrorJuego("ERROR_INTERNO"));
    }
  });
});
