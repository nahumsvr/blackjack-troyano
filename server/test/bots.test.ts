/** T-26: cuatro clientes automáticos, WS real y diez liquidaciones SQL con relojes reales. */
import { describe, expect, spyOn, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { ejecutarBots, leerOpcionesBots } from "../../scripts/bots";
import { FICHAS_INICIALES } from "../src/config";
import { Mesa } from "../src/game/Mesa";
import { iniciarAplicacion } from "../src/ws/aplicacion";
import { crearBasePruebas } from "./soporteHito1";
import { crearZapatoFijo } from "./soporteMesa";

test("la CLI acepta mesa/LAN/demo continua y rechaza cantidades u opciones inválidas", () => {
  expect(leerOpcionesBots(["4", "--mesa", "mesa-1"]).rondas).toBe(10);
  expect(leerOpcionesBots(["3", "--url", "ws://192.168.1.10:3000/ws", "--rondas", "0", "--mesa", "mesa-2"]))
    .toEqual({ cantidad: 3, url: "ws://192.168.1.10:3000/ws", rondas: 0, mesaId: "mesa-2" });
  for (const entrada of [[], ["0"], ["6"], ["1.5"], ["abc"], ["4", "--rondas", "-1"],
    ["4", "--mesa"], ["4", "--mesa", "mesa-1", "--mesa", "mesa-2"], ["4", "--otro", "1"],
    ["4", "--url", "http://localhost:3000/ws"]]) expect(() => leerOpcionesBots(entrada)).toThrow();
});

const destino = Bun.env.TEST_DATABASE_URL;
describe.skipIf(!destino)("bots con PostgreSQL 16", () => {
  test("la CLI juega diez rondas con cuatro bots, dos pedidos, natural y pasado, sin errores", async () => {
    const base = await crearBasePruebas(destino!);
    // A: gana con 18, pide 2 y 4 hasta 17, blackjack, pide 10 y se pasa.
    // B: blackjack del dealer omite todos los turnos y empata el natural del jugador.
    const a = ["10", "5", "A", "10", "10", "8", "6", "K", "6", "7", "2", "4", "10"] as const;
    const b = ["10", "5", "A", "10", "A", "8", "6", "K", "6", "K"] as const;
    const rangos = Array.from({ length: 5 }, () => [...a, ...b]).flat();
    const errores = spyOn(console, "error").mockImplementation(() => {});
    const servidor = iniciarAplicacion(base.conexion, 0, (id, nombre, publicar, servicios) =>
      new Mesa(id, nombre, publicar, crearZapatoFijo(rangos), undefined, servicios));
    const proceso = Bun.spawn([process.execPath, "run", "bots", "4", "--mesa", "mesa-1", "--url",
      `ws://127.0.0.1:${servidor.port}/ws`], { cwd: fileURLToPath(new URL("../../", import.meta.url)), stdout: "pipe", stderr: "pipe" });
    try {
      const [codigo, texto, diagnostico] = await Promise.all([proceso.exited,
        new Response(proceso.stdout).text(), new Response(proceso.stderr).text()]);
      if (codigo !== 0) throw new Error(`${diagnostico}\n${texto}`);
      const salida = texto.trim().split(/\r?\n/);
      const usuarios = await base.conexion<{ id: number; usuario: string }[]>`SELECT id, usuario FROM usuarios`;
      expect(usuarios).toHaveLength(4);
      for (const { usuario } of usuarios) expect(salida.filter((linea) => linea.startsWith(`[${usuario}] ronda `))).toHaveLength(10);
      const rondas = await base.conexion<{ id: string }[]>`SELECT id FROM rondas ORDER BY iniciada_en`;
      expect(rondas).toHaveLength(10);
      const jugadores = await base.conexion<{ ronda_id: string; asiento: number; apuesta: number;
        resultado: string; pago: number; total: number; cartas: unknown[] }[]>`
        SELECT ronda_id, asiento, apuesta, resultado, pago, total, cartas FROM rondas_jugadores ORDER BY asiento
      `;
      expect(jugadores).toHaveLength(40);
      for (const [indice, { id }] of rondas.entries()) {
        const filas = jugadores.filter((fila) => fila.ronda_id === id);
        expect(filas.map(({ resultado, pago, total }) => ({ resultado, pago, total }))).toEqual(indice % 2 === 0 ? [
          { resultado: "gana", pago: 20, total: 18 }, { resultado: "empate", pago: 10, total: 17 },
          { resultado: "blackjack", pago: 25, total: 21 }, { resultado: "pasado", pago: 0, total: 26 },
        ] : [
          { resultado: "pierde", pago: 0, total: 18 }, { resultado: "pierde", pago: 0, total: 11 },
          { resultado: "empate", pago: 10, total: 21 }, { resultado: "pierde", pago: 0, total: 16 },
        ]);
        expect(filas.every(({ apuesta }) => apuesta === 10)).toBe(true);
        expect(filas[1]!.cartas).toHaveLength(indice % 2 === 0 ? 4 : 2);
      }
      const saldos = await base.conexion<{ fichas: number; esperado: number; apuestas: number }[]>`
        SELECT u.fichas::int AS fichas, (${FICHAS_INICIALES} + sum(r.pago - r.apuesta))::int AS esperado,
          (SELECT count(*)::int FROM movimientos m WHERE m.usuario_id = u.id AND tipo = 'apuesta') AS apuestas
        FROM usuarios u JOIN rondas_jugadores r ON r.usuario_id = u.id GROUP BY u.id
      `;
      expect(saldos).toHaveLength(4);
      expect(saldos.every(({ fichas, esperado, apuestas }) => fichas === esperado && apuestas === 10)).toBe(true);
      const discrepancias = await base.conexion`
        SELECT u.id FROM usuarios u JOIN movimientos m ON m.usuario_id = u.id GROUP BY u.id
        HAVING u.fichas <> sum(m.delta_fichas) OR u.dinero <> sum(m.delta_dinero)
      `;
      expect(discrepancias).toHaveLength(0);
      expect(salida.filter((texto) => texto.includes("] ronda "))).toHaveLength(40);
      expect(salida.at(-1)).toBe("Completadas 10 rondas por bot, sin errores.");
      expect(errores).not.toHaveBeenCalled();
    } finally { proceso.kill(); await proceso.exited; await servidor.stop(true); errores.mockRestore(); await base.cerrar(); }
  }, 120_000);

  test("un rechazo al sentarse termina todo el grupo en lugar de quedarse esperando", async () => {
    const base = await crearBasePruebas(destino!);
    const servidor = iniciarAplicacion(base.conexion, 0);
    try {
      const error: unknown = await ejecutarBots(leerOpcionesBots(["4", "--mesa", "inexistente", "--url",
        `ws://127.0.0.1:${servidor.port}/ws`]), () => {}).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("La mesa no existe");
    } finally { await servidor.stop(true); await base.cerrar(); }
  });

  test("la demo continua puede cancelarse sin dejar clientes ni relojes pendientes", async () => {
    const base = await crearBasePruebas(destino!);
    const servidor = iniciarAplicacion(base.conexion, 0);
    const cancelar = new AbortController();
    try {
      // Esperar antes de evaluar el rechazo evita que el matcher asíncrono deje
      // un BEGIN pendiente en el pool Bun/Windows del mismo proceso de pruebas.
      const error: unknown = await ejecutarBots(leerOpcionesBots(["2", "--rondas", "0", "--url",
        `ws://127.0.0.1:${servidor.port}/ws`]), () => cancelar.abort(new Error("Cancelación de prueba")),
      cancelar.signal).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("Cancelación de prueba");
    } finally { await servidor.stop(true); await base.cerrar(); }
  });
});
