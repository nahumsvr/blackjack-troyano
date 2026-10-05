/**
 * Pruebas de las funciones puras de animación: la curva de frenado y el contador animado.
 */
import { describe, expect, test } from "bun:test";
import { INTERVALO_REPARTO_MS, retrasoReparto, suavizarSalida, valorConteo } from "../src/components/movimiento";

describe("suavizarSalida", () => {
  test("empieza en 0, termina en 1 y avanza más rápido al principio", () => {
    expect(suavizarSalida(0)).toBe(0);
    expect(suavizarSalida(1)).toBe(1);
    expect(suavizarSalida(0.5)).toBeGreaterThan(0.5);
  });

  test("se recorta fuera de [0, 1]", () => {
    expect(suavizarSalida(-1)).toBe(0);
    expect(suavizarSalida(2)).toBe(1);
  });
});

describe("valorConteo", () => {
  test("cuenta de 0 al objetivo y se queda ahí", () => {
    expect(valorConteo(150, -100, 1000)).toBe(0);
    expect(valorConteo(150, 0, 1000)).toBe(0);
    expect(valorConteo(150, 1000, 1000)).toBe(150);
    expect(valorConteo(150, 5000, 1000)).toBe(150);
  });

  test("siempre entero y sin pasarse", () => {
    for (let t = 0; t <= 1000; t += 37) {
      const valor = valorConteo(150, t, 1000);
      expect(Number.isInteger(valor)).toBe(true);
      expect(valor).toBeLessThanOrEqual(150);
    }
  });

  test("duración no positiva → valor final", () => {
    expect(valorConteo(150, 0, 0)).toBe(150);
  });
});

describe("retrasoReparto", () => {
  test("reparto de casino: una carta a cada mano en orden y luego la segunda vuelta", () => {
    // 3 jugadores + dealer = 4 manos.
    const primeras = [0, 1, 2, 3].map((orden) => retrasoReparto(0, orden, 4));
    const segundas = [0, 1, 2, 3].map((orden) => retrasoReparto(1, orden, 4));
    expect(primeras).toEqual([0, 1, 2, 3].map((paso) => paso * INTERVALO_REPARTO_MS));
    expect(segundas).toEqual([4, 5, 6, 7].map((paso) => paso * INTERVALO_REPARTO_MS));
  });

  test("las cartas pedidas después salen sin esperar", () => {
    expect(retrasoReparto(2, 3, 4)).toBe(0);
    expect(retrasoReparto(5, 0, 4)).toBe(0);
  });
});
