/** T-17: prioridades de blackjack y pagos enteros sin mutaciones ni efectos económicos. */
import { expect, test } from "bun:test";
import { ErrorJuego, LIMITES_CANTIDAD, type CartaVisible, type Resultado } from "@blackjack/shared";
import { PAGO_BLACKJACK_DENOMINADOR, PAGO_BLACKJACK_NUMERADOR } from "../src/config";
import { Carta } from "../src/game/Carta";
import { Mano } from "../src/game/Mano";
import { resolver } from "../src/game/reglas";

function mano(rangos: CartaVisible["rango"][]): Mano { return new Mano(rangos.map((rango) => new Carta("♠", rango))); }

for (const caso of [
  { jugador: ["A", "K"], dealer: ["10", "9"], resultado: "blackjack", pago: 25 },
  { jugador: ["10", "9"], dealer: ["10", "8"], resultado: "gana", pago: 20 },
  { jugador: ["10", "9"], dealer: ["K", "9"], resultado: "empate", pago: 10 },
  { jugador: ["10", "8"], dealer: ["10", "9"], resultado: "pierde", pago: 0 },
  { jugador: ["A", "K"], dealer: ["A", "Q"], resultado: "empate", pago: 10 },
  { jugador: ["10", "K", "2"], dealer: ["10", "K", "3"], resultado: "pasado", pago: 0 },
  { jugador: ["7", "7", "7"], dealer: ["A", "K"], resultado: "pierde", pago: 0 },
  { jugador: ["A", "K"], dealer: ["7", "7", "7"], resultado: "blackjack", pago: 25 },
  { jugador: ["7", "7", "7"], dealer: ["10", "Q"], resultado: "gana", pago: 20 },
  { jugador: ["10", "8"], dealer: ["10", "K", "2"], resultado: "gana", pago: 20 },
  { jugador: ["7", "7", "7"], dealer: ["10", "5", "6"], resultado: "empate", pago: 10 },
  { jugador: ["A", "K", "2", "K"], dealer: ["A", "Q"], resultado: "pasado", pago: 0 },
] satisfies { jugador: CartaVisible["rango"][]; dealer: CartaVisible["rango"][]; resultado: Resultado; pago: number }[]) {
  test(`${caso.jugador.join("+")} vs ${caso.dealer.join("+")} → ${caso.resultado}`, () => {
    const jugador = mano(caso.jugador);
    const dealer = mano(caso.dealer);
    const antes = structuredClone([jugador.cartas, dealer.cartas]);
    expect(resolver(jugador, dealer, 10)).toEqual({ resultado: caso.resultado, pago: caso.pago });
    expect([jugador.cartas, dealer.cartas]).toEqual(antes);
  });
}

test("todas las apuestas permitidas producen pagos naturales enteros", () => {
  expect((LIMITES_CANTIDAD.multiplo * PAGO_BLACKJACK_NUMERADOR) % PAGO_BLACKJACK_DENOMINADOR).toBe(0);
  for (let apuesta = LIMITES_CANTIDAD.apuestaMin; apuesta <= LIMITES_CANTIDAD.apuestaMax; apuesta += LIMITES_CANTIDAD.multiplo) {
    expect(resolver(mano(["A", "K"]), mano(["10", "9"]), apuesta)).toEqual({ resultado: "blackjack", pago: apuesta * 2.5 });
    expect(Number.isInteger(resolver(mano(["A", "K"]), mano(["10", "9"]), apuesta).pago)).toBe(true);
  }
});

test("rechaza apuestas inválidas incluso si se invoca sin el enrutador", () => {
  for (const apuesta of [0, -10, 10.5, 15, 600, NaN, Infinity]) {
    expect(() => resolver(mano(["A", "K"]), mano(["10", "9"]), apuesta)).toThrow(new ErrorJuego("CANTIDAD_INVALIDA"));
  }
});

test("X-1 liquida empate, pérdida y 21 doblado usando el total comprometido", () => {
  expect(resolver(mano(["10", "8", "2"]), mano(["K", "Q"]), 1000, true)).toEqual({ resultado: "empate", pago: 1000 });
  expect(resolver(mano(["10", "6", "2"]), mano(["K", "Q"]), 1000, true)).toEqual({ resultado: "pierde", pago: 0 });
  expect(resolver(mano(["10", "9", "2"]), mano(["A", "K"]), 1000, true)).toEqual({ resultado: "pierde", pago: 0 });
  for (const apuesta of [10, 30, 1020]) {
    expect(() => resolver(mano(["10", "9", "2"]), mano(["10", "7"]), apuesta, true)).toThrow(new ErrorJuego("CANTIDAD_INVALIDA"));
  }
  expect(() => resolver(mano(["A", "K"]), mano(["10", "7"]), 1000, true)).toThrow(new ErrorJuego("CANTIDAD_INVALIDA"));
});
