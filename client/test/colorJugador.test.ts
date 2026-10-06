/** Pruebas del color de identificación por asiento. */
import { describe, expect, test } from "bun:test";
import { colorDeAsiento } from "../src/components/colorJugador";

const INDICES = [0, 1, 2, 3, 4] as const;

describe("colorDeAsiento", () => {
  test("los 5 asientos tienen colores distintos en todas sus clases", () => {
    const colores = INDICES.map(colorDeAsiento);
    for (const campo of ["nombre", "borde", "texto"] as const) {
      expect(new Set(colores.map((color) => color[campo])).size).toBe(INDICES.length);
    }
  });

  test("el mismo asiento siempre da el mismo color (todas las pantallas coinciden)", () => {
    for (const indice of INDICES) expect(colorDeAsiento(indice)).toEqual(colorDeAsiento(indice));
  });

  test("no usa los tonos reservados de la UI (verde, ámbar, rojo)", () => {
    for (const indice of INDICES) {
      const { borde, texto } = colorDeAsiento(indice);
      expect(`${borde} ${texto}`).not.toMatch(/emerald|green|amber|yellow|red/);
    }
  });
});
