/** T-38: registro y claves de compra del cliente HTTP LAN contra servidor y PostgreSQL reales. */
import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { COMPRA_FICHAS_MIN, DINERO_INICIAL, FICHAS_INICIALES, MESAS, TASA_FICHAS } from "../src/config";
import { crearBasePruebas } from "./soporteHito1";

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("T-38: navegador HTTP sin randomUUID", () => {
  test("registra y realiza dos compras distintas con reqId y UUID de idempotencia válidos", async () => {
    const base = await crearBasePruebas(destino!);
    const servidor = iniciarAplicacion(base.conexion, 0);
    try {
      const proceso = Bun.spawn([process.execPath, "--no-env-file", fileURLToPath(new URL("../../client/test/soporteLanHttp.ts", import.meta.url)),
        `http://127.0.0.1:${servidor.port}`], { stdout: "pipe", stderr: "pipe" });
      const [codigo, salida, errores] = await Promise.all([proceso.exited,
        new Response(proceso.stdout).text(), new Response(proceso.stderr).text()]);
      expect(errores).toBe("");
      expect(codigo).toBe(0);
      const evidencia: unknown = JSON.parse(salida);
      const saldos = { fichas: FICHAS_INICIALES + 2 * COMPRA_FICHAS_MIN,
        dinero: DINERO_INICIAL - 2 * COMPRA_FICHAS_MIN * TASA_FICHAS };
      expect(evidencia).toMatchObject({ conexion: "conectado", usuario: "lan38_http", ...saldos, mesas: MESAS.length, errores: 0 });
      const [usuario] = await base.conexion`SELECT fichas, dinero FROM usuarios WHERE usuario = 'lan38_http'`;
      expect({ fichas: Number(usuario.fichas), dinero: Number(usuario.dinero) }).toEqual(saldos);
      const compras = await base.conexion<{ clave: string }[]>`SELECT clave FROM movimientos WHERE tipo = 'compra_fichas'`;
      expect(compras).toHaveLength(2);
      expect(new Set(compras.map((fila) => fila.clave)).size).toBe(2);
    } finally { await servidor.stop(true); await base.cerrar(); }
  }, 15000);
});
