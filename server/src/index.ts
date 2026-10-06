/** Arranque del transporte y autenticación contra PostgreSQL (T-06/T-07/T-08). */
import { Sesiones } from "./auth/Sesiones";
import { crearEnrutadorAutenticado } from "./auth/manejadores";
import { crearConexion } from "./db/conexion";
import { BilleteraSQL } from "./store/BilleteraSQL";
import { iniciarServidor } from "./ws/servidor";

const conexion = crearConexion();
const billetera = new BilleteraSQL(conexion);
const enrutador = crearEnrutadorAutenticado(new Sesiones(conexion), {
  "billetera.consultar": async (socket) => ({ type: "billetera", ...await billetera.consultar(socket.data.usuarioId!) }),
});
const servidor = iniciarServidor(undefined, enrutador);
console.info(`Servidor escuchando en ${servidor.url}`);

async function apagar(): Promise<void> {
  servidor.stop(true);
  await conexion.close();
  process.exit(0);
}
process.once("SIGINT", () => { void apagar(); });
process.once("SIGTERM", () => { void apagar(); });
