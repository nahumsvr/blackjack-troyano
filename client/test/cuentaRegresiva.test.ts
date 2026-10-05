/**
 * Pruebas de la lógica de la cuenta regresiva animada: fracción restante, nivel de urgencia
 * (verde → ámbar → rojo) y segundos visibles.
 */
import { describe, expect, test } from "bun:test";
import { SEGUNDOS_URGENTES, calcularCuenta, fraccionRestante, nivelUrgencia } from "../src/components/cuentaRegresiva";

describe("fraccionRestante", () => {
  test("proporción entre lo que falta y el total", () => {
    expect(fraccionRestante(15_000, 15_000)).toBe(1);
    expect(fraccionRestante(7_500, 15_000)).toBe(0.5);
    expect(fraccionRestante(0, 15_000)).toBe(0);
  });

  test("se recorta a [0, 1] y no divide entre cero", () => {
    expect(fraccionRestante(20_000, 15_000)).toBe(1);
    expect(fraccionRestante(-5, 15_000)).toBe(0);
    expect(fraccionRestante(1_000, 0)).toBe(0);
  });
});

describe("nivelUrgencia", () => {
  test("calma en la primera mitad, atención después y urgente en los últimos segundos", () => {
    expect(nivelUrgencia(20_000, 20_000)).toBe("calma");
    expect(nivelUrgencia(10_001, 20_000)).toBe("calma");
    expect(nivelUrgencia(10_000, 20_000)).toBe("atencion");
    expect(nivelUrgencia(SEGUNDOS_URGENTES * 1000 + 1, 20_000)).toBe("atencion");
    expect(nivelUrgencia(SEGUNDOS_URGENTES * 1000, 20_000)).toBe("urgente");
    expect(nivelUrgencia(0, 20_000)).toBe("urgente");
  });

  test("una espera corta (p. ej. PAGOS de 5 s) nunca se pinta como urgente", () => {
    expect(nivelUrgencia(1_000, SEGUNDOS_URGENTES * 1000)).toBe("atencion");
    expect(nivelUrgencia(4_000, SEGUNDOS_URGENTES * 1000)).toBe("calma");
  });
});

describe("calcularCuenta", () => {
  test("los segundos se redondean hacia arriba: se ve 1 hasta el último instante", () => {
    expect(calcularCuenta(14_001, 15_000).segundos).toBe(15);
    expect(calcularCuenta(1, 15_000).segundos).toBe(1);
    expect(calcularCuenta(0, 15_000).segundos).toBe(0);
  });

  test("combina fracción y nivel", () => {
    expect(calcularCuenta(3_000, 20_000)).toEqual({ restanteMs: 3_000, totalMs: 20_000, fraccion: 0.15, segundos: 3, nivel: "urgente" });
  });
});
