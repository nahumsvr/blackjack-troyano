/** Pruebas del controlador: sesión, reanudar, manejo de errores y anti doble cobro. */
import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { MensajeServidor } from "@blackjack/shared";
import type { AlmacenToken } from "../src/net/almacenToken";
import { ErrorPeticion } from "../src/net/erroresLocales";
import type { Intencion } from "../src/net/transporte";
import { ControladorJuego } from "../src/state/controlador";
import { ESTADO_INICIAL, reducir, type EstadoJuego, type EventoJuego } from "../src/state/reductor";
import { RelojManual, SESION, TOKEN, TransporteFalso, mesa, vaciarPromesas } from "./apoyo";

/** Almacén de token en memoria que registra lo que pasa. */
class AlmacenMemoria implements AlmacenToken {
  constructor(public token: string | null = null) {}
  leer() {
    return this.token;
  }
  guardar(token: string) {
    this.token = token;
  }
  borrar() {
    this.token = null;
  }
}

let transporte: TransporteFalso;
let almacen: AlmacenMemoria;
let estado: EstadoJuego;
let eventos: EventoJuego[];
let controlador: ControladorJuego;
let claves: number;

/**
 * Crea el controlador con un responder dado.
 * @param responder - Respuesta del transporte falso a cada intención.
 * @param token - Token guardado al iniciar.
 */
function crear(responder: (intencion: Intencion) => MensajeServidor | Error, token: string | null = null): void {
  transporte = new TransporteFalso(responder);
  almacen = new AlmacenMemoria(token);
  estado = ESTADO_INICIAL;
  eventos = [];
  claves = 0;
  const reloj = new RelojManual();
  controlador = new ControladorJuego(
    transporte,
    (evento) => {
      eventos.push(evento);
      estado = reducir(estado, evento);
    },
    almacen,
    { ahora: () => 1000, generarClave: () => `00000000-0000-4000-8000-00000000000${++claves}`, programar: reloj.programar },
  );
  controlador.iniciar();
}

/**
 * Crea un error del servidor.
 * @param codigo - Código del contrato.
 * @returns Error listo para que el transporte falso lo lance.
 */
function errorServidor(codigo: "SESION_INVALIDA" | "NO_ESTAS_EN_MESA" | "NO_ES_TU_TURNO" | "LIMITE_DIARIO"): ErrorPeticion {
  return new ErrorPeticion(codigo, `mensaje de ${codigo}`);
}

beforeEach(() => {
  spyOn(console, "error").mockImplementation(() => {});
});

describe("al conectar", () => {
  test("con token guardado manda reanudar y mide el desfase", async () => {
    crear((intencion) => (intencion.type === "ping" ? { type: "pong", t: 6000 } : SESION), TOKEN);
    transporte.cambiarEstado("conectado");
    await vaciarPromesas();
    expect(transporte.enviadas).toContainEqual({ type: "reanudar", token: TOKEN });
    expect(estado.conexion).toBe("conectado");
    expect(estado.desfaseMs).toBe(5000); // ahora() fijo en 1000 → servidor 5 s adelante
  });

  test("sin token no manda reanudar", async () => {
    crear(() => ({ type: "pong", t: 1000 }));
    transporte.cambiarEstado("conectado");
    await vaciarPromesas();
    expect(transporte.enviadas.map((intencion) => intencion.type)).toEqual(["ping"]);
  });

  test("token rechazado: se borra, no hay sesión y se avisa", async () => {
    crear((intencion) => (intencion.type === "reanudar" ? errorServidor("SESION_INVALIDA") : { type: "pong", t: 0 }), TOKEN);
    transporte.cambiarEstado("conectado");
    await vaciarPromesas();
    expect(almacen.token).toBeNull();
    expect(estado.sesion).toBeNull();
    expect(estado.avisos.at(-1)?.texto).toBe("mensaje de SESION_INVALIDA");
  });
});

describe("sesión", () => {
  test("cada mensaje sesion guarda el token", () => {
    crear(() => ({ type: "ok" }));
    transporte.emitir({ tipo: "mensaje", mensaje: SESION });
    expect(almacen.token).toBe(TOKEN);
    expect(estado.sesion?.usuario.id).toBe(1);
  });

  test("cerrar sesión olvida el token aunque el servidor no responda", async () => {
    crear(() => ({ type: "ok" }), TOKEN);
    transporte.emitir({ tipo: "mensaje", mensaje: SESION });
    transporte.cerrar(); // sin conexión
    expect(await controlador.cerrarSesion()).toBe(false);
    expect(almacen.token).toBeNull();
    expect(estado.sesion).toBeNull();
  });
});

