/** T-19: plazos, cierre anticipado, callbacks obsoletos y cinco rondas automáticas. */
import { expect, test } from "bun:test";
import { EQUIPADO_INICIAL, TIEMPO_APUESTAS_MS, TIEMPO_TURNO_MS, TIEMPO_RESULTADOS_MS } from "../src/config";
import { Mesa } from "../src/game/Mesa";
import { crearZapatoFijo, TiempoManual } from "./soporteMesa";

function preparar() {
  const tiempo = new TiempoManual();
  const cartas = Array.from({ length: 5 }, () => ["10", "9", "10", "7", "8", "7"] as const).flat();
  const mesa = new Mesa("mesa-1", "Mesa 1", () => {}, crearZapatoFijo(cartas), tiempo.reloj);
  mesa.unirse({ id: 1, usuario: "uno" }, EQUIPADO_INICIAL);
  mesa.unirse({ id: 2, usuario: "dos" }, EQUIPADO_INICIAL);
  return { mesa, tiempo };
}

test("publica 15 s y vence con apuestas parciales; auto-planta tras 20 s", () => {
  const { mesa, tiempo } = preparar();
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_APUESTAS_MS);
  mesa.registrarApuestaConfirmada(1, 10);
  tiempo.avanzar(TIEMPO_APUESTAS_MS - 1);
  expect(mesa.fase).toBe("APUESTAS");
  tiempo.avanzar(1);
  expect(mesa.snapshot()).toMatchObject({ fase: "TURNOS", turnoDe: 1, finEn: tiempo.ahora() + TIEMPO_TURNO_MS });
  tiempo.avanzar(TIEMPO_TURNO_MS);
  expect(mesa.snapshot().asientos[0]?.estado).toBe("PLANTADO");
  expect(mesa.snapshot()).toMatchObject({ fase: "PAGOS", finEn: tiempo.ahora() + TIEMPO_RESULTADOS_MS });
  tiempo.avanzar(TIEMPO_RESULTADOS_MS);
  expect(mesa.fase).toBe("APUESTAS");
  expect(tiempo.maximo).toBe(1);
});

test("todos apostaron: cierra en el siguiente tick sin esperar 15 s", () => {
  const { mesa, tiempo } = preparar();
  mesa.registrarApuestaConfirmada(1, 10);
  mesa.registrarApuestaConfirmada(2, 10);
  tiempo.avanzar(0);
  expect(mesa.snapshot()).toMatchObject({ fase: "TURNOS", turnoDe: 1 });
  const plazo = mesa.snapshot().finEn;
  tiempo.avanzar(1000);
  mesa.avanzarTurno();
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_TURNO_MS);
  expect(mesa.snapshot().finEn).not.toBe(plazo);
  expect(tiempo.maximo).toBe(1);
});

test("descarta callbacks cancelados aunque ya estuvieran despachados", () => {
  const { mesa, tiempo } = preparar();
  const anterior = [...tiempo.pendientes.values()][0]!.accion;
  mesa.registrarApuestaConfirmada(1, 10);
  mesa.registrarApuestaConfirmada(2, 10);
  tiempo.avanzar(0);
  anterior();
  expect(mesa.snapshot().turnoDe).toBe(1);
  const turnoAnterior = [...tiempo.pendientes.values()][0]!.accion;
  mesa.avanzarTurno();
  turnoAnterior();
  expect(mesa.snapshot().turnoDe).toBe(2);
});

test("encadena cinco rondas sin acciones de turno ni avance manual de fases", () => {
  const { mesa, tiempo } = preparar();
  const rondas = new Set<string>();
  for (let ronda = 0; ronda < 5; ronda++) {
    rondas.add(mesa.rondaId!);
    mesa.registrarApuestaConfirmada(1, 10);
    mesa.registrarApuestaConfirmada(2, 10);
    tiempo.avanzar(0);
    tiempo.avanzar(TIEMPO_TURNO_MS);
    expect(mesa.snapshot().turnoDe).toBe(2);
    tiempo.avanzar(TIEMPO_TURNO_MS);
    expect(mesa.fase).toBe("PAGOS");
    tiempo.avanzar(TIEMPO_RESULTADOS_MS);
    expect(mesa.fase).toBe("APUESTAS");
  }
  expect(rondas.size).toBe(5);
  expect(tiempo.maximo).toBe(1);
});

test("sin apuestas renueva 15 s; sin asientos o al detener borra el timeout", () => {
  const { mesa, tiempo } = preparar();
  const ronda = mesa.rondaId;
  tiempo.avanzar(TIEMPO_APUESTAS_MS);
  expect(mesa.rondaId).not.toBe(ronda);
  expect(mesa.snapshot().finEn).toBe(tiempo.ahora() + TIEMPO_APUESTAS_MS);
  mesa.salir(1); mesa.salir(2);
  expect(mesa.snapshot()).toMatchObject({ fase: "ESPERANDO", finEn: null });
  expect(tiempo.pendientes.size).toBe(0);
  mesa.unirse({ id: 1, usuario: "uno" }, EQUIPADO_INICIAL);
  mesa.detener();
  expect(tiempo.pendientes.size).toBe(0);
});

test("salir sin apostar cierra en el siguiente tick si todos los restantes apostaron", () => {
  const { mesa, tiempo } = preparar();
  mesa.registrarApuestaConfirmada(1, 10);
  mesa.salir(2);
  tiempo.avanzar(0);
  expect(mesa.fase).toBe("TURNOS");
  expect(mesa.snapshot().turnoDe).toBe(1);
  expect(tiempo.maximo).toBe(1);
});

test("cerrar al jugador de turno después de detener no vuelve a programar relojes", () => {
  const { mesa, tiempo } = preparar();
  mesa.registrarApuestaConfirmada(1, 10);
  mesa.registrarApuestaConfirmada(2, 10);
  tiempo.avanzar(0);
  mesa.detener();
  mesa.salir(1);
  expect(tiempo.pendientes.size).toBe(0);
  expect(mesa.snapshot().finEn).toBeNull();
});
