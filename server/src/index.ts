/** Arranque de autenticación, economía y juego; espera pagos pendientes antes de cerrar SQL. */
import { crearConexion } from "./db/conexion";
import { iniciarAplicacion } from "./ws/aplicacion";

const conexion = crearConexion();
const servidor = iniciarAplicacion(conexion);
console.info(`Servidor escuchando en ${servidor.url}`);

/** Cierra transporte, liquidaciones y SQL; siempre termina el proceso, con código 1 si quedó algo sin confirmar. */
async function apagar(): Promise<void> {
  let codigo = 0;
  try {
    await servidor.stop(true);
  } catch (error) {
    // stop() propaga una liquidación que falló en su último intento: dejar rastro en lugar de colgarse.
    console.error("Apagado con liquidación sin confirmar", error);
    codigo = 1;
  } finally {
    await conexion.close().catch((error: unknown) => console.error("Error al cerrar PostgreSQL", error));
  }
  process.exit(codigo);
}
process.once("SIGINT", () => { void apagar(); });
process.once("SIGTERM", () => { void apagar(); });
