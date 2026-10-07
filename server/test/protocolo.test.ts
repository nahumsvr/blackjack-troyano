/** T-03: ejemplos completos, rechazo por mensaje y fronteras del contrato público. */
import { describe, expect, test } from "bun:test";
import {
  CartaVistaSchema, CodigoErrorSchema, ErrorJuego, MENSAJES_ERROR,
  MensajeClienteSchema, MensajeServidorSchema, MesaEstadoSchema, crearErrorValidacion, crearMensajeClienteSchema, extraerReqId,
  type EntradaMensajeCliente, type MensajeServidor, type MesaEstado,
} from "@blackjack/shared";
import { LIMITES_CANTIDAD } from "@blackjack/shared";
import { APUESTA_MAX, APUESTA_MIN, COMPRA_FICHAS_MAX, COMPRA_FICHAS_MIN, MULTIPLO_FICHAS } from "../src/config";

const uuid = "9e712309-50ac-4bca-a123-8239dc54ce87";
test("correlación compartida acepta solo reqId válido incluso en entradas malformadas", () => {
  for (const entrada of [null, undefined, 1, "texto", [], {}, { reqId: null }, { reqId: 7 }, { reqId: "x".repeat(37) }]) {
    expect(extraerReqId(entrada)).toBeUndefined();
  }
  for (const reqId of ["", "peticion", "x".repeat(36)]) {
    const entrada = { type: "inventado", reqId };
    expect(extraerReqId(entrada)).toBe(reqId);
    const validado = MensajeClienteSchema.safeParse(entrada);
    if (validado.success) throw new Error("La entrada debe rechazarse");
    expect(crearErrorValidacion(entrada, validado.error).reqId).toBe(reqId);
  }
});
const token = "a".repeat(64);
const equipado = { avatar: "avatar_basico", reverso: "reverso_clasico", tema: "tema_verde" };
const billetera = {
  dinero: 10000, fichas: 500, compradoHoy: 0, disponibleHoy: 5000,
  limiteDiario: 5000, reinicioEn: "2026-10-05T00:00:00-06:00",
};
const articulo = { id: "avatar_basico", tipo: "avatar", nombre: "Básico", precio: 0 } as const;
const mesa: MesaEstado = {
  id: "mesa-1", nombre: "Mesa 1", fase: "TURNOS", finEn: 1791138000000, turnoDe: 1,
  dealer: { cartas: [{ palo: "♥", rango: "A" }, { oculta: true }], total: null },
  asientos: [{
    indice: 0, usuarioId: 1, usuario: "Massimo", avatar: equipado.avatar, reverso: equipado.reverso,
    conectado: true, apuesta: 10, cartas: [{ palo: "♠", rango: "K" }], total: 10, estado: "JUGANDO",
  }, null, null, null, null],
};

type Ejemplo = { valido: Record<string, unknown>; invalido: Record<string, unknown> };
const clientes: Record<EntradaMensajeCliente["type"], Ejemplo> = {
  registro: { valido: { usuario: "Massimo", contrasena: "secreto" }, invalido: { usuario: "x", contrasena: "secreto" } },
  login: { valido: { usuario: "Massimo", contrasena: "secreto" }, invalido: { usuario: "Massimo", contrasena: "corta" } },
  reanudar: { valido: { token }, invalido: { token: "x" } },
  logout: { valido: {}, invalido: { token } },
  "lobby.listar": { valido: {}, invalido: { reqId: 1 } },
  "mesa.unirse": { valido: { mesaId: "mesa-1" }, invalido: { mesaId: "" } },
  "mesa.salir": { valido: {}, invalido: { mesaId: "mesa-1" } },
  apostar: { valido: { cantidad: 10 }, invalido: { cantidad: 15 } },
  pedir: { valido: {}, invalido: { cantidad: 10 } },
  plantarse: { valido: {}, invalido: { reqId: null } },
  "billetera.consultar": { valido: {}, invalido: { usuarioId: 1 } },
  "fichas.comprar": { valido: { cantidad: 5000, clave: uuid }, invalido: { cantidad: 10, clave: "x" } },
  "tienda.catalogo": { valido: {}, invalido: { reqId: 1 } },
  "tienda.comprar": { valido: { articuloId: articulo.id }, invalido: { articuloId: 1 } },
  "inventario.listar": { valido: {}, invalido: { articulos: [] } },
  "inventario.equipar": { valido: { articuloId: articulo.id }, invalido: { articuloId: "a".repeat(41) } },
  "movimientos.listar": { valido: { limite: 50, antesDe: "9007199254740993" }, invalido: { limite: 101 } },
  ping: { valido: {}, invalido: { reqId: "a".repeat(37) } },
};
const servidores: Record<MensajeServidor["type"], Ejemplo> = {
  bienvenida: { valido: { conectados: 3 }, invalido: { conectados: -1 } },
  sesion: {
    valido: { token, usuario: { id: 1, usuario: "Massimo" }, billetera, equipado, mesaId: null },
    invalido: { token, usuario: { id: 1, usuario: "Massimo" }, billetera, equipado, mesaId: 1 },
  },
  lobby: {
    valido: { mesas: [{ id: "mesa-1", nombre: "Mesa 1", ocupados: 1, capacidad: 5, fase: "TURNOS" }] },
    invalido: { mesas: [{ id: "mesa-1", nombre: "Mesa 1", ocupados: 6, capacidad: 5, fase: "TURNOS" }] },
  },
  "mesa.estado": { valido: mesa, invalido: { ...mesa, asientos: [] } },
  "ronda.resultado": {
    valido: { rondaId: uuid, dealer: { cartas: [{ palo: "♥", rango: "A" }], total: 11 },
      resultados: [{ usuarioId: 1, resultado: "blackjack", apuesta: 10, pago: 25 }] },
    invalido: { rondaId: uuid, dealer: { cartas: [{ oculta: true }], total: 11 }, resultados: [] },
  },
  billetera: { valido: billetera, invalido: { ...billetera, disponibleHoy: 4999 } },
  catalogo: { valido: { articulos: [{ ...articulo, poseido: true }] }, invalido: { articulos: [articulo] } },
  inventario: { valido: { articulos: [articulo], equipado }, invalido: { articulos: [articulo], equipado: {} } },
  movimientos: {
    valido: { items: [{ id: "9007199254740993", tipo: "registro", deltaDinero: 10000, deltaFichas: 500,
      dineroDespues: 10000, fichasDespues: 500, referencia: null, creadoEn: "2026-10-04T12:00:00Z" }], hayMas: false },
    invalido: { items: [], hayMas: "no" },
  },
  ok: { valido: {}, invalido: { reqId: 1 } },
  error: { valido: { codigo: "NO_ES_TU_TURNO", mensaje: "No es tu turno" }, invalido: { codigo: "X", mensaje: "Error" } },
  pong: { valido: { t: 1791138000000 }, invalido: { t: "ahora" } },
};

