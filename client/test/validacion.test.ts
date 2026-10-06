/** Pruebas de las validaciones de formularios (apuesta, compra y credenciales). */
import { describe, expect, test } from "bun:test";
import { validarCredenciales } from "../src/screens/PantallaAcceso";
import { LIMITES_CANTIDAD } from "@blackjack/shared";
import { VALORES_FICHA_APUESTA, leerEntero, sumarFicha, validarApuesta, validarCompra } from "../src/state/validacion";
import { BILLETERA } from "./apoyo";

describe("leerEntero", () => {
  test("acepta solo números decimales simples", () => {
    expect(leerEntero(" 100 ")).toBe(100);
    expect(leerEntero("10.5")).toBe(10.5);
    expect(leerEntero("-10")).toBe(-10);
    for (const raro of ["", "abc", "1e3", "0x10", "1 0", "Infinity", "NaN", "10,5"]) expect(leerEntero(raro)).toBeNull();
  });
});

describe("validarApuesta", () => {
  test("rechaza 0, -10, 10.5, 15, 600, abc y 1e3 (casos del checklist)", () => {
    for (const texto of ["0", "-10", "10.5", "15", "600", "abc", "1e3", ""]) {
      expect(validarApuesta(texto, 10_000).ok).toBe(false);
    }
  });
  test("acepta 10 y 500", () => {
    expect(validarApuesta("10", 500)).toEqual({ ok: true, cantidad: 10 });
    expect(validarApuesta("500", 500)).toEqual({ ok: true, cantidad: 500 });
  });
  test("rechaza apostar más fichas de las que tienes, con motivo", () => {
    expect(validarApuesta("100", 50)).toEqual({ ok: false, motivo: "Solo tienes 50 fichas." });
  });
});

describe("validarCompra", () => {
  test("rechaza 0, negativos, decimales, no múltiplos y 1e9", () => {
    for (const texto of ["0", "-10", "10.5", "15", "1000000000", "abc"]) {
      expect(validarCompra(texto, BILLETERA).ok).toBe(false);
    }
  });
  test("acepta hasta lo disponible hoy", () => {
    expect(validarCompra("5000", BILLETERA)).toEqual({ ok: true, cantidad: 5000 });
  });
  test("explica el límite y la hora de reinicio", () => {
    const casiLlena = { ...BILLETERA, compradoHoy: 4990, disponibleHoy: 10 };
    const resultado = validarCompra("100", casiLlena);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toContain("Hoy solo puedes comprar 10 fichas más");
    const agotada = { ...BILLETERA, compradoHoy: 5000, disponibleHoy: 0 };
    const sinCupo = validarCompra("10", agotada);
    expect(sinCupo.ok).toBe(false);
    if (!sinCupo.ok) expect(sinCupo.motivo).toContain("Alcanzaste el límite diario de 5000 fichas; se reinicia a las");
  });
});

describe("validarCredenciales", () => {
  test("acepta usuario y contraseña válidos", () => {
    expect(validarCredenciales("registro", "nahum_1", "secreta")).toEqual({});
  });
  test("rechaza usuario de 2 letras, con espacios o emojis y contraseña corta", () => {
    expect(validarCredenciales("registro", "ab", "secreta").usuario).toBeDefined();
    expect(validarCredenciales("registro", "con espacio", "secreta").usuario).toBeDefined();
    expect(validarCredenciales("registro", "gato🐱", "secreta").usuario).toBeDefined();
    expect(validarCredenciales("login", "nahum", "12345").contrasena).toBeDefined();
  });
});

describe("sumarFicha", () => {
  test("suma la ficha a la apuesta escrita", () => {
    expect(sumarFicha("10", 50, 1000)).toBe(60);
    expect(sumarFicha("100", 100, 1000)).toBe(200);
  });

  test("un texto vacío o inválido empieza de 0", () => {
    expect(sumarFicha("", 50, 1000)).toBe(50);
    expect(sumarFicha("abc", 10, 1000)).toBe(10);
    expect(sumarFicha("15", 10, 1000)).toBe(10);
    expect(sumarFicha("-10", 10, 1000)).toBe(10);
  });

  test("no pasa del máximo del contrato ni de las fichas disponibles", () => {
    expect(sumarFicha("400", 500, 10_000)).toBe(LIMITES_CANTIDAD.apuestaMax);
    expect(sumarFicha("100", 500, 255)).toBe(250);
    expect(sumarFicha(String(LIMITES_CANTIDAD.apuestaMax), 10, 10_000)).toBeNull();
  });

  test("sin fichas suficientes para la apuesta mínima no suma", () => {
    expect(sumarFicha("", 10, 5)).toBeNull();
  });

  test("las fichas del selector son todas apuestas válidas", () => {
    for (const valor of VALORES_FICHA_APUESTA) expect(validarApuesta(String(valor), 10_000).ok).toBe(true);
  });
});