describe("acciones", () => {
  test("marca la acción como pendiente solo mientras espera", async () => {
    crear(() => ({ type: "ok" }));
    transporte.conectar();
    const promesa = controlador.pedir();
    expect(estado.pendientes).toEqual(["pedir"]);
    expect(await promesa).toBe(true);
    expect(estado.pendientes).toEqual([]);
  });

  test("un error del servidor devuelve false, avisa y libera el botón", async () => {
    crear(() => errorServidor("NO_ES_TU_TURNO"));
    transporte.conectar();
    expect(await controlador.pedir()).toBe(false);
    expect(estado.pendientes).toEqual([]);
    expect(estado.avisos.at(-1)).toMatchObject({ nivel: "error", texto: "mensaje de NO_ES_TU_TURNO" });
  });

  test("NO_ESTAS_EN_MESA estando en una mesa pasa a espectador", async () => {
    crear(() => errorServidor("NO_ESTAS_EN_MESA"));
    transporte.conectar();
    transporte.emitir({ tipo: "mensaje", mensaje: { type: "mesa.estado", ...mesa("TURNOS") } });
    await controlador.plantarse();
    expect(estado.espectador).toBe(true);
  });

  test("cada compra de fichas lleva una clave distinta", async () => {
    crear(() => ({ type: "ok" }));
    transporte.conectar();
    await controlador.comprarFichas(100);
    await controlador.comprarFichas(100);
    const compras = transporte.enviadas.filter((intencion) => intencion.type === "fichas.comprar");
    expect(compras).toHaveLength(2);
    const [primera, segunda] = compras.map((intencion) => ("clave" in intencion ? intencion.clave : ""));
    expect(primera).not.toBe(segunda);
  });

  test("salir de la mesa solo vuelve al lobby si el servidor aceptó", async () => {
    crear(() => errorServidor("NO_ESTAS_EN_MESA"));
    transporte.conectar();
    transporte.emitir({ tipo: "mensaje", mensaje: { type: "mesa.estado", ...mesa("APUESTAS") } });
    expect(await controlador.salirDeMesa()).toBe(false);
    expect(estado.mesa).not.toBeNull();
    transporte.responder = () => ({ type: "ok" });
    expect(await controlador.salirDeMesa()).toBe(true);
    expect(estado.mesa).toBeNull();
  });

  test("ver más movimientos anexa la página siguiente", async () => {
    const fila = (id: string) => ({
      id,
      tipo: "pago" as const,
      deltaDinero: 0,
      deltaFichas: 20,
      dineroDespues: 0,
      fichasDespues: 20,
      referencia: null,
      creadoEn: "2026-10-05T10:00:00.000Z",
    });
    crear((intencion) =>
      intencion.type === "movimientos.listar" && "antesDe" in intencion && intencion.antesDe !== undefined
        ? { type: "movimientos", items: [fila("1")], hayMas: false }
        : { type: "movimientos", items: [fila("2")], hayMas: true },
    );
    transporte.conectar();
    await controlador.listarMovimientos();
    await controlador.listarMovimientos("2");
    expect(estado.movimientos?.items.map((item) => item.id)).toEqual(["2", "1"]);
  });

  test("un error espontáneo del servidor (sin reqId) se muestra como aviso", () => {
    crear(() => ({ type: "ok" }));
    transporte.emitir({ tipo: "mensaje", mensaje: { type: "error", codigo: "DEMASIADAS_SOLICITUDES", mensaje: "Espera" } });
    expect(estado.avisos.at(-1)?.texto).toBe("Espera");
  });

  test("una excepción inesperada se convierte en aviso genérico, sin lanzar", async () => {
    crear(() => new TypeError("fallo raro"));
    transporte.conectar();
    expect(await controlador.pedir()).toBe(false);
    expect(estado.avisos.at(-1)?.texto).toBe("Ocurrió un error inesperado en la aplicación.");
  });
});

test("iniciar dos veces no duplica la suscripción", () => {
  crear(() => ({ type: "ok" }));
  controlador.iniciar();
  transporte.emitir({ tipo: "mensaje", mensaje: { type: "bienvenida", conectados: 2 } });
  expect(eventos.filter((evento) => evento.tipo === "servidor")).toHaveLength(1);
});
