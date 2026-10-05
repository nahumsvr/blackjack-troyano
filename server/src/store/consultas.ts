/** Consultas internas compartidas; serializan saldos sin perder precisión bigint. */
import { ErrorJuego, type BilleteraEstado } from "@blackjack/shared";
import type { SQL } from "bun";
import { LIMITE_DIARIO, ZONA_HORARIA } from "../config";

export type Saldos = { dinero: number; fichas: number };

/**
 * Convierte bigint recibido como texto sin redondearlo en JSON.
 * @param valor - Representación SQL entera.
 * @returns Entero exactamente representable por JavaScript.
 * @throws ErrorJuego ERROR_INTERNO si el saldo no cabe en el contrato numérico.
 */
export function enteroSeguro(valor: string): number {
  if (!/^-?\d+$/.test(valor)) throw new ErrorJuego("ERROR_INTERNO");
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) throw new ErrorJuego("ERROR_INTERNO");
  return numero;
}

/**
 * Bloquea el usuario para serializar todas las modificaciones de su dinero.
 * @param sql - Conexión de la transacción activa.
 * @param usuarioId - Usuario autenticado.
 * @returns Saldos previos seguros.
 * @throws ErrorJuego NO_AUTENTICADO | ERROR_INTERNO.
 */
export async function bloquearUsuario(sql: SQL, usuarioId: number): Promise<Saldos> {
  const [fila] = await sql<{ dinero: string; fichas: string }[]>`
    SELECT dinero::text, fichas::text FROM usuarios WHERE id = ${usuarioId} FOR UPDATE
  `;
  if (!fila) throw new ErrorJuego("NO_AUTENTICADO");
  return { dinero: enteroSeguro(fila.dinero), fichas: enteroSeguro(fila.fichas) };
}

/**
 * Lee saldos y compras del día en una sola sentencia PostgreSQL.
 * Usa el reloj actual después del bloqueo, no el inicio de una transacción
 * que pudo esperar hasta el siguiente día en otra pestaña.
 * @param sql - Pool o conexión de transacción.
 * @param usuarioId - Usuario autenticado.
 * @param instante - Reloj capturado después del bloqueo de una compra.
 * @returns Snapshot y siguiente medianoche CDMX en ISO.
 * @throws ErrorJuego NO_AUTENTICADO | ERROR_INTERNO.
 */
export async function consultarEstado(sql: SQL, usuarioId: number, instante: Date | null = null): Promise<BilleteraEstado> {
  const [fila] = await sql<{
    dinero: string; fichas: string; comprado_hoy: string; reinicio_en: Date;
  }[]>`
    WITH reloj AS MATERIALIZED (
      SELECT date_trunc('day', COALESCE(${instante?.toISOString() ?? null}::timestamptz, clock_timestamp())
        AT TIME ZONE ${ZONA_HORARIA}) AS dia
    ), limites AS (
      SELECT dia AT TIME ZONE ${ZONA_HORARIA} AS inicio,
             (dia + INTERVAL '1 day') AT TIME ZONE ${ZONA_HORARIA} AS fin FROM reloj
    )
    SELECT u.dinero::text, u.fichas::text,
      COALESCE((SELECT SUM(m.delta_fichas) FROM movimientos m
        WHERE m.usuario_id = u.id AND m.tipo = 'compra_fichas'
        AND m.creado_en >= l.inicio AND m.creado_en < l.fin), 0)::text AS comprado_hoy,
      l.fin AS reinicio_en
    FROM usuarios u CROSS JOIN limites l WHERE u.id = ${usuarioId}
  `;
  if (!fila) throw new ErrorJuego("NO_AUTENTICADO");
  const compradoHoy = enteroSeguro(fila.comprado_hoy);
  return {
    dinero: enteroSeguro(fila.dinero), fichas: enteroSeguro(fila.fichas), compradoHoy,
    disponibleHoy: Math.max(0, LIMITE_DIARIO - compradoHoy), limiteDiario: LIMITE_DIARIO,
    reinicioEn: fila.reinicio_en.toISOString(),
  };
}

/**
 * Modifica saldos y escribe el libro contable dentro del bloqueo del usuario.
 * @param sql - Transacción que ya bloqueó al usuario.
 * @param usuarioId - Dueño del movimiento.
 * @param tipo - Motivo contable.
 * @param saldos - Saldos posteriores previamente validados.
 * @param deltaDinero - Cambio en dinero.
 * @param deltaFichas - Cambio en fichas.
 * @param referencia - Ronda o artículo asociado, o null.
 * @param clave - Identificador de compra de fichas, o null.
 * @param instante - Mismo reloj usado para validar el día de una compra.
 * @returns Confirmación local; el caller confirma la transacción completa.
 * @throws ErrorJuego ERROR_INTERNO; propaga restricciones SQL.
 */
export async function registrarMovimiento(
  sql: SQL, usuarioId: number, tipo: "apuesta" | "pago" | "compra_fichas" | "compra_articulo",
  saldos: Saldos, deltaDinero: number, deltaFichas: number,
  referencia: string | null = null, clave: string | null = null,
  instante: Date | null = null,
): Promise<void> {
  if (!Number.isSafeInteger(saldos.dinero) || !Number.isSafeInteger(saldos.fichas)) {
    throw new ErrorJuego("ERROR_INTERNO");
  }
  await sql`UPDATE usuarios SET dinero = ${saldos.dinero}, fichas = ${saldos.fichas} WHERE id = ${usuarioId}`;
  await sql`
    INSERT INTO movimientos (usuario_id, tipo, delta_dinero, delta_fichas,
      dinero_despues, fichas_despues, referencia, clave, creado_en)
    VALUES (${usuarioId}, ${tipo}, ${deltaDinero}, ${deltaFichas},
      ${saldos.dinero}, ${saldos.fichas}, ${referencia}, ${clave}, COALESCE(${instante?.toISOString() ?? null}::timestamptz, clock_timestamp()))
  `;
}
