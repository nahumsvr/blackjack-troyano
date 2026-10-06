/** Verifica T-38 con HTTP/WebSocket reales y un build temporal sin depender de Vite. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { DatosConexion } from "../src/ws/Enrutador";
import { iniciarServidor } from "../src/ws/servidor";
import { ClienteWsPrueba } from "./soporteHito1";

describe("T-38: cliente y WebSocket en un puerto", () => {
  let temporal: string;
  let servidor: Server<DatosConexion>;
  let sinBuild: Server<DatosConexion>;
  let url: string;
  let cierres = 0;
  const cierre = Promise.withResolvers<void>();
  const pagina = '<!doctype html><html><script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></html>';
  beforeAll(async () => {
    temporal = await mkdtemp(join(tmpdir(), "blackjack-produccion-"));
    const dist = join(temporal, "dist");
    await mkdir(join(dist, "assets"), { recursive: true });
    await Bun.write(join(dist, "index.html"), pagina);
    await Bun.write(join(dist, "assets/app.js"), "window.aplicacion = true;");
    await Bun.write(join(dist, "assets/app.css"), "body { color: green; }");
    await Bun.write(join(temporal, ".env"), "secreto-fuera-del-build");
    await symlink(join(temporal, ".env"), join(dist, "enlace.env"));
    await symlink(temporal, join(dist, "externo"));
    servidor = iniciarServidor(0, undefined, () => { cierres += 1; cierre.resolve(); }, dist);
    sinBuild = iniciarServidor(0, undefined, undefined, join(temporal, "ausente"));
    url = `http://127.0.0.1:${servidor.port}`;
  });
  afterAll(async () => {
    servidor?.stop(true);
    sinBuild?.stop(true);
    if (temporal) await rm(temporal, { recursive: true, force: true });
  });

  test("raíz y assets usan sus MIME y contenidos, incluida query de cache", async () => {
    const index = await fetch(`${url}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("text/html");
    expect(await index.text()).toBe(pagina);
    for (const [ruta, mime, contenido] of [["app.js", "javascript", "window.aplicacion = true;"],
      ["app.css", "text/css", "body { color: green; }"]]) {
      const archivo = await fetch(`${url}/assets/${ruta}?v=1`);
      expect(archivo.status).toBe(200);
      expect(archivo.headers.get("content-type")).toContain(mime!);
      expect(await archivo.text()).toBe(contenido!);
    }
  });

  test("HEAD informa longitud sin enviar cuerpo y POST rechaza escritura", async () => {
    const respuesta = await fetch(`${url}/`, { method: "HEAD" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-length")).toBe(String(Buffer.byteLength(pagina)));
    expect(await respuesta.text()).toBe("");
    const post = await fetch(`${url}/`, { method: "POST", body: "modificar" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
    expect(await (await fetch(`${url}/`)).text()).toBe(pagina);
  });

  test("rutas desconocidas, assets ausentes y directorios conservan 404 sin HTML", async () => {
    for (const ruta of ["/otra", "/assets/ausente.js", "/assets/"]) {
      const respuesta = await fetch(`${url}${ruta}`);
      expect(respuesta.status).toBe(404);
      expect(await respuesta.text()).toBe("No encontrado");
    }
  });

  test("traversal codificado y symlinks no exponen archivos fuera del build", async () => {
    for (const ruta of ["/%2e%2e%2f.env", "/assets/%2e%2e%2f%2e%2e%2f.env",
      "/%5c..%5c.env", "/%00.env", "/enlace.env", "/externo/.env"]) {
      const respuesta = await fetch(`${url}${ruta}`);
      expect(respuesta.status).toBe(404);
      expect(await respuesta.text()).not.toContain("secreto-fuera-del-build");
    }
    expect((await fetch(`${url}/%ZZ`)).status).toBe(400);
    expect((await fetch(`${url}/`)).status).toBe(200);
  });

  test("dist ausente explica compilar sin impedir el endpoint WebSocket", async () => {
    const respuesta = await fetch(`http://127.0.0.1:${sinBuild.port}/`);
    expect(respuesta.status).toBe(404);
    expect(await respuesta.text()).toContain("bun run build");
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${sinBuild.port}/ws`);
    try { expect(await cliente.enviar({ type: "ping" })).toMatchObject({ type: "pong" }); }
    finally { await cliente.cerrar(); }
  });

  test("/ws conserva upgrade, conteo y reqId en el mismo puerto que la página", async () => {
    expect((await fetch(`${url}/ws`)).status).toBe(426);
    const cliente = await ClienteWsPrueba.conectar(`ws://127.0.0.1:${servidor.port}/ws`);
    try {
      expect(await cliente.esperar((mensaje) => mensaje.type === "bienvenida"))
        .toMatchObject({ type: "bienvenida", conectados: 1 });
      expect(await cliente.enviar({ type: "ping", reqId: "produccion" }))
        .toMatchObject({ type: "pong", reqId: "produccion" });
      expect((await fetch(`${url}/`)).status).toBe(200);
    } finally { await cliente.cerrar(); }
    await cierre.promise;
    expect(cierres).toBe(1);
  });
});
