/** Cliente PostgreSQL de Bun y transacciones; no abre conexiones al importar. */
import { SQL, type TransactionSQL } from "bun";

/**
 * Crea un pool independiente para el servidor o una base de pruebas aislada.
 * @param url - DATABASE_URL de PostgreSQL.
 * @returns Cliente; su propietario debe cerrarlo al apagar.
 * @throws Error si no se configura una URL PostgreSQL.
 */
export function crearConexion(url = process.env.DATABASE_URL): SQL {
  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
    throw new Error("Configura DATABASE_URL con una URL de PostgreSQL.");
  }
  return new SQL(url);
}

/**
 * Ejecuta todas las consultas del callback en una conexión reservada.
 * Bun confirma al terminar y revierte ante cualquier excepción del callback.
 * @param conexion - Pool de PostgreSQL.
 * @param operacion - Trabajo que usa exclusivamente la conexión recibida.
 * @returns Resultado confirmado de la operación.
 * @throws Propaga errores de dominio y SQL después del rollback.
 */
export async function enTransaccion<T>(
  conexion: SQL,
  operacion: (transaccion: TransactionSQL) => Promise<T>,
): Promise<T> {
  return await conexion.begin(async (transaccion) => ({ resultado: await operacion(transaccion) }))
    .then(({ resultado }) => resultado);
}
