/** Pruebas de la sincronización con el reloj del servidor. */
import { describe, expect, test } from "bun:test";
import { calcularDesfase, msRestantes } from "../src/net/reloj";

describe("calcularDesfase", () => {
  test("servidor adelantado 5 s con 200 ms de ida y vuelta", () => {
    // Local envía en 1000 y recibe en 1200; el servidor respondió a la mitad (local 1100) con 6100.
    expect(calcularDesfase(1000, 1200, 6100)).toBe(5000);
  });
  test("servidor atrasado da desfase negativo", () => {
    expect(calcularDesfase(10_000, 10_100, 7050)).toBe(-3000);
  });
});

describe("msRestantes", () => {
  test("sin reloj devuelve null", () => {
    expect(msRestantes(null, 1000, 0)).toBeNull();
  });
  test("aplica el desfase: dos laptops con horas distintas ven lo mismo", () => {
    const finEn = 20_000; // hora del servidor
    const laptopA = msRestantes(finEn, 10_000, 0); // reloj igual al servidor
    const laptopB = msRestantes(finEn, 7_000, 3_000); // reloj 3 s atrasado
    expect(laptopA).toBe(10_000);
    expect(laptopB).toBe(10_000);
  });
  test("nunca es negativo", () => {
    expect(msRestantes(1000, 5000, 0)).toBe(0);
  });
});
