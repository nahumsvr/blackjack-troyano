/** Pruebas de la geometría de la mesa dibujada. */
import { describe, expect, test } from "bun:test";
import { INDICES_ASIENTO, LUGAR_CENTRAL, PANO, lugarVisual, posicionAsiento } from "../src/components/posicionesMesa";

describe("posicionAsiento", () => {
  const posiciones = INDICES_ASIENTO.map(posicionAsiento);

  test("los asientos van de izquierda a derecha, sin repetirse", () => {
    const xs = posiciones.map((posicion) => posicion.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(new Set(xs).size).toBe(INDICES_ASIENTO.length);
  });

  test("el asiento del medio queda abajo al centro, sobre el borde del paño", () => {
    expect(posicionAsiento(2)).toEqual({ x: 50, y: 100 - PANO.abajo });
  });

  test("la mesa es simétrica: 0 y 4, 1 y 3 son reflejos", () => {
    expect(posicionAsiento(0).x + posicionAsiento(4).x).toBeCloseTo(100, 1);
    expect(posicionAsiento(0).y).toBeCloseTo(posicionAsiento(4).y, 1);
    expect(posicionAsiento(1).x + posicionAsiento(3).x).toBeCloseTo(100, 1);
  });

  test("todos los asientos quedan dentro de la mesa y en la mitad inferior (arriba trabaja el dealer)", () => {
    for (const { x, y } of posiciones) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(50);
      expect(y).toBeLessThanOrEqual(100 - PANO.abajo);
    }
  });
});

describe("lugarVisual", () => {
  test("el asiento propio siempre se dibuja abajo al centro", () => {
    for (const propio of INDICES_ASIENTO) expect(lugarVisual(propio, propio)).toBe(LUGAR_CENTRAL);
  });

  test("es una rotación: cada asiento cae en un lugar distinto y se conserva el orden circular", () => {
    for (const propio of INDICES_ASIENTO) {
      const lugares = INDICES_ASIENTO.map((indice) => lugarVisual(indice, propio));
      expect(new Set(lugares).size).toBe(INDICES_ASIENTO.length);
      for (const indice of INDICES_ASIENTO) {
        const siguiente = ((indice + 1) % INDICES_ASIENTO.length) as (typeof INDICES_ASIENTO)[number];
        expect((lugarVisual(siguiente, propio) - lugarVisual(indice, propio) + 5) % 5).toBe(1);
      }
    }
  });

  test("sin asiento propio (espectador) no se gira nada", () => {
    for (const indice of INDICES_ASIENTO) expect(lugarVisual(indice, null)).toBe(indice);
  });
});
