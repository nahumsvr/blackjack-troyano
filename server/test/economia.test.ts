/** Pruebas reales de SQL: cada ejecución crea y elimina solamente su propio schema. */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  BilleteraEstadoSchema, ErrorJuego, InventarioEstadoSchema, MensajeServidorSchema, MovimientoSchema,
} from "@blackjack/shared";
import { crearConexion, enTransaccion } from "../src/db/conexion";
import { BilleteraSQL } from "../src/store/BilleteraSQL";
import { consultarEstado } from "../src/store/consultas";
import { Tienda } from "../src/store/Tienda";

const destino = process.env.TEST_DATABASE_URL;
const pruebas = destino ? describe : describe.skip;

pruebas("economía y tienda contra PostgreSQL real (TEST_DATABASE_URL)", () => {
  const schema = `economia_${crypto.randomUUID().replaceAll("-", "")}`;
  let admin: SQL;
  let sql: SQL;
  let billetera: BilleteraSQL;
  let tienda: Tienda;
  let creado = false;

  beforeAll(async () => {
    admin = crearConexion(destino);
    // El identificador lo genera el test y nunca contiene entrada del usuario.
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    creado = true;
    sql = new SQL(destino!, { max: 12, connection: { search_path: schema }, prepare: false });
    await sql.unsafe(await Bun.file(new URL("../db/schema.sql", import.meta.url)).text());
    await sql.unsafe(await Bun.file(new URL("../db/seed.sql", import.meta.url)).text());
    billetera = new BilleteraSQL(sql);
    tienda = new Tienda(sql);
  });

  afterAll(async () => {
    if (sql) await sql.close();
    if (admin) {
      // CASCADE solo sobre el schema aleatorio que creó esta ejecución.
      if (creado) await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
      await admin.close();
    }
  });

  afterEach(async () => {
    const [resultado] = await sql<{ discrepancias: number }[]>`
      SELECT count(*)::int AS discrepancias FROM usuarios u
      LEFT JOIN (SELECT usuario_id, sum(delta_dinero) AS dinero, sum(delta_fichas) AS fichas
        FROM movimientos GROUP BY usuario_id) m ON m.usuario_id = u.id
      WHERE u.dinero <> COALESCE(m.dinero, 0) OR u.fichas <> COALESCE(m.fichas, 0)
    `;
    expect(resultado?.discrepancias).toBe(0);
  });

  async function usuario(dinero = 10_000, fichas = 500): Promise<number> {
    return enTransaccion(sql, async (tx) => {
      const [fila] = await tx<{ id: number }[]>`
        INSERT INTO usuarios (usuario, hash, dinero, fichas, avatar_id, reverso_id, tema_id)
        VALUES (${'u_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16)}, 'hash_de_prueba',
          ${dinero}, ${fichas}, 'avatar_basico', 'reverso_clasico', 'tema_verde') RETURNING id
      `;
      if (!fila) throw new Error("No se creó el usuario fixture");
      await tx`INSERT INTO inventario (usuario_id, articulo_id) VALUES
        (${fila.id}, 'avatar_basico'), (${fila.id}, 'reverso_clasico'), (${fila.id}, 'tema_verde')`;
      if (dinero || fichas) await tx`
        INSERT INTO movimientos (usuario_id, tipo, delta_dinero, delta_fichas, dinero_despues, fichas_despues)
        VALUES (${fila.id}, 'registro', ${dinero}, ${fichas}, ${dinero}, ${fichas})
      `;
      return fila.id;
    });
  }

  async function cantidadMovimientos(id: number): Promise<number> {
    const [fila] = await sql<{ cantidad: number }[]>`SELECT count(*)::int AS cantidad FROM movimientos WHERE usuario_id = ${id}`;
    return fila!.cantidad;
  }

  test("apuesta sin saldo conserva usuario y movimientos", async () => {
    const id = await usuario(10_000, 20);
    const antes = await billetera.consultar(id);
    await expect(billetera.debitarApuesta(id, 30, crypto.randomUUID())).rejects.toMatchObject({ codigo: "FICHAS_INSUFICIENTES" });
    expect(await billetera.consultar(id)).toEqual(antes);
    expect(await cantidadMovimientos(id)).toBe(1);
  });

  test("apuesta y blackjack 3:2 registran deltas; pago cero no escribe", async () => {
    const id = await usuario();
    const ronda = crypto.randomUUID();
    expect((await billetera.debitarApuesta(id, 10, ronda)).fichas).toBe(490);
    expect((await billetera.acreditarPago(id, 25, ronda)).fichas).toBe(515);
    const movimientos = await cantidadMovimientos(id);
    const estado = await billetera.acreditarPago(id, 0, ronda);
    expect(estado.fichas).toBe(515);
    expect(await cantidadMovimientos(id)).toBe(movimientos);
    expect(BilleteraEstadoSchema.safeParse(estado).success).toBe(true);
    expect(MensajeServidorSchema.safeParse({ type: "billetera", ...estado }).success).toBe(true);
  });

  test("dos apuestas simultáneas no pueden gastar las mismas fichas", async () => {
    const id = await usuario(10_000, 10);
    const resultados = await Promise.allSettled([0, 1].map(() => billetera.debitarApuesta(id, 10, crypto.randomUUID())));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected").map((r) => r.reason.codigo)).toEqual(["FICHAS_INSUFICIENTES"]);
    expect((await billetera.consultar(id)).fichas).toBe(0);
  });

  test("10 compras paralelas de 1000: exactamente cinco éxitos", async () => {
    const id = await usuario();
    const resultados = await Promise.allSettled(Array.from({ length: 10 }, () =>
      billetera.comprarFichas(id, 1_000, crypto.randomUUID())));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(resultados.filter((r) => r.status === "rejected").map((r) => r.reason.codigo)).toEqual(Array(5).fill("LIMITE_DIARIO"));
    const estado = await billetera.consultar(id);
    expect(estado).toMatchObject({ dinero: 5_000, fichas: 5_500, compradoHoy: 5_000, disponibleHoy: 0 });
    expect(await cantidadMovimientos(id)).toBe(6);
  });

  test("clave concurrente cobra una vez; retry funciona con límite agotado", async () => {
    const id = await usuario();
    const clave = crypto.randomUUID();
    const estados = await Promise.all(Array.from({ length: 8 }, () => billetera.comprarFichas(id, 5_000, clave)));
    expect(estados.every((e) => e.dinero === 5_000 && e.fichas === 5_500)).toBe(true);
    // La clave identifica la intención original; una cantidad válida distinta no recobra.
    expect(await billetera.comprarFichas(id, 10, clave)).toEqual(estados[0]!);
    await expect(billetera.comprarFichas(id, 10, crypto.randomUUID())).rejects.toMatchObject({ codigo: "LIMITE_DIARIO" });
    expect(await cantidadMovimientos(id)).toBe(2);
  });

  test("la misma clave pertenece a usuarios diferentes", async () => {
    const ids = await Promise.all([usuario(), usuario()]);
    const clave = crypto.randomUUID();
    expect(await Promise.all(ids.map((id) => billetera.comprarFichas(id, 10, clave)))).toHaveLength(2);
    for (const id of ids) expect((await billetera.consultar(id)).dinero).toBe(9_990);
  });

  test("dinero insuficiente hace rollback y no consume la clave", async () => {
    const id = await usuario(10, 500);
    const antes = await billetera.consultar(id);
    await expect(billetera.comprarFichas(id, 20, crypto.randomUUID())).rejects.toMatchObject({ codigo: "DINERO_INSUFICIENTE" });
    expect(await billetera.consultar(id)).toEqual(antes);
    expect(await cantidadMovimientos(id)).toBe(1);
  });

  test.each([0, -10, 10.5, 15, 1e9, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "compra inválida %p no toca el libro contable", async (cantidad) => {
      const id = await usuario();
      await expect(billetera.comprarFichas(id, cantidad, crypto.randomUUID())).rejects.toMatchObject({ codigo: "CANTIDAD_INVALIDA" });
      expect(await cantidadMovimientos(id)).toBe(1);
    },
  );

  test("UUID inválido y pago negativo se rechazan antes de SQL", async () => {
    const id = await usuario();
    await expect(billetera.comprarFichas(id, 10, "invalida")).rejects.toMatchObject({ codigo: "MENSAJE_INVALIDO" });
    await expect(billetera.acreditarPago(id, -1, crypto.randomUUID())).rejects.toMatchObject({ codigo: "CANTIDAD_INVALIDA" });
    expect(await cantidadMovimientos(id)).toBe(1);
  });

  test("compras de ayer no consumen el día actual CDMX", async () => {
    const id = await usuario();
    await billetera.comprarFichas(id, 5_000, crypto.randomUUID());
    // Solo el fixture aislado modifica fechas para cubrir el criterio T-24.
    await sql`UPDATE movimientos SET creado_en = creado_en - INTERVAL '1 day'
      WHERE usuario_id = ${id} AND tipo = 'compra_fichas'`;
    const estado = await billetera.comprarFichas(id, 5_000, crypto.randomUUID());
    expect(estado).toMatchObject({ dinero: 0, fichas: 10_500, compradoHoy: 5_000, disponibleHoy: 0 });
    const formato = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    expect(formato.format(new Date(estado.reinicioEn))).toBe("00:00");
  });

  test("día CDMX excluye justo antes de medianoche e incluye después", async () => {
    const id = await usuario();
    await billetera.comprarFichas(id, 10, crypto.randomUUID());
    await sql`UPDATE movimientos SET creado_en = '2026-10-04T05:59:59Z'::timestamptz
      WHERE usuario_id = ${id} AND tipo = 'compra_fichas'`;
    expect((await consultarEstado(sql, id, new Date("2026-10-04T06:00:00Z"))).compradoHoy).toBe(0);
    await sql`UPDATE movimientos SET creado_en = '2026-10-04T06:00:00Z'::timestamptz
      WHERE usuario_id = ${id} AND tipo = 'compra_fichas'`;
    expect((await consultarEstado(sql, id, new Date("2026-10-04T06:00:01Z"))).compradoHoy).toBe(10);
    expect((await consultarEstado(sql, id, new Date("2026-10-04T06:00:01Z"))).reinicioEn).toBe("2026-10-05T06:00:00.000Z");
  });

  test("helper transaccional revierte una escritura que termina con error", async () => {
    const id = await usuario();
    await expect(enTransaccion(sql, async (tx) => {
      await tx`UPDATE usuarios SET fichas = 1 WHERE id = ${id}`;
      throw new ErrorJuego("ERROR_INTERNO");
    })).rejects.toMatchObject({ codigo: "ERROR_INTERNO" });
    expect((await billetera.consultar(id)).fichas).toBe(500);
  });

  test("dos compras del mismo artículo cobran solo una", async () => {
    const id = await usuario();
    const resultados = await Promise.allSettled([tienda.comprar(id, "avatar_robot"), tienda.comprar(id, "avatar_robot")]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected").map((r) => r.reason.codigo)).toEqual(["YA_POSEIDO"]);
    expect((await billetera.consultar(id)).fichas).toBe(350);
    expect(await cantidadMovimientos(id)).toBe(2);
    const inventario = await tienda.inventario(id);
    expect(InventarioEstadoSchema.safeParse(inventario).success).toBe(true);
    expect(MensajeServidorSchema.safeParse({ type: "inventario", ...inventario }).success).toBe(true);
    expect(inventario.articulos.filter((a) => a.id === "avatar_robot")).toHaveLength(1);
    expect((await tienda.catalogo(id)).find((a) => a.id === "avatar_robot")?.poseido).toBe(true);
    expect(MensajeServidorSchema.safeParse({ type: "catalogo", articulos: await tienda.catalogo(id) }).success).toBe(true);
  });

  test("tienda rechaza no existente, ya poseído y saldo insuficiente sin cobrar", async () => {
    const id = await usuario(10_000, 10);
    await expect(tienda.comprar(id, "no_existe")).rejects.toMatchObject({ codigo: "ARTICULO_NO_EXISTE" });
    await expect(tienda.comprar(id, "avatar_basico")).rejects.toMatchObject({ codigo: "YA_POSEIDO" });
    await expect(tienda.comprar(id, "avatar_robot")).rejects.toMatchObject({ codigo: "FICHAS_INSUFICIENTES" });
    expect((await tienda.inventario(id)).articulos).toHaveLength(3);
    expect(await cantidadMovimientos(id)).toBe(1);
  });

  test("catálogo solo ofrece activos y el inventario conserva compras retiradas", async () => {
    const id = await usuario();
    await tienda.comprar(id, "avatar_gato");
    await sql`UPDATE articulos SET activo = false WHERE id = 'avatar_gato'`;
    try {
      expect(await tienda.catalogo(id)).toHaveLength(13);
      expect((await tienda.inventario(id)).articulos.some((a) => a.id === "avatar_gato")).toBe(true);
      await expect(tienda.comprar(await usuario(), "avatar_gato")).rejects.toMatchObject({ codigo: "ARTICULO_NO_EXISTE" });
    } finally {
      await sql`UPDATE articulos SET activo = true WHERE id = 'avatar_gato'`;
    }
  });

  test("apuesta y compra simultáneas comparten el mismo saldo disponible", async () => {
    const id = await usuario(10_000, 100);
    const resultados = await Promise.allSettled([billetera.debitarApuesta(id, 100, crypto.randomUUID()), tienda.comprar(id, "avatar_gato")]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected").map((r) => r.reason.codigo)).toEqual(["FICHAS_INSUFICIENTES"]);
    expect((await billetera.consultar(id)).fichas).toBe(0);
  });

  test("historial pagina sin duplicar filas y aísla usuarios", async () => {
    const id = await usuario();
    const otro = await usuario();
    await billetera.comprarFichas(id, 10, crypto.randomUUID());
    await billetera.debitarApuesta(id, 10, crypto.randomUUID());
    await tienda.comprar(id, "avatar_gato");
    await billetera.comprarFichas(otro, 10, crypto.randomUUID());
    const primera = await tienda.listarMovimientos(id, 2);
    expect(primera.hayMas).toBe(true);
    expect(MensajeServidorSchema.safeParse({ type: "movimientos", ...primera }).success).toBe(true);
    expect(primera.items.map((m) => m.tipo)).toEqual(["compra_articulo", "apuesta"]);
    const segunda = await tienda.listarMovimientos(id, 2, primera.items.at(-1)!.id);
    expect(segunda.hayMas).toBe(false);
    expect(segunda.items.map((m) => m.tipo)).toEqual(["compra_fichas", "registro"]);
    const items = [...primera.items, ...segunda.items];
    expect(new Set(items.map((m) => m.id)).size).toBe(4);
    expect(items.every((m) => MovimientoSchema.safeParse(m).success)).toBe(true);
    expect(await tienda.listarMovimientos(id, 100, "1")).toEqual({ items: [], hayMas: false });
  });

  test("cursor bigint grande se conserva como cadena exacta", async () => {
    const id = await usuario();
    await sql.unsafe("ALTER SEQUENCE movimientos_id_seq RESTART WITH 9007199254740993");
    await billetera.comprarFichas(id, 10, crypto.randomUUID());
    const pagina = await tienda.listarMovimientos(id, 1);
    expect(pagina.items[0]!.id).toBe("9007199254740993");
    const anterior = await tienda.listarMovimientos(id, 1, pagina.items[0]!.id);
    expect(anterior.items[0]!.tipo).toBe("registro");
  });

  test("paginación inválida y usuarios ausentes producen errores de dominio", async () => {
    const id = await usuario();
    for (const limite of [0, 101, 1.5]) await expect(tienda.listarMovimientos(id, limite)).rejects.toMatchObject({ codigo: "MENSAJE_INVALIDO" });
    for (const cursor of ["0", "-1", "abc", "9223372036854775808"]) await expect(tienda.listarMovimientos(id, 50, cursor)).rejects.toMatchObject({ codigo: "MENSAJE_INVALIDO" });
    await expect(billetera.consultar(2_147_483_647)).rejects.toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  test("sumar un pago que excede enteros JSON seguros revierte", async () => {
    const id = await usuario(10_000, Number.MAX_SAFE_INTEGER);
    await expect(billetera.acreditarPago(id, 1, crypto.randomUUID())).rejects.toMatchObject({ codigo: "ERROR_INTERNO" });
    expect((await billetera.consultar(id)).fichas).toBe(Number.MAX_SAFE_INTEGER);
    expect(await cantidadMovimientos(id)).toBe(1);
  });
});
