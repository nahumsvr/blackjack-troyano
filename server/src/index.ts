/** Punto de entrada de Bun.serve; T-06 habilita el lobby por WebSocket. */
import { iniciarServidor } from "./ws/servidor";

const servidor = iniciarServidor();
console.info(`Servidor escuchando en ${servidor.url}`);