describe("T-03: todos los mensajes cliente", () => {
  for (const [type, ejemplo] of Object.entries(clientes)) {
    test(`${type}: válido e inválido`, () => {
      expect(MensajeClienteSchema.safeParse({ type, reqId: "solicitud-1", ...ejemplo.valido }).success).toBe(true);
      expect(MensajeClienteSchema.safeParse({ type, ...ejemplo.invalido }).success).toBe(false);
    });
  }
});
describe("T-03: todos los mensajes servidor", () => {
  for (const [type, ejemplo] of Object.entries(servidores)) {
    test(`${type}: válido e inválido`, () => {
      expect(MensajeServidorSchema.safeParse({ type, reqId: "solicitud-1", ...ejemplo.valido }).success).toBe(true);
      expect(MensajeServidorSchema.safeParse({ type, ...ejemplo.invalido }).success).toBe(false);
    });
  }
});
describe("T-03: fronteras de validación", () => {
  test("config del servidor y contrato comparten los mismos límites de cantidad", () => {
    // Si alguien vuelve a escribir literales en config.ts, cliente y servidor validarían distinto.
    expect({ apuestaMin: APUESTA_MIN, apuestaMax: APUESTA_MAX, compraMin: COMPRA_FICHAS_MIN,
      compraMax: COMPRA_FICHAS_MAX, multiplo: MULTIPLO_FICHAS }).toEqual(LIMITES_CANTIDAD);
    expect(MensajeClienteSchema.safeParse({ type: "apostar", cantidad: APUESTA_MAX }).success).toBe(true);
    expect(MensajeClienteSchema.safeParse({ type: "apostar", cantidad: APUESTA_MAX + MULTIPLO_FICHAS }).success).toBe(false);
    expect(MensajeClienteSchema.safeParse({ type: "fichas.comprar", cantidad: COMPRA_FICHAS_MIN - MULTIPLO_FICHAS, clave: uuid }).success).toBe(false);
  });
  test("el servidor puede usar sus límites configurables sin duplicar el contrato", () => {
    const esquema = crearMensajeClienteSchema({ apuestaMin: 20, apuestaMax: 1000, compraMin: 20, compraMax: 10000, multiplo: 20 });
    expect(esquema.safeParse({ type: "apostar", cantidad: 1000 }).success).toBe(true);
    expect(esquema.safeParse({ type: "apostar", cantidad: 10 }).success).toBe(false);
    expect(esquema.safeParse({ type: "fichas.comprar", cantidad: 10000, clave: uuid }).success).toBe(true);
    expect(() => crearMensajeClienteSchema({ apuestaMin: 1000, apuestaMax: 20, compraMin: 10, compraMax: 5000, multiplo: 10 })).toThrow();
  });
  test("reducir el límite diario conserva lo comprado y muestra cero disponible", () => {
    expect(MensajeServidorSchema.safeParse({ type: "billetera", ...billetera,
      compradoHoy: 5000, limiteDiario: 1000, disponibleHoy: 0 }).success).toBe(true);
  });
  test("rechaza tipos desconocidos, null, arrays y campos sobrantes sin coerción", () => {
    for (const entrada of [null, [], {}, { type: "x" }, { type: "ping", extra: true }, { type: "apostar", cantidad: "10" }]) {
      expect(MensajeClienteSchema.safeParse(entrada).success).toBe(false);
    }
  });
  test("aplica el límite por defecto sin alterar el cursor bigserial", () => {
    expect(MensajeClienteSchema.parse({ type: "movimientos.listar", antesDe: "9007199254740993" }))
      .toEqual({ type: "movimientos.listar", limite: 50, antesDe: "9007199254740993" });
    for (const antesDe of [0, "0", "-1", "01", "1.5", "9223372036854775808", "1".repeat(20)]) {
      expect(MensajeClienteSchema.safeParse({ type: "movimientos.listar", antesDe }).success).toBe(false);
    }
  });
  test("acepta fronteras de apuesta y compra; clasifica cantidades inválidas", () => {
    for (const [type, max] of [["apostar", 500], ["fichas.comprar", 5000]] as const) {
      for (const cantidad of [10, max]) {
        expect(MensajeClienteSchema.safeParse({ type, cantidad, ...(type === "fichas.comprar" ? { clave: uuid } : {}) }).success).toBe(true);
      }
      for (const cantidad of [0, -10, 10.5, 15, max + 10, 1e9, "abc", null, Number.MAX_SAFE_INTEGER + 1]) {
        const entrada = { type, cantidad, reqId: "compra-1", ...(type === "fichas.comprar" ? { clave: uuid } : {}) };
        const resultado = MensajeClienteSchema.safeParse(entrada);
        expect(resultado.success).toBe(false);
        if (!resultado.success) {
          expect(crearErrorValidacion(entrada, resultado.error)).toEqual({
            type: "error", codigo: "CANTIDAD_INVALIDA", mensaje: MENSAJES_ERROR.CANTIDAD_INVALIDA, reqId: "compra-1",
          });
        }
      }
    }
  });
  test("estructura mal formada tiene prioridad y no refleja reqId inválido", () => {
    for (const entrada of [{ type: "apostar" }, { type: "apostar", cantidad: -10, extra: true },
      { type: "apostar", cantidad: -10, reqId: 1 }, { type: "fichas.comprar", cantidad: -10, clave: "x" }]) {
      const resultado = MensajeClienteSchema.safeParse(entrada);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(crearErrorValidacion(entrada, resultado.error).codigo).toBe("MENSAJE_INVALIDO");
        expect(crearErrorValidacion(entrada, resultado.error).reqId).toBeUndefined();
      }
    }
  });
  test("toda carta oculta contiene únicamente oculta:true", () => {
    expect(CartaVistaSchema.safeParse({ oculta: true }).success).toBe(true);
    expect(CartaVistaSchema.safeParse({ oculta: true, palo: "♥", rango: "A" }).success).toBe(false);
    expect(CartaVistaSchema.safeParse({ oculta: false }).success).toBe(false);
  });
  test("snapshots impiden filtrar carta/total del dealer antes de DEALER", () => {
    const revelado = { cartas: [{ palo: "♥", rango: "A" }, { palo: "♠", rango: "K" }], total: 21 };
    expect(MesaEstadoSchema.safeParse({ ...mesa, dealer: revelado }).success).toBe(false);
    expect(MesaEstadoSchema.safeParse({ ...mesa, dealer: { ...mesa.dealer, total: 21 } }).success).toBe(false);
    for (const fase of ["DEALER", "PAGOS"]) {
      expect(MesaEstadoSchema.safeParse({ ...mesa, fase, dealer: revelado }).success).toBe(true);
      expect(MesaEstadoSchema.safeParse({ ...mesa, fase }).success).toBe(false);
    }
    expect(MensajeServidorSchema.safeParse({ type: "mesa.estado", ...mesa, dealer: revelado }).success).toBe(false);
  });
  test("rechaza dinero inseguro, movimientos sin cambios e índices de asiento incorrectos", () => {
    expect(MensajeServidorSchema.safeParse({ type: "billetera", ...billetera, dinero: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false);
    expect(MesaEstadoSchema.safeParse({ ...mesa, asientos: [null, mesa.asientos[0], null, null, null] }).success).toBe(false);
    const valido = servidores.movimientos.valido;
    const items = valido.items as Array<Record<string, unknown>>;
    expect(MensajeServidorSchema.safeParse({ type: "movimientos", ...valido,
      items: [{ ...items[0], deltaDinero: 0, deltaFichas: 0 }] }).success).toBe(false);
  });
  test("todos los códigos tienen mensaje español y conservan el código de dominio", () => {
    for (const codigo of CodigoErrorSchema.options) {
      const error = new ErrorJuego(codigo);
      expect(error).toBeInstanceOf(Error);
      expect(error.codigo).toBe(codigo);
      expect(error.message).toBe(MENSAJES_ERROR[codigo]);
      expect(error.name).toBe("ErrorJuego");
      expect(MensajeServidorSchema.safeParse({ type: "error", codigo, mensaje: error.message }).success).toBe(true);
    }
  });
});
