/** Regresión de HistorialSQL: las cartas se guardan como arreglo jsonb con y sin sentencias preparadas. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { ErrorJuego } from "@blackjack/shared";
import { HistorialSQL } from "../src/db/HistorialSQL";
import type { RondaTerminada } from "../src/game/RondaTerminada";
import { crearBasePruebas } from "./soporteHito1";

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("HistorialSQL con PostgreSQL", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let usuarioId: number;

  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    [{ id: usuarioId }] = await base.conexion`INSERT INTO usuarios (usuario, hash) VALUES ('historial', 'x') RETURNING id`;
  });
  afterAll(async () => { await base?.cerrar(); });

  function ronda(): RondaTerminada {
    const ahora = new Date().toISOString();
    return {
      id: crypto.randomUUID(), mesaId: "mesa-1", iniciadaEn: ahora, terminadaEn: ahora,
      dealer: { cartas: [{ palo: "♠", rango: "10" }, { palo: "♥", rango: "7" }], total: 17 },
      jugadores: [{ usuarioId, asiento: 0, apuesta: 10, cartas: [{ palo: "♣", rango: "A" }, { palo: "♦", rango: "K" }], total: 21, resultado: "blackjack", pago: 25 }],
    };
  }

  // Producción usa sentencias preparadas y las pruebas `prepare: false`; Bun serializa distinto en cada modo.
  for (const prepare of [true, false]) {
    test(`guarda arreglos jsonb, acepta el reintento igual y rechaza otras cartas con prepare=${prepare}`, async () => {
      const [{ schema }] = await base.conexion`SELECT current_schema() AS schema`;
      const conexion = new SQL(destino!, { max: 2, connection: { search_path: schema }, prepare });
      try {
        const historial = new HistorialSQL(conexion);
        const terminada = ronda();
        await historial.guardar(terminada);
        await historial.guardar(terminada);
        const [fila] = await conexion`
          SELECT jsonb_typeof(r.cartas_dealer) AS dealer, jsonb_typeof(j.cartas) AS jugador, r.cartas_dealer AS cartas,
            (SELECT count(*)::int FROM rondas_jugadores WHERE ronda_id = r.id) AS filas
          FROM rondas r JOIN rondas_jugadores j ON j.ronda_id = r.id WHERE r.id = ${terminada.id}
        `;
        expect(fila).toEqual({ dealer: "array", jugador: "array", cartas: terminada.dealer.cartas, filas: 1 });
        // La comparación del reintento también usa ::text::jsonb: unas cartas distintas no deben pasar por iguales.
        const otrasCartas = { ...terminada, dealer: { cartas: [{ palo: "♠", rango: "10" }, { palo: "♥", rango: "8" }], total: 18 } } as const;
        expect(await historial.guardar(otrasCartas).catch((error: unknown) => error)).toEqual(new ErrorJuego("ERROR_INTERNO"));
      } finally {
        await conexion.close();
      }
    });
  }
});
