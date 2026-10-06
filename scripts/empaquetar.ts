/** Genera el ZIP de entrega con fuentes y manuales, sin datos ni dependencias locales. */
import { copyFile, lstat, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ARCHIVOS_RAIZ = [
  ".env.example", ".gitignore", "README.md", "package.json", "bun.lock",
  "bun.lockb", "bunfig.toml", "tsconfig.base.json", "docker-compose.yml",
];
const CARPETAS_FUENTE = ["server", "client", "shared", "scripts", "docs", "documentation"];
const CARPETAS_EXCLUIDAS = new Set(["node_modules", ".git", "dist", "coverage", ".cache"]);
const LIMITE_BYTES = 20_000_000;

/**
 * Descarta secretos de entorno y artefactos reconstruibles de cualquier carpeta.
 * @param nombre - Nombre de archivo o carpeta.
 * @returns Si debe omitirse del archivo de entrega.
 */
function excluir(nombre: string): boolean {
  return CARPETAS_EXCLUIDAS.has(nombre)
    || nombre === ".env" || (nombre.startsWith(".env.") && nombre !== ".env.example")
    || /\.(?:zip|log|tsbuildinfo)$/i.test(nombre)
    || nombre === ".DS_Store" || nombre === "Thumbs.db";
}

/**
 * Recoge archivos regulares; un enlace impediría controlar qué se copia.
 * @param raiz - Raíz del proyecto.
 * @param carpeta - Carpeta relativa que se inspecciona.
 * @returns Rutas relativas ordenadas de las fuentes incluidas.
 * @throws Error Si encuentra un enlace o una entrada que no es archivo/carpeta.
 */
async function recoger(raiz: string, carpeta: string): Promise<string[]> {
  const archivos: string[] = [];
  const entradas = await readdir(join(raiz, carpeta), { withFileTypes: true });
  for (const entrada of entradas.sort((a, b) => a.name.localeCompare(b.name))) {
    if (excluir(entrada.name)) continue;
    if (/[\r\n]/.test(entrada.name)) throw new Error("Un nombre de archivo contiene un salto de línea.");
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) archivos.push(...await recoger(raiz, ruta));
    else if (entrada.isFile()) archivos.push(ruta);
    else throw new Error("La entrega requiere archivos regulares: " + ruta);
  }
  return archivos;
}

/**
 * Ejecuta zip/unzip sin pasar nombres por un intérprete de comandos.
 * @param comando - Programa y argumentos.
 * @param cwd - Carpeta desde la que se ejecuta.
 * @returns Salida estándar del comando.
 * @throws Error Si el programa termina con un código distinto de cero.
 */
async function ejecutar(comando: string[], cwd: string): Promise<string> {
  const proceso = Bun.spawn(comando, { cwd, stdout: "pipe", stderr: "pipe" });
  const [salida, error, codigo] = await Promise.all([
    new Response(proceso.stdout).text(), new Response(proceso.stderr).text(), proceso.exited,
  ]);
  if (codigo !== 0) throw new Error(comando[0] + " falló (" + codigo + "): " + error.trim());
  return salida;
}

/**
 * Copia las fuentes a una carpeta temporal y valida el ZIP antes de publicarlo.
 * @param raiz - Carpeta del proyecto; también permite probar una fixture aislada.
 * @returns Ruta, tamaño y número de archivos del ZIP generado.
 * @throws Error Si faltan requisitos, hay enlaces, falla la validación o alcanza 20 MB.
 */
export async function empaquetarProyecto(raiz: string): Promise<{
  ruta: string; bytes: number; archivos: number;
}> {
  if (!Bun.which("zip") || !Bun.which("unzip")) {
    throw new Error("Instala zip y unzip para generar y comprobar blackjack-equipo.zip.");
  }
  const archivos: string[] = [];
  for (const nombre of ARCHIVOS_RAIZ) {
    const ruta = join(raiz, nombre);
    if (!await Bun.file(ruta).exists()) continue;
    if (!(await lstat(ruta)).isFile()) throw new Error("La entrega requiere un archivo regular: " + nombre);
    archivos.push(nombre);
  }
  for (const carpeta of CARPETAS_FUENTE) {
    const ruta = join(raiz, carpeta);
    const entrada = await lstat(ruta);
    if (!entrada.isDirectory()) throw new Error("La entrega requiere una carpeta regular: " + carpeta);
    archivos.push(...await recoger(raiz, carpeta));
  }
  for (const obligatorio of [
    "README.md", ".env.example", "package.json", "bun.lock", "bunfig.toml",
    "docker-compose.yml", "docs/manual-instalacion.md",
    "server/db/schema.sql", "server/db/seed.sql",
  ]) {
    if (!archivos.includes(obligatorio)) throw new Error("Falta el archivo de entrega " + obligatorio + ".");
  }
  const temporal = await mkdtemp(join(raiz, ".empaquetar-"));
  const nombreProyecto = "blackjack-equipo";
  const zipTemporal = join(temporal, nombreProyecto + ".zip");
  try {
    for (const archivo of archivos) {
      const destino = join(temporal, nombreProyecto, archivo);
      await mkdir(dirname(destino), { recursive: true });
      await copyFile(join(raiz, archivo), destino);
    }
    await ejecutar(["zip", "-q", "-r", zipTemporal, nombreProyecto], temporal);
    const bytes = Bun.file(zipTemporal).size;
    if (bytes >= LIMITE_BYTES) throw new Error("El ZIP mide " + bytes + " bytes; debe pesar menos de 20 MB.");
    await ejecutar(["unzip", "-tqq", zipTemporal], temporal);
    const listado = await ejecutar(["unzip", "-Z1", zipTemporal], temporal);
    const contenido = listado.trim().split("\n").filter((ruta) => !ruta.endsWith("/")).sort();
    const esperado = archivos.map((ruta) => nombreProyecto + "/" + ruta).sort();
    if (JSON.stringify(contenido) !== JSON.stringify(esperado)) {
      throw new Error("El contenido del ZIP no coincide con las fuentes seleccionadas.");
    }
    // Reemplaza una entrega anterior solo después de validar el archivo completo.
    const ruta = join(raiz, nombreProyecto + ".zip");
    await rename(zipTemporal, ruta);
    return { ruta, bytes, archivos: archivos.length };
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const raiz = fileURLToPath(new URL("../", import.meta.url));
    const resultado = await empaquetarProyecto(raiz);
    console.log(relative(raiz, resultado.ruta) + ": " + resultado.archivos + " archivos, " + resultado.bytes + " bytes. ZIP verificado.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "No se pudo empaquetar la entrega.");
    process.exitCode = 1;
  }
}
