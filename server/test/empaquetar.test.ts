/** Regresiones de T-54 con ZIPs reales y fixtures aislados; no acredita instalación final. */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { empaquetarProyecto } from "../../scripts/empaquetar";

const temporales: string[] = [];
afterEach(async () => { await Promise.all(temporales.splice(0).map((ruta) => rm(ruta, { recursive: true, force: true }))); });

async function fixture(lock = "bun.lock", compose = "docker-compose.yml") {
  const raiz = await mkdtemp(join(tmpdir(), "blackjack ZIP "));
  temporales.push(raiz);
  for (const carpeta of ["server", "client", "shared", "scripts", "docs", "documentation"]) {
    await mkdir(join(raiz, carpeta));
  }
  const archivos = ["README.md", ".env.example", "package.json", "bunfig.toml", lock, compose,
    "docs/manual-instalacion.md", "server/db/schema.sql", "server/db/seed.sql",
    "client/src/pantallas/menu.ts", "docs/guias/instalacion local.md"];
  for (const ruta of archivos) {
    await mkdir(dirname(join(raiz, ruta)), { recursive: true });
    await Bun.write(join(raiz, ruta), `Contenido de ${ruta}`);
  }
  return { raiz, archivos };
}

async function unzip(raiz: string, argumentos: string[]): Promise<string> {
  const proceso = Bun.spawn(["unzip", ...argumentos], { cwd: raiz, stdout: "pipe", stderr: "pipe" });
  const [salida, error, codigo] = await Promise.all([
    new Response(proceso.stdout).text(), new Response(proceso.stderr).text(), proceso.exited,
  ]);
  if (codigo !== 0) throw new Error(`unzip falló: ${error}`);
  return salida;
}

async function listado(raiz: string, zip: string): Promise<string[]> {
  return (await unzip(raiz, ["-Z1", zip])).trim().split(/\r?\n/).filter((ruta) => !ruta.endsWith("/")).sort();
}

describe("T-54: ZIP y selección de requisitos", () => {
  test("ZIP contiene fuentes anidadas con '/' y excluye secretos, dependencias y artefactos", async () => {
    const { raiz, archivos } = await fixture();
    for (const ruta of [".env", "server/.env.local", "server/db/respaldo.zip", "client/debug.log",
      "client/tipos.tsbuildinfo", "server/node_modules/paquete/index.js", "client/dist/index.html",
      "shared/.git/config", "docs/coverage/reporte.html", "scripts/.cache/dato"]) {
      await mkdir(dirname(join(raiz, ruta)), { recursive: true });
      await Bun.write(join(raiz, ruta), "no debe entrar");
    }
    const resultado = await empaquetarProyecto(raiz);
    expect(resultado.archivos).toBe(archivos.length);
    expect(resultado.bytes).toBeGreaterThan(0);
    expect(resultado.bytes).toBeLessThan(20_000_000);
    await unzip(raiz, ["-tqq", resultado.ruta]);
    const contenido = await listado(raiz, resultado.ruta);
    expect(contenido).toEqual(archivos.map((ruta) => `blackjack-equipo/${ruta}`).sort());
    expect(contenido.every((ruta) => !ruta.includes("\\"))).toBe(true);
    expect(await unzip(raiz, ["-p", resultado.ruta, "blackjack-equipo/docs/guias/instalacion local.md"]))
      .toBe("Contenido de docs/guias/instalacion local.md");
    expect((await readdir(raiz)).some((nombre) => nombre.startsWith(".empaquetar-"))).toBe(false);
  });

  test.each([
    ["bun.lock", "compose.yaml"], ["bun.lockb", "compose.yml"],
    ["bun.lock", "docker-compose.yaml"], ["bun.lockb", "docker-compose.yml"],
  ])("acepta %s con %s y los incluye en el ZIP", async (lock, compose) => {
    const { raiz } = await fixture(lock, compose);
    const resultado = await empaquetarProyecto(raiz);
    const contenido = await listado(raiz, resultado.ruta);
    expect(contenido).toContain(`blackjack-equipo/${lock}`);
    expect(contenido).toContain(`blackjack-equipo/${compose}`);
  });

  test.each(["server/db/schema.sql", "docs/manual-instalacion.md", "bun.lock", "docker-compose.yml"])(
    "sin %s falla antes de reemplazar el ZIP anterior", async (faltante) => {
      const { raiz } = await fixture();
      const anterior = await empaquetarProyecto(raiz);
      const bytes = await Bun.file(anterior.ruta).bytes();
      await rm(join(raiz, faltante));
      await expect(empaquetarProyecto(raiz)).rejects.toThrow("Falta");
      expect(await Bun.file(anterior.ruta).bytes()).toEqual(bytes);
      expect((await readdir(raiz)).some((nombre) => nombre.startsWith(".empaquetar-"))).toBe(false);
    },
  );

  // Windows exige privilegios para symlinks de archivo; el caso se conserva en Unix.
  test.skipIf(process.platform === "win32")("un enlace a archivo se rechaza antes de producir el ZIP", async () => {
    const { raiz } = await fixture();
    await symlink(join(raiz, "README.md"), join(raiz, "docs/enlace.md"));
    await expect(empaquetarProyecto(raiz)).rejects.toThrow("archivos regulares");
    expect(await Bun.file(join(raiz, "blackjack-equipo.zip")).exists()).toBe(false);
  });

  test("un enlace a directorio se rechaza antes de producir el ZIP", async () => {
    const { raiz } = await fixture();
    // Windows puede crear junctions sin habilitar privilegios globales para symlinks.
    await symlink(join(raiz, "docs/guias"), join(raiz, "docs/enlace"), process.platform === "win32" ? "junction" : "dir");
    await expect(empaquetarProyecto(raiz)).rejects.toThrow("archivos regulares");
    expect(await Bun.file(join(raiz, "blackjack-equipo.zip")).exists()).toBe(false);
  });
});
