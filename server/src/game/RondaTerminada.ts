/** Datos internos de una ronda cerrada; deriva resultados del contrato sin añadir mensajes. */
import type { Asiento, CartaVisible, MensajeServidor } from "@blackjack/shared";

/** Mensaje compartido de resultados, sin campos internos de persistencia. */
export type ResultadoMesa = Extract<MensajeServidor, { type: "ronda.resultado" }>;

/** Datos inmutables retenidos hasta confirmar pagos e historial, incluso tras una salida. */
export interface RondaTerminada {
  readonly id: string;
  readonly mesaId: string;
  readonly iniciadaEn: string;
  readonly terminadaEn: string;
  readonly dealer: { readonly cartas: readonly CartaVisible[]; readonly total: number };
  readonly jugadores: readonly (Readonly<ResultadoMesa["resultados"][number]> & {
    readonly asiento: Asiento["indice"];
    readonly cartas: readonly CartaVisible[];
    readonly total: number;
  })[];
}
