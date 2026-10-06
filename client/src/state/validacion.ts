/**
 * Validaciones de formularios del cliente con los esquemas del contrato. Son solo para la
 * experiencia de usuario (explicar por qué un botón está deshabilitado y no enviar basura):
 * el servidor vuelve a validar todo y su respuesta es la que cuenta.
 */
import { CantidadApuestaSchema, CantidadCompraSchema, LIMITES_CANTIDAD, type BilleteraEstado } from "@blackjack/shared";

/** Resultado de validar una cantidad escrita por el usuario. */
export type ValidacionCantidad = { ok: true; cantidad: number } | { ok: false; motivo: string };

/**
 * Convierte el texto de un campo numérico a número sin aceptar formatos raros
 * ("1e3", "0x10", " 10 " con espacios internos, vacío).
 * @param texto - Lo que escribió el usuario.
 * @returns El número, o `null` si el texto no es un entero decimal simple.
 */
export function leerEntero(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
}

/**
 * Formatea una fecha ISO como hora local "HH:MM".
 * @param iso - Fecha en ISO 8601.
 * @returns Hora local, o "--:--" si la fecha no es válida.
 */
export function horaLocal(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "--:--";
  return fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/**
 * Valida una apuesta contra el contrato y las fichas disponibles.
 * @param texto - Cantidad escrita.
 * @param fichas - Fichas del usuario según la última `billetera`.
 * @returns La cantidad válida o el motivo del rechazo.
 */
export function validarApuesta(texto: string, fichas: number): ValidacionCantidad {
  const cantidad = leerEntero(texto);
  const { apuestaMin, apuestaMax, multiplo } = LIMITES_CANTIDAD;
  if (cantidad === null || !CantidadApuestaSchema.safeParse(cantidad).success) {
    return { ok: false, motivo: `La apuesta debe ser un entero múltiplo de ${multiplo} entre ${apuestaMin} y ${apuestaMax}.` };
  }
  if (cantidad > fichas) return { ok: false, motivo: `Solo tienes ${fichas} fichas.` };
  return { ok: true, cantidad };
}

/**
 * Valida una compra de fichas contra el contrato y el límite diario.
 * @param texto - Cantidad escrita.
 * @param billetera - Última billetera recibida.
 * @returns La cantidad válida o el motivo del rechazo.
 */
export function validarCompra(texto: string, billetera: BilleteraEstado): ValidacionCantidad {
  const reinicio = horaLocal(billetera.reinicioEn);
  if (billetera.disponibleHoy === 0) {
    return { ok: false, motivo: `Alcanzaste el límite diario de ${billetera.limiteDiario} fichas; se reinicia a las ${reinicio}.` };
  }
  const cantidad = leerEntero(texto);
  const { compraMin, compraMax, multiplo } = LIMITES_CANTIDAD;
  if (cantidad === null || !CantidadCompraSchema.safeParse(cantidad).success) {
    return { ok: false, motivo: `La compra debe ser un entero múltiplo de ${multiplo} entre ${compraMin} y ${compraMax}.` };
  }
  if (cantidad > billetera.disponibleHoy) {
    return { ok: false, motivo: `Hoy solo puedes comprar ${billetera.disponibleHoy} fichas más; se reinicia a las ${reinicio}.` };
  }
  return { ok: true, cantidad };
}

/** Denominaciones de las fichas del selector de apuesta (se descartan las que el contrato no admite). */
export const VALORES_FICHA_APUESTA: readonly number[] = [10, 50, 100, 500].filter(
  (valor) => valor % LIMITES_CANTIDAD.multiplo === 0 && valor <= LIMITES_CANTIDAD.apuestaMax,
);

/**
 * Suma una ficha a la apuesta escrita, sin pasarse del máximo del contrato ni de las fichas del
 * jugador (redondeadas al múltiplo permitido). Si el texto no es una cantidad válida, empieza de 0.
 * @param texto - Apuesta escrita hasta ahora.
 * @param valor - Denominación de la ficha tocada.
 * @param fichas - Fichas del usuario según la última `billetera`.
 * @returns Nueva apuesta, o `null` si ya no se puede subir (tope alcanzado o fichas insuficientes).
 */
export function sumarFicha(texto: string, valor: number, fichas: number): number | null {
  const { apuestaMin, apuestaMax, multiplo } = LIMITES_CANTIDAD;
  const leida = leerEntero(texto);
  const actual = leida !== null && Number.isInteger(leida) && leida > 0 && leida % multiplo === 0 ? leida : 0;
  const tope = Math.min(apuestaMax, Math.floor(fichas / multiplo) * multiplo);
  if (tope < apuestaMin || actual >= tope) return null;
  return Math.min(actual + valor, tope);
}
