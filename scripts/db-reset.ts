/** Reinicia únicamente las tablas del proyecto y carga el catálogo de desarrollo. */
import { SQL } from "bun";
import { createInterface } from "node:readline/promises";

/**
 * Verifica el destino y exige su nombre para autorizar la pérdida de datos.
 * @param destino - URL PostgreSQL recibida desde DATABASE_URL.
 * @returns Nombre de la base confirmada.
 * @throws Error Si la URL o los argumentos son inválidos, o falta confirmación.
 */
async function confirmarDestino(destino: URL): Promise<string> {
  if (!["postgres:", "postgresql:"].includes(destino.protocol)) {
    throw new Error("DATABASE_URL debe ser una URL de PostgreSQL.");
  }
  const base = decodeURIComponent(destino.pathname.slice(1));
  if (!base || base.includes("/") || ["postgres", "template0", "template1"].includes(base)) {
    throw new Error("DATABASE_URL debe indicar una base del proyecto, no una base del sistema.");
  }
  const argumentos = Bun.argv.slice(2);
  if (argumentos.length && (argumentos.length !== 2 || argumentos[0] !== "--confirm")) {
    throw new Error("Uso: bun run db:reset [--confirm NOMBRE_BASE]");
  }
  console.log(`Destino: ${destino.hostname}:${destino.port || "5432"}/${base}`);
  console.log("Se borrarán usuarios, sesiones, inventario, movimientos, rondas y catálogo.");
  let confirmacion = argumentos[1];
  if (!argumentos.length) {
    if (!process.stdin.isTTY) {
      throw new Error(`Sin terminal interactiva: confirma con bun run db:reset --confirm ${base}`);
    }
    const entrada = createInterface({ input: process.stdin, output: process.stdout });
    try {
      confirmacion = await entrada.question("Escribe el nombre de la base para continuar: ");
    } finally {
      entrada.close();
    }
  }
  if (confirmacion !== base) throw new Error("Confirmación incorrecta; no se modificó la base.");
  return base;
}

/**
 * Aplica esquema y seed atómicamente; un fallo conserva todos los datos anteriores.
 * @returns Nada.
 * @throws Error Si faltan configuración, confirmación, archivos o acceso PostgreSQL.
 */
async function reiniciar(): Promise<void> {
  const direccion = process.env.DATABASE_URL;
  if (!direccion) throw new Error("Falta DATABASE_URL; copia .env.example a .env y configura la base.");
  const destino = new URL(direccion);
  const base = await confirmarDestino(destino);
  const esquema = await Bun.file(new URL("../server/db/schema.sql", import.meta.url)).text();
  const catalogo = await Bun.file(new URL("../server/db/seed.sql", import.meta.url)).text();
  const conexion = new SQL(direccion, { max: 1, connectionTimeout: 10, prepare: false });
  try {
    await conexion.begin(async (transaccion) => {
      const [destinoReal] = await transaccion<{ nombre: string }[]>`SELECT current_database() AS nombre`;
      if (destinoReal?.nombre !== base) throw new Error("La conexión apunta a una base diferente de la confirmada.");
      // Limita todos los nombres a public y evita CASCADE sobre tablas ajenas.
      await transaccion.unsafe("SET LOCAL search_path TO public");
      await transaccion.unsafe("SET LOCAL lock_timeout = '5s'");
      await transaccion.unsafe(`
        DROP TABLE IF EXISTS rondas_jugadores, rondas, movimientos,
          inventario, sesiones, usuarios, articulos
      `);
      await transaccion.unsafe(esquema);
      await transaccion.unsafe(catalogo);
    });
    console.log(`Base ${base} reiniciada: 7 tablas y 14 artículos.`);
  } finally {
    await conexion.close();
  }
}

try {
  await reiniciar();
} catch (error) {
  // No imprime URLs ni objetos del cliente que puedan incluir credenciales.
  console.error(error instanceof Error ? error.message : "No se pudo reiniciar la base.");
  process.exitCode = 1;
}
