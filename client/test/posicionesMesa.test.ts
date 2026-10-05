/** Pruebas de la geometría de la mesa dibujada. */
import { describe, expect, test } from "bun:test";
import { INDICES_ASIENTO, PANO, posicionAsiento } from "../src/components/posicionesMesa";

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
