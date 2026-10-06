/** T-16: Ases, blackjack natural, pasadas y regla del dealer en manos deterministas. */
import { describe, expect, test } from "bun:test";
import type { CartaVisible } from "@blackjack/shared";
import { Carta } from "../src/game/Carta";
import { Mano } from "../src/game/Mano";
import { Dealer } from "../src/game/Dealer";

function mano(...rangos: CartaVisible["rango"][]): Mano {
  return new Mano(rangos.map((rango) => new Carta("♠", rango)));
}

describe("Mano", () => {
  for (const caso of [
    { rangos: [], total: 0, blanda: false, blackjack: false, pasada: false },
    { rangos: ["A"], total: 11, blanda: true, blackjack: false, pasada: false },
    { rangos: ["A", "K"], total: 21, blanda: true, blackjack: true, pasada: false },
    { rangos: ["A", "A", "9"], total: 21, blanda: true, blackjack: false, pasada: false },
    { rangos: ["A", "6"], total: 17, blanda: true, blackjack: false, pasada: false },
    { rangos: ["A", "6", "10"], total: 17, blanda: false, blackjack: false, pasada: false },
    { rangos: ["10", "6", "A"], total: 17, blanda: false, blackjack: false, pasada: false },
    { rangos: ["K", "Q", "2"], total: 22, blanda: false, blackjack: false, pasada: true },
    { rangos: ["7", "7", "7"], total: 21, blanda: false, blackjack: false, pasada: false },
    { rangos: ["A", "A", "A", "8"], total: 21, blanda: true, blackjack: false, pasada: false },
    { rangos: ["A", "A", "K", "K"], total: 22, blanda: false, blackjack: false, pasada: true },
    { rangos: ["10", "7"], total: 17, blanda: false, blackjack: false, pasada: false },
  ] satisfies { rangos: CartaVisible["rango"][]; total: number; blanda: boolean; blackjack: boolean; pasada: boolean }[]) {
    test(`${caso.rangos.join("+") || "vacía"} → ${caso.total}`, () => {
      const actual = mano(...caso.rangos);
      expect(actual.total()).toBe(caso.total);
      expect(actual.esBlanda()).toBe(caso.blanda);
      expect(actual.esBlackjack()).toBe(caso.blackjack);
      expect(actual.estaPasada()).toBe(caso.pasada);
    });
  }
  test("copia el arreglo de entrada y el de lectura; agregar conserva el orden", () => {
    const cartas = [new Carta("♥", "A")];
    const actual = new Mano(cartas);
    cartas.push(new Carta("♥", "K"));
    (actual.cartas as Carta[]).pop();
    expect(actual.total()).toBe(11);
    actual.agregar(new Carta("♥", "6"));
    expect(actual.cartas.map((carta) => carta.rango)).toEqual(["A", "6"]);
    expect(actual.total()).toBe(17);
  });
});

describe("Dealer", () => {
  test("pide con 16 y toma cartas hasta 17", () => {
    const dealer = new Dealer(mano("10", "6"));
    let extraidas = 0;
    expect(dealer.debePedir()).toBe(true);
    dealer.jugar({ sacar: () => { extraidas++; return new Carta("♦", "A"); } });
    expect(dealer.mano.total()).toBe(17);
    expect(extraidas).toBe(1);
    expect(dealer.debePedir()).toBe(false);
  });
  test("se planta en 17 blando sin consumir cartas", () => {
    const dealer = new Dealer(mano("A", "6"));
    expect(dealer.debePedir()).toBe(false);
    dealer.jugar({ sacar: () => { throw new Error("No debe pedir"); } });
    expect(dealer.mano.esBlanda()).toBe(true);
  });
  test("deja de pedir también al pasarse", () => {
    const dealer = new Dealer(mano("10", "6"));
    dealer.jugar({ sacar: () => new Carta("♦", "K") });
    expect(dealer.mano.total()).toBe(26);
    expect(dealer.debePedir()).toBe(false);
  });
});
