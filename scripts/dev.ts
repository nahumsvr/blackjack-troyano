/** Inicia el desarrollo de ambos workspaces y coordina su cierre. */
import { fileURLToPath } from "node:url";

const raiz = new URL("../", import.meta.url);
const procesos = ["server", "client"].map((paquete) =>
  Bun.spawn([process.execPath, "run", "dev"], {
    cwd: fileURLToPath(new URL(`${paquete}/`, raiz)),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }),
);

/**
 * Cierra los procesos para evitar watchers huérfanos al terminar el comando.
 * @returns Nada.
 */
function detener(): void {
  for (const proceso of procesos) proceso.kill();
}

process.on("SIGINT", detener);
process.on("SIGTERM", detener);
// El fallo de un workspace termina también el otro y conserva su código de salida.
const codigo = await Promise.race(procesos.map((proceso) => proceso.exited));
detener();
await Promise.all(procesos.map((proceso) => proceso.exited));
process.exitCode = codigo;

