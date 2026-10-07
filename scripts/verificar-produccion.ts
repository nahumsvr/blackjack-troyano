/// <reference lib="dom" />
/** T-38: verifica el build servido por HTTP y una ronda real por /ws del mismo host. */
import { join } from "node:path";
import { urlWebSocket } from "../client/src/config";
import { BOTS_RESPUESTA_MS, CACHE_CLIENTE_CON_HASH, CACHE_CLIENTE_REVALIDAR, DIRECTORIO_CLIENTE, MESAS } from "../server/src/config";
import { ejecutarBots } from "./bots";

/**
 * Comprueba la aplicación ya arrancada; registra tres cuentas nuevas y juega una ronda.
 * @param direccion - Origen HTTP de producción, p. ej. http://192.168.1.10:3000.
 * @returns Evidencia sin tokens ni contraseñas: build, assets y ronda común de tres bots.
 * @throws Error Si la URL, el build, HTTP, WebSocket o la ronda no cumplen la verificación.
 */
export async function verificarProduccion(direccion: string) {
  const pagina = new URL(direccion);
  if (!["http:", "https:"].includes(pagina.protocol) || pagina.username || pagina.password
    || pagina.pathname !== "/" || pagina.search || pagina.hash) {
    throw new Error("Usa solo el origen HTTP del servidor, sin credenciales ni modo mock.");
  }
  const respuesta = await fetch(pagina, { signal: AbortSignal.timeout(BOTS_RESPUESTA_MS), redirect: "error" });
  const html = await respuesta.text();
  if (respuesta.status !== 200 || !respuesta.headers.get("content-type")?.includes("text/html")
    || respuesta.headers.get("cache-control") !== CACHE_CLIENTE_REVALIDAR
    || html !== await Bun.file(join(DIRECTORIO_CLIENTE, "index.html")).text()) {
    throw new Error("HTTP no sirve el index.html del build actual con su MIME/caché.");
  }
  const rutas = [...html.matchAll(/(?:src|href)="(\/assets\/[A-Za-z0-9_-]+\.(?:js|css))"/g)].map((coincidencia) => coincidencia[1]!);
  if (!rutas.some((ruta) => ruta.endsWith(".js")) || !rutas.some((ruta) => ruta.endsWith(".css"))) {
    throw new Error("El HTML no referencia el JavaScript y CSS compilados.");
  }
  const assets = [];
  for (const ruta of new Set(rutas)) {
    const archivo = await fetch(new URL(ruta, pagina), { signal: AbortSignal.timeout(BOTS_RESPUESTA_MS), redirect: "error" });
    const bytes = await archivo.arrayBuffer();
    const mime = archivo.headers.get("content-type");
    const cache = archivo.headers.get("cache-control");
    const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    const local = await Bun.file(join(DIRECTORIO_CLIENTE, ruta.slice(1))).arrayBuffer();
    const esperado = new Bun.CryptoHasher("sha256").update(local).digest("hex");
    if (archivo.status !== 200 || !mime?.includes(ruta.endsWith(".js") ? "javascript" : "text/css")
      || cache !== CACHE_CLIENTE_CON_HASH || bytes.byteLength === 0 || sha256 !== esperado) {
      throw new Error(`Asset incorrecto o distinto del build: ${ruta}`);
    }
    assets.push({ ruta, estado: archivo.status, mime, cache, bytes: bytes.byteLength, sha256 });
  }
  // Usar el helper del cliente verifica el mismo host/puerto, sin una URL fija de localhost.
  const websocket = urlWebSocket(pagina);
  const jugadores = await ejecutarBots({ cantidad: 3, rondas: 1, mesaId: MESAS[0].id, url: websocket }, () => {});
  const rondas = new Set(jugadores.flatMap((jugador) => jugador.rondas));
  if (jugadores.some((jugador) => jugador.retirado || jugador.rondas.length !== 1) || rondas.size !== 1) {
    throw new Error("Los tres bots no terminaron la misma ronda.");
  }
  return { verificadoEn: new Date().toISOString(), origen: pagina.origin, websocket,
    html: { estado: respuesta.status, mime: respuesta.headers.get("content-type"), cache: respuesta.headers.get("cache-control") },
    assets, jugadores, rondaId: [...rondas][0], otraLaptopVerificada: false };
}

if (import.meta.main) {
  try {
    const [direccion, salida] = Bun.argv.slice(2);
    if (!direccion || Bun.argv.length > 4) throw new Error("Uso: bun run verificar:produccion http://IP:3000 [evidencia.json]");
    const evidencia = `${JSON.stringify(await verificarProduccion(direccion), null, 2)}\n`;
    if (salida) await Bun.write(salida, evidencia);
    console.info(evidencia);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falló la verificación de producción.");
    process.exitCode = 1;
  }
}
