/**
 * Pruebas del modo mock: todos los datos de ejemplo cumplen el contrato de `shared`
 * y el servidor falso responde como el real a los flujos principales y a sus errores.
 */
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { FaseMesaSchema, MensajeServidorSchema, ResultadoSchema, type MensajeServidor } from "@blackjack/shared";
import { ErrorPeticion } from "../src/net/erroresLocales";
import { LOBBY_DEMO, RESULTADO_DEMO, billeteraInicial, catalogoDemo, mesaEnFase, movimientosDemo, resultadoDemo } from "../src/mock/fixtures";
import { ServidorFalso } from "../src/mock/servidorFalso";
import type { Intencion } from "../src/net/transporte";

describe("fixtures dentro de contrato", () => {
  test.each(FaseMesaSchema.options)("snapshot de la fase %s", (fase) => {
    const resultado = MensajeServidorSchema.safeParse({ type: "mesa.estado", ...mesaEnFase(fase, 1_000) });
    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  test("resultado, billetera, lobby, historial y catálogo", () => {
    const mensajes = [
      { type: "ronda.resultado", ...RESULTADO_DEMO },
      { type: "billetera", ...billeteraInicial() },
      { type: "lobby", mesas: LOBBY_DEMO },
      { type: "movimientos", items: movimientosDemo(), hayMas: false },
      { type: "catalogo", articulos: catalogoDemo() },
    ];
    for (const mensaje of mensajes) expect(MensajeServidorSchema.safeParse(mensaje).error?.issues ?? []).toEqual([]);
  });

  test.each(ResultadoSchema.options)("ronda de ejemplo con resultado %s", (resultado) => {
    const mensaje = { type: "ronda.resultado", ...resultadoDemo(resultado, crypto.randomUUID()) };
    expect(MensajeServidorSchema.safeParse(mensaje).error?.issues ?? []).toEqual([]);
  });

  test("el historial es coherente: cada saldo es el anterior más su cambio", () => {
    const cronologico = movimientosDemo().reverse();
    let fichas = 0;
    for (const fila of cronologico) {
      fichas += fila.deltaFichas;
      expect(fila.fichasDespues).toBe(fichas);
    }
  });
});

describe("ServidorFalso", () => {
  let servidor: ServidorFalso;

  beforeEach(async () => {
    servidor = new ServidorFalso({ latenciaMs: 0 });
    servidor.conectar();
    await Bun.sleep(1);
  });

  /**
   * Envía y devuelve el código de error, o `null` si tuvo éxito.
   * @param intencion - Intención a enviar.
   * @returns Código del error o `null`.
   */
  async function codigo(intencion: Intencion): Promise<string | null> {
    try {
      await servidor.enviar(intencion);
      return null;
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorPeticion);
      return (error as ErrorPeticion).codigo;
    }
  }

  test("exige sesión y rechaza intenciones fuera de contrato", async () => {
    expect(await codigo({ type: "lobby.listar" })).toBe("NO_AUTENTICADO");
    expect(await codigo({ type: "apostar", cantidad: 15 })).toBe("MENSAJE_CLIENTE_INVALIDO");
  });

  test("registro, usuario existente y credenciales inválidas", async () => {
    expect(await codigo({ type: "registro", usuario: "existe", contrasena: "secreta" })).toBe("USUARIO_EXISTE");
    expect(await codigo({ type: "login", usuario: "demo", contrasena: "incorrecta" })).toBe("CREDENCIALES_INVALIDAS");
    expect(await codigo({ type: "login", usuario: "demo", contrasena: "secreta" })).toBeNull();
    expect(await codigo({ type: "login", usuario: "demo", contrasena: "secreta" })).toBe("YA_AUTENTICADO");
  });

  test("ronda: apostar una vez, fase incorrecta, turno y mesa llena", async () => {
    await servidor.enviar({ type: "login", usuario: "demo", contrasena: "secreta" });
    expect(await codigo({ type: "mesa.unirse", mesaId: "mesa-3" })).toBe("MESA_LLENA");
    expect(await codigo({ type: "mesa.unirse", mesaId: "mesa-9" })).toBe("MESA_NO_EXISTE");
    expect(await codigo({ type: "mesa.unirse", mesaId: "mesa-1" })).toBeNull();
    expect(await codigo({ type: "pedir" })).toBe("FASE_INCORRECTA");
    expect(await codigo({ type: "apostar", cantidad: 100 })).toBeNull();
    expect(await codigo({ type: "apostar", cantidad: 100 })).toBe("YA_APOSTASTE");
    servidor.irAFase("TURNOS");
    expect(await codigo({ type: "pedir" })).toBeNull();
    expect(await codigo({ type: "plantarse" })).toBeNull();
    expect(await codigo({ type: "pedir" })).toBe("NO_ES_TU_TURNO");
  });

  test("compra de fichas: límite diario, dinero e idempotencia por clave", async () => {
    await servidor.enviar({ type: "login", usuario: "demo", contrasena: "secreta" });
    const clave = "11111111-1111-4111-8111-111111111111";
    const primera = await servidor.enviar({ type: "fichas.comprar", cantidad: 3000, clave });
    const repetida = await servidor.enviar({ type: "fichas.comprar", cantidad: 3000, clave });
    expect(repetida).toMatchObject({ type: "billetera", fichas: 3500, compradoHoy: 3000 });
    expect(primera).toMatchObject({ fichas: 3500 });
    expect(await codigo({ type: "fichas.comprar", cantidad: 2010, clave: "22222222-2222-4222-8222-222222222222" })).toBe("LIMITE_DIARIO");
    expect(await codigo({ type: "fichas.comprar", cantidad: 2000, clave: "33333333-3333-4333-8333-333333333333" })).toBeNull();
    expect(await codigo({ type: "fichas.comprar", cantidad: 10, clave: "44444444-4444-4444-8444-444444444444" })).toBe("LIMITE_DIARIO");
  });

  test("historial paginado con antesDe", async () => {
    await servidor.enviar({ type: "login", usuario: "demo", contrasena: "secreta" });
    const primera = await servidor.enviar({ type: "movimientos.listar", limite: 5 });
    expect(primera).toMatchObject({ type: "movimientos", hayMas: true });
    const segunda = await servidor.enviar({ type: "movimientos.listar", limite: 5, antesDe: "8" });
    expect(segunda.type === "movimientos" && segunda.items.map((fila) => fila.id)).toEqual(["7", "6", "5", "4", "3"]);
  });

  test("sin conexión rechaza con SIN_CONEXION", async () => {
    servidor.cerrar();
    expect(await codigo({ type: "ping" })).toBe("SIN_CONEXION");
  });

  test("un cierre antes de terminar de conectar no deja la conexión abierta", async () => {
    const otro = new ServidorFalso({ latenciaMs: 0 });
    const estados: string[] = [];
    otro.suscribir((evento) => evento.tipo === "conexion" && estados.push(evento.estado));
    otro.conectar();
    otro.cerrar();
    await Bun.sleep(1);
    expect(estados).toEqual(["conectando", "cerrado"]);
  });

  test("nunca publica mensajes fuera de contrato", async () => {
    const error = spyOn(console, "error");
    error.mockClear(); // otro archivo de pruebas pudo espiar console.error antes
    await servidor.enviar({ type: "login", usuario: "demo", contrasena: "secreta" });
    await servidor.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    for (const fase of FaseMesaSchema.options) servidor.irAFase(fase);
    expect(error).not.toHaveBeenCalled();
  });

  test("simularResultado: ronda nueva con el resultado elegido y el pago acreditado", async () => {
    const recibidos: MensajeServidor[] = [];
    servidor.suscribir((evento) => {
      if (evento.tipo === "mensaje") recibidos.push(evento.mensaje);
    });
    await servidor.enviar({ type: "login", usuario: "demo", contrasena: "secreta" });
    await servidor.enviar({ type: "mesa.unirse", mesaId: "mesa-1" });
    const fichasAntes = billeteraInicial().fichas;

    servidor.simularResultado("blackjack");
    servidor.simularResultado("pierde");

    const rondas = recibidos.filter((mensaje) => mensaje.type === "ronda.resultado");
    expect(rondas.map((ronda) => ronda.resultados.find((fila) => fila.usuarioId === 1)?.resultado)).toEqual(["blackjack", "pierde"]);
    expect(rondas[0]?.rondaId).not.toBe(rondas[1]?.rondaId);
    // Solo el blackjack paga (250); perder no emite billetera.
    const billeteras = recibidos.filter((mensaje) => mensaje.type === "billetera");
    expect(billeteras.at(-1)?.fichas).toBe(fichasAntes + 250);
  });
});
