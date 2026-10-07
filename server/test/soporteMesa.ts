/** Reloj y zapato deterministas; permiten ensayar rondas y carreras sin demoras reales. */
import { ErrorJuego, type BilleteraEstado, type CartaVisible } from "@blackjack/shared";
import type { Billetera } from "../src/game/Billetera";
import { Carta } from "../src/game/Carta";
import type { ZapatoMesa } from "../src/game/Mesa";
import { RelojMesa, type TemporizadorMesa } from "../src/game/RelojMesa";

/** Temporizador manual que detecta más de un timeout activo por mesa. */
export class TiempoManual implements TemporizadorMesa {
  private instante = 1_800_000_000_000;
  private secuencia = 0;
  readonly pendientes = new Map<number, { fin: number; accion: () => void }>();
  maximo = 0;
  readonly reloj = new RelojMesa(this);

  /** @returns Epoch ms simulado. */
  ahora(): number { return this.instante; }
  /** @param accion - Callback. @param demora - Plazo en ms. @returns Id único. */
  programar(accion: () => void, demora: number): number {
    const id = ++this.secuencia;
    this.pendientes.set(id, { fin: this.instante + demora, accion });
    this.maximo = Math.max(this.maximo, this.pendientes.size);
    return id;
  }
  /** @param id - Timeout a retirar. @returns Retira únicamente ese callback. */
  cancelar(id: unknown): void { this.pendientes.delete(id as number); }
  /** @param ms - Intervalo a recorrer. @returns Ejecuta todos los vencimientos en orden. */
  avanzar(ms: number): void {
    const hasta = this.instante + ms;
    for (;;) {
      const primero = [...this.pendientes].sort((a, b) => a[1].fin - b[1].fin)[0];
      if (!primero || primero[1].fin > hasta) break;
      this.instante = primero[1].fin;
      this.pendientes.delete(primero[0]);
      primero[1].accion();
    }
    this.instante = hasta;
  }
}

/**
 * @param rangos - Orden de extracción, independiente del azar criptográfico.
 * @returns Zapato que falla si el ensayo intenta consumir cartas no previstas.
 * @throws ErrorJuego ERROR_INTERNO al agotarse.
 */
export function crearZapatoFijo(rangos: readonly CartaVisible["rango"][]): ZapatoMesa {
  const cartas = rangos.map((rango) => new Carta("♠", rango));
  return {
    sacar: () => { const carta = cartas.shift(); if (!carta) throw new ErrorJuego("ERROR_INTERNO"); return carta; },
    barajar: () => {}, necesitaRebarajar: () => false,
  };
}

/** Billetera inyectable para probar el motor sin importar store/ ni SQL. */
export class BilleteraMemoria implements Billetera {
  readonly fichas = new Map<number, number>();
  readonly debitos: number[] = [];
  readonly pagos: number[] = [];
  private readonly pagosPorRonda = new Map<string, number>();
  /** @param usuarioId - Usuario del ensayo. @returns Snapshot del saldo en memoria. */
  async consultar(usuarioId: number): Promise<BilleteraEstado> {
    return { dinero: 10000, fichas: this.fichas.get(usuarioId) ?? 500, compradoHoy: 0,
      disponibleHoy: 5000, limiteDiario: 5000, reinicioEn: "2026-10-06T06:00:00.000Z" };
  }
  /** @param usuarioId - Jugador. @param cantidad - Débito. @param rondaId - Referencia. @returns Saldo. @throws ErrorJuego FICHAS_INSUFICIENTES. */
  async debitarApuesta(usuarioId: number, cantidad: number, _rondaId: string): Promise<BilleteraEstado> {
    const estado = await this.consultar(usuarioId);
    if (estado.fichas < cantidad) throw new ErrorJuego("FICHAS_INSUFICIENTES");
    this.fichas.set(usuarioId, estado.fichas - cantidad);
    this.debitos.push(usuarioId);
    return this.consultar(usuarioId);
  }
  /** @param usuarioId - Jugador. @param cantidad - Pago. @param rondaId - Referencia. @returns Saldo. */
  async acreditarPago(usuarioId: number, cantidad: number, rondaId: string): Promise<BilleteraEstado> {
    const estado = await this.consultar(usuarioId);
    const clave = `${usuarioId}:${rondaId}`;
    const previo = this.pagosPorRonda.get(clave);
    if (previo !== undefined) {
      if (previo !== cantidad) throw new ErrorJuego("ERROR_INTERNO");
      return estado;
    }
    this.fichas.set(usuarioId, estado.fichas + cantidad);
    this.pagosPorRonda.set(clave, cantidad);
    this.pagos.push(usuarioId);
    return this.consultar(usuarioId);
  }
  /** @param usuarioId - Usuario. @param cantidad - Compra. @param clave - Intención. @returns Saldo. */
  async comprarFichas(usuarioId: number, cantidad: number, _clave: string): Promise<BilleteraEstado> {
    const estado = await this.consultar(usuarioId);
    this.fichas.set(usuarioId, estado.fichas + cantidad);
    return this.consultar(usuarioId);
  }
}
