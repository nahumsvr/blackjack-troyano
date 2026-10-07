/** T-26: cuatro clientes automáticos, WS real y diez liquidaciones SQL con relojes reales. */
import { describe, expect, spyOn, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { MensajeClienteSchema, MensajeServidorSchema, type Asiento, type MensajeServidor,
  type MesaEstado } from "@blackjack/shared";
import { ejecutarBots, leerOpcionesBots } from "../../scripts/bots";
import { BOTS_MARGEN_APUESTA_MS, FICHAS_INICIALES } from "../src/config";
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

/** Servidor WS falso: guiona plazos y rechazos que con la mesa real dependen de la latencia SQL. */
function iniciarServidorGuionado() {
  type Datos = { id: number };
  const sockets = new Map<number, Bun.ServerWebSocket<Datos>>();
  const sentados = new Set<number>();
  const apuestas: { id: number; plazoCorto: boolean }[] = [];
  const salidas: number[] = [];
  let finEn: number | null = null;
  let plazoCorto = false;
  let siguienteId = 0;
  let apostados = new Set<number>();
  const rondaId = crypto.randomUUID();
  const enviar = (socket: Bun.ServerWebSocket<Datos>, mensaje: MensajeServidor): void => {
    socket.send(JSON.stringify(MensajeServidorSchema.parse(mensaje)));
  };
  const estado = (fase: MesaEstado["fase"], reqId?: string): MensajeServidor => ({
    type: "mesa.estado", reqId, id: "mesa-1", nombre: "Mesa 1", fase, finEn, turnoDe: null,
    dealer: { cartas: [], total: null },
    asientos: Array.from({ length: 5 }, (_, indice) => {
      const id = [...sentados][indice];
      return id === undefined ? null : { indice: indice as Asiento["indice"], usuarioId: id, usuario: `bot_${id}`,
        avatar: "avatar_basico", reverso: "reverso_basico", conectado: true, apuesta: apostados.has(id) ? 10 : 0,
        cartas: [], total: 0, estado: apostados.has(id) ? "APOSTADO" : "SIN_APUESTA" };
    }),
  });
  /** Abre apuestas con el plazo indicado y publica el snapshot a todos los sentados. */
  const abrirApuestas = (restante: number) => {
    finEn = Date.now() + restante;
    plazoCorto = restante < BOTS_MARGEN_APUESTA_MS;
    apostados = new Set();
    for (const id of sentados) enviar(sockets.get(id)!, estado("APUESTAS"));
  };
  const servidor = Bun.serve<Datos, never>({
    port: 0,
    fetch: (peticion, srv) => srv.upgrade(peticion, { data: { id: ++siguienteId } }) ? undefined : new Response(null, { status: 400 }),
    websocket: {
      open: (socket) => { sockets.set(socket.data.id, socket); },
      message: (socket, datos) => {
        const mensaje = MensajeClienteSchema.parse(JSON.parse(String(datos)));
        const id = socket.data.id;
        switch (mensaje.type) {
          case "registro": return enviar(socket, { type: "sesion", reqId: mensaje.reqId, token: "a".repeat(64),
            usuario: { id, usuario: mensaje.usuario }, mesaId: null,
            billetera: { dinero: 0, fichas: id === 1 ? 500 : 0, compradoHoy: 0, disponibleHoy: 5000,
              limiteDiario: 5000, reinicioEn: new Date().toISOString() },
            equipado: { avatar: "avatar_basico", reverso: "reverso_basico", tema: "tema_basico" } });
          case "mesa.unirse":
            sentados.add(id);
            enviar(socket, estado("ESPERANDO", mensaje.reqId));
            // Primer plazo por debajo del margen: ningún bot debe arriesgar la apuesta.
            if (sentados.size === 2) { abrirApuestas(BOTS_MARGEN_APUESTA_MS / 2); setTimeout(() => abrirApuestas(15_000), 100); }
            return;
          case "apostar":
            apuestas.push({ id, plazoCorto });
            // Bot 2 no tiene fichas; la primera apuesta del bot 1 llega como si el plazo
            // hubiera vencido mientras esperaba los débitos SQL de otros jugadores.
            if (id === 2) return enviar(socket, { type: "error", reqId: mensaje.reqId, codigo: "FICHAS_INSUFICIENTES", mensaje: "No tienes suficientes fichas" });
            if (apuestas.filter((apuesta) => apuesta.id === 1).length === 1) {
              enviar(socket, { type: "error", reqId: mensaje.reqId, codigo: "FASE_INCORRECTA", mensaje: "Esta acción no está disponible en la fase actual" });
              return void setTimeout(() => abrirApuestas(15_000), 50);
            }
            apostados.add(id);
            enviar(socket, estado("APUESTAS", mensaje.reqId));
            return enviar(socket, { type: "ronda.resultado", rondaId, dealer: { cartas: [{ palo: "♠", rango: "10" }, { palo: "♠", rango: "8" }], total: 18 },
              resultados: [{ usuarioId: id, resultado: "gana", apuesta: 10, pago: 20 }] });
          case "mesa.salir":
            sentados.delete(id);
            salidas.push(id);
            return enviar(socket, { type: "ok", reqId: mensaje.reqId });
          default: throw new Error(`Mensaje inesperado: ${mensaje.type}`);
        }
      },
    },
  });
  return { servidor, apuestas, salidas };
}

test("una apuesta tardía y un bot sin fichas no detienen al resto del grupo", async () => {
  const { servidor, apuestas, salidas } = iniciarServidorGuionado();
  const registro: string[] = [];
  try {
    const resultado = await ejecutarBots(leerOpcionesBots(["2", "--rondas", "1", "--url",
      `ws://127.0.0.1:${servidor.port}/ws`]), (texto) => registro.push(texto));
    // Nadie apostó con menos del margen; el bot 1 reintentó solo con el snapshot nuevo.
    expect(apuestas.some(({ plazoCorto }) => plazoCorto)).toBe(false);
    expect(apuestas.filter(({ id }) => id === 1)).toHaveLength(2);
    expect(apuestas.filter(({ id }) => id === 2)).toHaveLength(1);
    expect(salidas).toEqual([2]);
    expect(resultado.map(({ rondas, retirado }) => ({ rondas: rondas.length, retirado })))
      .toEqual([{ rondas: 1, retirado: false }, { rondas: 0, retirado: true }]);
    expect(registro.at(-1)).toBe("1 bots sin fichas dejaron la mesa; el resto completó 1 rondas.");
  } finally { await servidor.stop(true); }
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
