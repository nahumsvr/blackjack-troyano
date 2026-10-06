/** Sirve únicamente el build de Vite; comparte puerto con WebSocket y limita rutas al dist. */
import { realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { DIRECTORIO_CLIENTE } from "../config";

function noEncontrado(): Response {
  return new Response("No encontrado", { status: 404 });
}

/**
 * Devuelve la página inicial o un archivo del build para GET/HEAD.
 * @param peticion - Solicitud HTTP que no corresponde al endpoint WebSocket.
 * @param directorio - Build del cliente; las pruebas inyectan un directorio temporal.
 * @returns Archivo con MIME y longitud; 404 para rutas ausentes o ajenas al directorio.
 * @throws Propaga fallos inesperados de acceso a disco al manejador HTTP de Bun.
 */
export async function servirCliente(peticion: Request, directorio = DIRECTORIO_CLIENTE): Promise<Response> {
  if (peticion.method !== "GET" && peticion.method !== "HEAD") {
    return new Response("Metodo no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  let ruta: string;
  try { ruta = decodeURIComponent(new URL(peticion.url).pathname); }
  catch { return new Response("Ruta invalida", { status: 400 }); }
  // La decodificación ocurre antes de validar: %2f y %2e no eluden el límite.
  if (ruta.includes("\\") || ruta.includes("\0") || ruta.split("/").some((parte) => parte === ".." || parte === ".")) {
    return noEncontrado();
  }
  let raiz: string;
  try { raiz = await realpath(directorio); }
  catch (error) {
    if (esAusente(error)) return new Response("Cliente no compilado. Ejecuta bun run build.", { status: 404 });
    throw error;
  }
  const destino = resolve(raiz, ruta === "/" ? "index.html" : `.${ruta}`);
  if (!estaDentro(destino, raiz)) return noEncontrado();
  try {
    const real = await realpath(destino);
    // Resolver symlinks impide publicar por accidente .env u otros archivos externos.
    if (!estaDentro(real, raiz)) return noEncontrado();
    const info = await stat(real);
    if (!info.isFile()) return noEncontrado();
    const archivo = Bun.file(real);
    return new Response(peticion.method === "HEAD" ? null : archivo, {
      headers: { "Content-Type": archivo.type, "Content-Length": String(info.size) },
    });
  } catch (error) {
    if (esAusente(error)) return noEncontrado();
    throw error;
  }
}

function estaDentro(archivo: string, raiz: string): boolean {
  return archivo.startsWith(`${raiz}${sep}`);
}

function esAusente(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}
