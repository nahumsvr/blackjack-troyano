/** Arranque de autenticación, economía y juego; espera pagos pendientes antes de cerrar SQL. */
import { crearConexion } from "./db/conexion";
import { iniciarAplicacion } from "./ws/aplicacion";

const conexion = crearConexion();
const servidor = iniciarAplicacion(conexion);
console.info(`Servidor escuchando en ${servidor.url}`);

async function apagar(): Promise<void> {
  await servidor.stop(true);
  await conexion.close();
  process.exit(0);
}
process.once("SIGINT", () => { void apagar(); });
process.once("SIGTERM", () => { void apagar(); });
