/** Pruebas del reductor puro del estado del cliente. */
import { describe, expect, test } from "bun:test";
import type { MensajeServidor } from "@blackjack/shared";
import { ESTADO_INICIAL, reducir, type EstadoJuego, type EventoJuego } from "../src/state/reductor";
import { BILLETERA, SESION, mesa } from "./apoyo";

/**
 * Aplica varios eventos en orden.
 * @param eventos - Eventos a aplicar sobre el estado inicial.
 * @returns Estado final.
 */
function aplicar(...eventos: EventoJuego[]): EstadoJuego {
  return eventos.reduce(reducir, ESTADO_INICIAL);
}

const conSesion: EventoJuego = { tipo: "servidor", mensaje: SESION };

describe("mensajes del servidor", () => {
  test("bienvenida guarda los conectados", () => {
    expect(aplicar({ tipo: "servidor", mensaje: { type: "bienvenida", conectados: 3 } }).conectados).toBe(3);
  });

  test("sesion guarda usuario, billetera y mesa", () => {
    const estado = aplicar(conSesion);
    expect(estado.sesion?.usuario.usuario).toBe("nahum");
    expect(estado.billetera).toEqual(BILLETERA);
    expect(estado.mesaId).toBeNull();
  });

  test("lobby reemplaza la lista de mesas", () => {
    const mesas = [{ id: "mesa-1", nombre: "Mesa 1", ocupados: 2, capacidad: 5 as const, fase: "APUESTAS" as const }];
    expect(aplicar({ tipo: "servidor", mensaje: { type: "lobby", mesas } }).lobby).toEqual(mesas);
  });

  test("mesa.estado guarda el snapshot sin type ni reqId", () => {
    const estado = aplicar({ tipo: "servidor", mensaje: { type: "mesa.estado", reqId: "r1", ...mesa("TURNOS") } });
    expect(estado.mesa).toEqual(mesa("TURNOS"));
    expect(estado.mesaId).toBe("mesa-1");
  });

  test("ronda.resultado se muestra hasta que empieza la siguiente fase de apuestas", () => {
    const resultado: EventoJuego = {
      tipo: "servidor",
      mensaje: {
        type: "ronda.resultado",
        rondaId: "0b4e7a1c-6a43-4c1e-9f0e-3f3c9b2a1d10",
        dealer: { cartas: [{ palo: "♠", rango: "K" }, { palo: "♥", rango: "7" }], total: 17 },
        resultados: [{ usuarioId: 1, resultado: "gana", apuesta: 100, pago: 200 }],
      },
    };
    const enPagos = aplicar({ tipo: "servidor", mensaje: { type: "mesa.estado", ...mesa("PAGOS") } }, resultado);
    expect(enPagos.resultado?.resultados[0]?.pago).toBe(200);
    const siguiente = reducir(enPagos, { tipo: "servidor", mensaje: { type: "mesa.estado", ...mesa("APUESTAS") } });
    expect(siguiente.resultado).toBeNull();
  });

  test("billetera reemplaza el saldo sin type ni reqId", () => {
    const nueva = { ...BILLETERA, fichas: 1500, dinero: 9000, compradoHoy: 1000, disponibleHoy: 4000 };
    expect(aplicar(conSesion, { tipo: "servidor", mensaje: { type: "billetera", reqId: "r", ...nueva } }).billetera).toEqual(nueva);
  });

  test("inventario actualiza también lo equipado de la sesión", () => {
    const equipado = { avatar: "avatar_robot", reverso: "reverso_clasico", tema: "tema_verde" };
    const estado = aplicar(conSesion, { tipo: "servidor", mensaje: { type: "inventario", articulos: [], equipado } });
    expect(estado.sesion?.equipado).toEqual(equipado);
  });

  test("error, ok, pong y movimientos no cambian el estado (los procesa el controlador)", () => {
    const base = aplicar(conSesion);
    const mensajes: MensajeServidor[] = [
      { type: "error", codigo: "NO_ES_TU_TURNO", mensaje: "No es tu turno" },
      { type: "ok" },
      { type: "pong", t: 5 },
      { type: "movimientos", items: [], hayMas: false },
    ];
    for (const mensaje of mensajes) {
      expect(reducir(base, { tipo: "servidor", mensaje })).toBe(base);
    }
  });
});

describe("eventos locales", () => {
  test("pendiente agrega y quita la acción sin duplicarla", () => {
    let estado = aplicar({ tipo: "pendiente", accion: "apostar", activo: true }, { tipo: "pendiente", accion: "apostar", activo: true });
    expect(estado.pendientes).toEqual(["apostar"]);
    estado = reducir(estado, { tipo: "pendiente", accion: "apostar", activo: false });
    expect(estado.pendientes).toEqual([]);
  });

  test("conserva como máximo 4 avisos, descartando los más viejos", () => {
    const eventos: EventoJuego[] = [1, 2, 3, 4, 5].map((id) => ({ tipo: "aviso", aviso: { id, nivel: "error", texto: `a${id}` } }));
    const estado = aplicar(...eventos);
    expect(estado.avisos.map((aviso) => aviso.id)).toEqual([2, 3, 4, 5]);
    expect(reducir(estado, { tipo: "quitarAviso", id: 3 }).avisos.map((aviso) => aviso.id)).toEqual([2, 4, 5]);
  });

  test("movimientos reemplaza la primera página y anexa las siguientes", () => {
    const fila = (id: string) => ({
      id,
      tipo: "apuesta" as const,
      deltaDinero: 0,
      deltaFichas: -10,
      dineroDespues: 0,
      fichasDespues: 0,
      referencia: null,
      creadoEn: "2026-10-05T10:00:00.000Z",
    });
    const estado = aplicar(
      { tipo: "movimientos", items: [fila("3"), fila("2")], hayMas: true, anexar: false },
      { tipo: "movimientos", items: [fila("1")], hayMas: false, anexar: true },
    );
    expect(estado.movimientos?.items.map((item) => item.id)).toEqual(["3", "2", "1"]);
    expect(estado.movimientos?.hayMas).toBe(false);
  });

  test("sesionTerminada borra los datos del usuario pero conserva conexión y lobby", () => {
    const estado = aplicar(
      { tipo: "conexion", estado: "conectado" },
      conSesion,
      { tipo: "servidor", mensaje: { type: "mesa.estado", ...mesa("APUESTAS") } },
      { tipo: "sesionTerminada" },
    );
    expect(estado.sesion).toBeNull();
    expect(estado.billetera).toBeNull();
    expect(estado.mesa).toBeNull();
    expect(estado.conexion).toBe("conectado");
  });

  test("espectador solo aplica si se está viendo una mesa", () => {
    expect(aplicar({ tipo: "espectador" }).espectador).toBe(false);
    const enMesa = aplicar({ tipo: "servidor", mensaje: { type: "mesa.estado", ...mesa("TURNOS") } }, { tipo: "espectador" });
    expect(enMesa.espectador).toBe(true);
    expect(reducir(enMesa, { tipo: "salioDeMesa" }).espectador).toBe(false);
  });
});
