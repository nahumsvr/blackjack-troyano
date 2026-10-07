/** Contrato inyectable del juego; solo importa tipos, sin dependencia de SQL. */
import type { BilleteraEstado } from "@blackjack/shared";

/** Operaciones de saldo autoritativo; todas devuelven el estado actualizado. */
export interface Billetera {
  /**
   * Consulta saldos y disponibilidad del día natural CDMX.
   * @param usuarioId - Usuario autenticado.
   * @returns Estado consistente de su billetera.
   * @throws ErrorJuego NO_AUTENTICADO si el usuario no existe.
   */
  consultar(usuarioId: number): Promise<BilleteraEstado>;
  /**
   * Compra fichas una sola vez por clave; repetirla devuelve el saldo actual,
   * incluso si la cantidad del reintento difiere o se agotó el límite diario.
   * @param usuarioId - Usuario autenticado.
   * @param cantidad - Entero múltiplo de diez, entre los límites de compra.
   * @param clave - UUID que identifica la intención de compra.
   * @returns Billetera tras confirmar o reconocer el reintento.
   * @throws ErrorJuego CANTIDAD_INVALIDA | DINERO_INSUFICIENTE | LIMITE_DIARIO | MENSAJE_INVALIDO | NO_AUTENTICADO.
   */
  comprarFichas(usuarioId: number, cantidad: number, clave: string): Promise<BilleteraEstado>;
  /**
   * Descuenta una apuesta e inserta su movimiento en la misma transacción.
   * El juego es responsable de validar fase y una sola apuesta por ronda.
   * @param usuarioId - Jugador que apuesta.
   * @param cantidad - Apuesta entera permitida.
   * @param rondaId - UUID generado al iniciar la ronda.
   * @returns Estado confirmado.
   * @throws ErrorJuego CANTIDAD_INVALIDA | FICHAS_INSUFICIENTES | MENSAJE_INVALIDO | NO_AUTENTICADO.
   */
  debitarApuesta(usuarioId: number, cantidad: number, rondaId: string): Promise<BilleteraEstado>;
  /**
   * Acredita el pago total, incluida la apuesta; un pago cero no crea movimiento.
   * Repetir un pago positivo del mismo jugador y ronda devuelve saldo sin duplicarlo.
   * @param usuarioId - Jugador liquidado.
   * @param cantidad - Pago entero no negativo calculado por las reglas.
   * @param rondaId - UUID de la ronda liquidada.
   * @returns Estado confirmado.
   * @throws ErrorJuego CANTIDAD_INVALIDA | MENSAJE_INVALIDO | NO_AUTENTICADO | ERROR_INTERNO.
   */
  acreditarPago(usuarioId: number, cantidad: number, rondaId: string): Promise<BilleteraEstado>;
}
