/**
 * Pruebas de la presentación del resultado: cada resultado del contrato tiene textos y tono,
 * el neto se calcula bien y las partículas son deterministas y solo acompañan a victoria y empate.
 */
import { describe, expect, test } from "bun:test";
import { ResultadoSchema } from "@blackjack/shared";
import {
  PRESENTACION_RESULTADO,
  crearAleatorio,
  generarFichasVolando,
  generarParticulas,
  netoResultado,
  semillaDeTexto,
} from "../src/components/efectosResultado";

describe("presentación", () => {
  test("cada resultado del contrato tiene título, ícono y frase", () => {
    for (const resultado of ResultadoSchema.options) {
      const presentacion = PRESENTACION_RESULTADO[resultado];
      expect(presentacion.titulo.length).toBeGreaterThan(0);
      expect(presentacion.icono.length).toBeGreaterThan(0);
      expect(presentacion.frase.length).toBeGreaterThan(0);
    }
  });

  test("tono acorde a cada resultado", () => {
    expect(PRESENTACION_RESULTADO.blackjack.tono).toBe("victoria");
    expect(PRESENTACION_RESULTADO.gana.tono).toBe("victoria");
    expect(PRESENTACION_RESULTADO.empate.tono).toBe("empate");
    expect(PRESENTACION_RESULTADO.pierde.tono).toBe("derrota");
    expect(PRESENTACION_RESULTADO.pasado.tono).toBe("derrota");
  });

  test("neto = pago − apuesta", () => {
    expect(netoResultado(100, 250)).toBe(150);
    expect(netoResultado(100, 100)).toBe(0);
    expect(netoResultado(100, 0)).toBe(-100);
  });
});

describe("partículas", () => {
  const semilla = semillaDeTexto("6f1c2b7e-0d4a-4c8e-9b1a-2e3f4a5b6c7d");

  test("misma ronda → mismas partículas (todas las laptops ven lo mismo)", () => {
    expect(generarParticulas("gana", semilla)).toEqual(generarParticulas("gana", semilla));
    expect(generarParticulas("gana", semilla)).not.toEqual(generarParticulas("gana", semilla + 1));
  });

  test("el blackjack celebra más que una victoria normal; la derrota no celebra", () => {
    expect(generarParticulas("blackjack", semilla).length).toBeGreaterThan(generarParticulas("gana", semilla).length);
    expect(generarParticulas("empate", semilla).length).toBeGreaterThan(0);
    expect(generarParticulas("pierde", semilla)).toEqual([]);
    expect(generarParticulas("pasado", semilla)).toEqual([]);
  });

  test("valores válidos para CSS", () => {
    for (const particula of generarParticulas("blackjack", semilla)) {
      expect(Number.isInteger(particula.dx) && Number.isInteger(particula.dy)).toBe(true);
      expect(particula.retrasoMs).toBeGreaterThanOrEqual(0);
      expect(particula.ancho).toBeGreaterThan(0);
      expect(particula.alto).toBeGreaterThan(0);
      expect(particula.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  test("el generador queda en [0, 1)", () => {
    const azar = crearAleatorio(42);
    for (let i = 0; i < 1000; i++) {
      const valor = azar();
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    }
  });
});

describe("fichas volando", () => {
  const semilla = semillaDeTexto("ronda-de-prueba");

  test("solo al ganar, y más con blackjack", () => {
    expect(generarFichasVolando("blackjack", semilla).length).toBeGreaterThan(generarFichasVolando("gana", semilla).length);
    expect(generarFichasVolando("gana", semilla).length).toBeGreaterThan(0);
    for (const resultado of ["empate", "pierde", "pasado"] as const) expect(generarFichasVolando(resultado, semilla)).toEqual([]);
  });

  test("deterministas y saliendo hacia arriba o a los lados (nunca hacia abajo al despegar)", () => {
    expect(generarFichasVolando("gana", semilla)).toEqual(generarFichasVolando("gana", semilla));
    for (const ficha of generarFichasVolando("blackjack", semilla)) {
      expect(ficha.dy).toBeLessThanOrEqual(Math.round(Math.sin((10 * Math.PI) / 180) * 440) + 1);
      expect(ficha.ancho).toBeGreaterThan(0);
      expect(ficha.giroMs).toBeGreaterThan(0);
      expect([10, 50, 100, 500]).toContain(ficha.valor);
    }
  });
});
