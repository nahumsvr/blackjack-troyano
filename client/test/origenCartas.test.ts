/** Pruebas del cálculo del vuelo de las cartas desde el zapato del dealer. */
import { describe, expect, test } from "bun:test";
import { VUELO_SIN_ORIGEN, calcularVuelo } from "../src/components/origenCartas";

describe("calcularVuelo", () => {
  test("parte del centro del zapato hacia el centro del lugar final", () => {
    const zapato = { left: 600, top: 100, width: 56, height: 80 };
    const destino = { left: 380, top: 400, width: 40, height: 56 };
    // Centros: zapato (628, 140), carta (400, 428).
    expect(calcularVuelo(zapato, destino)).toEqual({ x: 228, y: -288 });
  });

  test("una carta que ya está sobre el zapato no se mueve", () => {
    const caja = { left: 10, top: 20, width: 56, height: 80 };
    expect(calcularVuelo(caja, caja)).toEqual({ x: 0, y: 0 });
  });

  test("sin zapato (fuera de la mesa) solo cae un poco", () => {
    expect(calcularVuelo(null, { left: 0, top: 0, width: 40, height: 56 })).toEqual(VUELO_SIN_ORIGEN);
  });
});
