/** Economía persistente; cada débito/crédito comparte bloqueo y libro contable. */
import { ErrorJuego, UuidSchema, type BilleteraEstado } from "@blackjack/shared";
import type { SQL } from "bun";
import {
  APUESTA_MAX, APUESTA_MIN, COMPRA_FICHAS_MAX, COMPRA_FICHAS_MIN,
  MULTIPLO_FICHAS, TASA_FICHAS,
} from "../config";
import { enTransaccion } from "../db/conexion";
import type { Billetera } from "./Billetera";
import { bloquearUsuario, consultarEstado, registrarMovimiento } from "./consultas";

function validarCantidad(cantidad: number, minimo: number, maximo: number): void {
  if (!Number.isSafeInteger(cantidad) || cantidad < minimo || cantidad > maximo
    || cantidad % MULTIPLO_FICHAS !== 0) throw new ErrorJuego("CANTIDAD_INVALIDA");
}

function validarUuid(valor: string): void {
  if (!UuidSchema.safeParse(valor).success) {
    throw new ErrorJuego("MENSAJE_INVALIDO");
  }
}

/** Implementación SQL de la interfaz que el motor recibe por inyección. */
export class BilleteraSQL implements Billetera {
  /**
   * Recibe un pool cuya vida administra el proceso servidor.
   * @param conexion - Conexión PostgreSQL, compartida o de pruebas.
   */
  constructor(private readonly conexion: SQL) {}

  /**
   * Consulta saldos y disponibilidad del día natural de CDMX.
   * @param usuarioId - Usuario autenticado.
   * @returns Snapshot consistente del saldo y su próximo reinicio diario.
   * @throws ErrorJuego NO_AUTENTICADO | ERROR_INTERNO.
   */
  async consultar(usuarioId: number): Promise<BilleteraEstado> {
    return consultarEstado(this.conexion, usuarioId);
  }

  /**
   * Descuenta la apuesta y registra su referencia de ronda atómicamente.
   * @param usuarioId - Jugador que apuesta.
   * @param cantidad - Entero múltiplo de diez entre APUESTA_MIN y APUESTA_MAX.
   * @param rondaId - UUID de la ronda en memoria.
   * @returns Billetera confirmada después del débito.
   * @throws ErrorJuego CANTIDAD_INVALIDA | MENSAJE_INVALIDO | FICHAS_INSUFICIENTES | NO_AUTENTICADO | ERROR_INTERNO.
   */
  async debitarApuesta(usuarioId: number, cantidad: number, rondaId: string): Promise<BilleteraEstado> {
    validarCantidad(cantidad, APUESTA_MIN, APUESTA_MAX);
    validarUuid(rondaId);
    return enTransaccion(this.conexion, async (sql) => {
      const saldos = await bloquearUsuario(sql, usuarioId);
      if (saldos.fichas < cantidad) throw new ErrorJuego("FICHAS_INSUFICIENTES");
      saldos.fichas -= cantidad;
      await registrarMovimiento(sql, usuarioId, "apuesta", saldos, 0, -cantidad, `ronda:${rondaId}`);
      return consultarEstado(sql, usuarioId);
    });
  }

  /**
   * Acredita el pago calculado por el motor; cero conserva el libro contable.
   * @param usuarioId - Jugador liquidado.
   * @param cantidad - Pago total entero no negativo, incluida la apuesta.
   * @param rondaId - UUID de la ronda que el juego liquida una sola vez.
   * @returns Billetera confirmada después del pago.
   * @throws ErrorJuego CANTIDAD_INVALIDA | MENSAJE_INVALIDO | NO_AUTENTICADO | ERROR_INTERNO.
   */
  async acreditarPago(usuarioId: number, cantidad: number, rondaId: string): Promise<BilleteraEstado> {
    if (!Number.isSafeInteger(cantidad) || cantidad < 0) throw new ErrorJuego("CANTIDAD_INVALIDA");
    validarUuid(rondaId);
    return enTransaccion(this.conexion, async (sql) => {
      const saldos = await bloquearUsuario(sql, usuarioId);
      // Las pérdidas no escriben un movimiento vacío, prohibido por el CHECK.
      if (cantidad > 0) {
        saldos.fichas += cantidad;
        await registrarMovimiento(sql, usuarioId, "pago", saldos, 0, cantidad, `ronda:${rondaId}`);
      }
      return consultarEstado(sql, usuarioId);
    });
  }

  /**
   * Compra fichas con el límite diario y la clave idempotente de PLAN §4.3.
   * @param usuarioId - Usuario autenticado.
   * @param cantidad - Entero múltiplo de diez dentro de límites configurados.
   * @param clave - UUID nuevo por intención; una repetida devuelve el saldo actual.
   * @returns Billetera tras el commit o tras reconocer una compra anterior.
   * @throws ErrorJuego CANTIDAD_INVALIDA | MENSAJE_INVALIDO | LIMITE_DIARIO | DINERO_INSUFICIENTE | NO_AUTENTICADO | ERROR_INTERNO.
   */
  async comprarFichas(usuarioId: number, cantidad: number, clave: string): Promise<BilleteraEstado> {
    validarCantidad(cantidad, COMPRA_FICHAS_MIN, COMPRA_FICHAS_MAX);
    validarUuid(clave);
    return enTransaccion(this.conexion, async (sql) => {
      const saldos = await bloquearUsuario(sql, usuarioId);
      const [repetida] = await sql<{ id: string }[]>`
        SELECT id::text FROM movimientos WHERE usuario_id = ${usuarioId} AND clave = ${clave}
      `;
      // Una respuesta perdida debe poder reintentarse incluso con el límite agotado.
      if (repetida) return consultarEstado(sql, usuarioId);
      const [reloj] = await sql<{ instante: Date }[]>`SELECT clock_timestamp() AS instante`;
      if (!reloj) throw new ErrorJuego("ERROR_INTERNO");
      const estado = await consultarEstado(sql, usuarioId, reloj.instante);
      if (cantidad > estado.disponibleHoy) throw new ErrorJuego("LIMITE_DIARIO");
      const costo = cantidad * TASA_FICHAS;
      if (saldos.dinero < costo) throw new ErrorJuego("DINERO_INSUFICIENTE");
      saldos.dinero -= costo;
      saldos.fichas += cantidad;
      await registrarMovimiento(sql, usuarioId, "compra_fichas", saldos, -costo, cantidad,
        null, clave, reloj.instante);
      return consultarEstado(sql, usuarioId, reloj.instante);
    });
  }
}
