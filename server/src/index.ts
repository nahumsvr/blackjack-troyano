/** Arranque de los servicios del Hito 1 y cierre del pool PostgreSQL. */
import { crearConexion } from "./db/conexion";
import { iniciarAplicacion } from "./ws/aplicacion";

const conexion = crearConexion();
const servidor = iniciarAplicacion(conexion);
console.info(`Servidor escuchando en ${servidor.url}`);

async function apagar(): Promise<void> {
  servidor.stop(true);
  await conexion.close();
  process.exit(0);
}
process.once("SIGINT", () => { void apagar(); });
process.once("SIGTERM", () => { void apagar(); });
