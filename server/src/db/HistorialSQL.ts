/** Persiste únicamente rondas terminadas; todos sus jugadores se insertan en una transacción. */
import type { SQL } from "bun";
import { ErrorJuego } from "@blackjack/shared";
import type { RondaTerminada } from "../game/RondaTerminada";
import { enTransaccion } from "./conexion";

/** Guarda un historial inmutable e idempotente por el UUID generado por Mesa. */
export class HistorialSQL {
  /** @param conexion - Pool PostgreSQL compartido, administrado por la aplicación. */
  constructor(private readonly conexion: SQL) {}

  /**
   * La PK de ronda serializa reintentos concurrentes; un rollback no deja filas parciales.
   * @param ronda - Copia de datos del motor después de completar el dealer.
   * @returns Confirmación de ronda y todos sus participantes, o reconocimiento del reintento.
   * @throws ErrorJuego ERROR_INTERNO si un UUID ya corresponde a datos diferentes; propaga fallos SQL.
   */
  async guardar(ronda: RondaTerminada): Promise<void> {
    await enTransaccion(this.conexion, async (sql) => {
      const [insertada] = await sql<{ id: string }[]>`
        INSERT INTO rondas (id, mesa_id, iniciada_en, terminada_en, cartas_dealer, total_dealer)
        VALUES (${ronda.id}, ${ronda.mesaId}, ${ronda.iniciadaEn}, ${ronda.terminadaEn},
          ${JSON.stringify(ronda.dealer.cartas)}::jsonb, ${ronda.dealer.total})
        ON CONFLICT (id) DO NOTHING RETURNING id
      `;
      if (!insertada) {
        const [misma] = await sql<{ id: string }[]>`
          SELECT id FROM rondas WHERE id = ${ronda.id} AND mesa_id = ${ronda.mesaId}
            AND iniciada_en = ${ronda.iniciadaEn}::timestamptz AND terminada_en = ${ronda.terminadaEn}::timestamptz
            AND cartas_dealer = ${JSON.stringify(ronda.dealer.cartas)}::jsonb AND total_dealer = ${ronda.dealer.total}
        `;
        if (!misma) throw new ErrorJuego("ERROR_INTERNO");
        const jugadores = await sql<{ usuarioId: number; asiento: number; apuesta: number; cartas: RondaTerminada["jugadores"][number]["cartas"]; total: number; resultado: string; pago: number }[]>`
          SELECT usuario_id AS "usuarioId", asiento, apuesta, cartas, total, resultado, pago
          FROM rondas_jugadores WHERE ronda_id = ${ronda.id} ORDER BY asiento
        `;
        const esperados = [...ronda.jugadores].sort((a, b) => a.asiento - b.asiento).map((jugador) => ({
          usuarioId: jugador.usuarioId, asiento: jugador.asiento, apuesta: jugador.apuesta,
          cartas: jugador.cartas, total: jugador.total, resultado: jugador.resultado, pago: jugador.pago,
        }));
        // Comparar los objetos de carta por datos, no por el orden de claves que normaliza jsonb.
        if (jugadores.length !== esperados.length || jugadores.some((jugador, indice) => {
          const esperado = esperados[indice]!;
          return jugador.usuarioId !== esperado.usuarioId || jugador.asiento !== esperado.asiento
            || jugador.apuesta !== esperado.apuesta || jugador.total !== esperado.total
            || jugador.resultado !== esperado.resultado || jugador.pago !== esperado.pago
            || jugador.cartas.length !== esperado.cartas.length
            || jugador.cartas.some((carta, posicion) => carta.palo !== esperado.cartas[posicion]!.palo || carta.rango !== esperado.cartas[posicion]!.rango);
        })) throw new ErrorJuego("ERROR_INTERNO");
        return;
      }
      for (const jugador of ronda.jugadores) {
        await sql`
          INSERT INTO rondas_jugadores (ronda_id, usuario_id, asiento, apuesta, cartas, total, resultado, pago)
          VALUES (${ronda.id}, ${jugador.usuarioId}, ${jugador.asiento}, ${jugador.apuesta},
            ${JSON.stringify(jugador.cartas)}::jsonb, ${jugador.total}, ${jugador.resultado}, ${jugador.pago})
        `;
      }
    });
  }
}
