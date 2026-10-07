/** Multiplexa fase y reservas en un solo timeout, conservando el plazo público de la fase. */

/** Fuentes de tiempo inyectables para probar minutos de juego sin esperar tiempo real. */
export interface TemporizadorMesa {
  /**
   * Consulta el reloj autoritativo.
   * @returns Tiempo actual en epoch ms.
   */
  ahora(): number;
  /**
   * Programa una acción del servidor.
   * @param accion - Callback a ejecutar cuando venza el plazo.
   * @param demora - Milisegundos de espera.
   * @returns Identificador opaco para cancelar el timeout.
   */
  programar(accion: () => void, demora: number): unknown;
  /**
   * Cancela un timeout previamente programado.
   * @param id - Identificador entregado por programar.
   * @returns Sin valor.
   */
  cancelar(id: unknown): void;
}

const temporizadorReal: TemporizadorMesa = {
  ahora: Date.now,
  programar: (accion, demora) => setTimeout(accion, demora).unref(),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Publica el vencimiento absoluto y conserva como máximo un timeout activo. */
export class RelojMesa {
  private id: unknown = null;
  private version = 0;
  private vencimiento: number | null = null;
  private paso: { fin: number; accion: () => void } | null = null;
  private readonly reservas = new Map<number, { fin: number; accion: () => void }>();

  /**
   * Crea el reloj que comparte un único timeout entre fase y reservas.
   * @param temporizador - Reloj del servidor o implementación manual de pruebas.
   * @returns Reloj sin fase ni reservas programadas.
   */
  constructor(private readonly temporizador: TemporizadorMesa = temporizadorReal) {}

  /**
   * Consulta el plazo público de fase; las reservas no cambian este valor.
   * @returns Epoch ms del plazo de fase, o null sin fase pública aunque existan reservas o reintentos.
   */
  get finEn(): number | null { return this.vencimiento; }

  /**
   * Consulta el tiempo de la fuente autoritativa inyectada.
   * @returns Epoch ms del servidor, también usado para fechar las rondas.
   */
  ahora(): number { return this.temporizador.ahora(); }

  /**
   * Sustituye el timeout; la versión impide ejecutar callbacks ya despachados al cancelar.
   * @param demora - Milisegundos desde ahora.
   * @param accion - Paso interno de la mesa, que debe contener sus propios errores.
   * @param mostrarVencimiento - false para reintentos internos que no son una cuenta regresiva pública.
   * @returns Vencimiento absoluto para todos los clientes.
   */
  programar(demora: number, accion: () => void, mostrarVencimiento = true): number {
    const finEn = this.ahora() + demora;
    this.vencimiento = mostrarVencimiento ? finEn : null;
    this.paso = { fin: finEn, accion };
    this.reprogramar();
    return finEn;
  }

  /**
   * Retira el paso de fase y conserva los vencimientos de reserva.
   * @returns Sin valor; finEn queda en null y las reservas conservan sus plazos.
   */
  cancelar(): void {
    this.paso = null;
    this.vencimiento = null;
    this.reprogramar();
  }

  /**
   * Comparte el timer de fase con el vencimiento de un asiento.
   * @param usuarioId - Identidad del asiento reservado.
   * @param demora - Milisegundos hasta vencer la reserva.
   * @param accion - Limpieza autoritativa; no libera apuestas pendientes de pago.
   * @returns Sin valor; finEn sigue describiendo la fase, no la reserva.
   */
  reservar(usuarioId: number, demora: number, accion: () => void): void {
    this.reservas.set(usuarioId, { fin: this.ahora() + demora, accion });
    this.reprogramar();
  }

  /**
   * Retira la reserva del asiento recuperado o liberado.
   * @param usuarioId - Asiento recuperado o liberado.
   * @returns Sin valor; no altera el paso de fase.
   */
  cancelarReserva(usuarioId: number): void { this.reservas.delete(usuarioId); this.reprogramar(); }

  /**
   * Retira todos los pasos pendientes e invalida callbacks obsoletos.
   * @returns Sin valor.
   */
  detener(): void { this.reservas.clear(); this.cancelar(); }

  private reprogramar(): void {
    this.version++;
    if (this.id !== null) this.temporizador.cancelar(this.id);
    this.id = null;
    const fin = Math.min(this.paso?.fin ?? Infinity, ...[...this.reservas.values()].map((reserva) => reserva.fin));
    if (fin === Infinity) return;
    const version = this.version;
    this.id = this.temporizador.programar(() => {
      if (version !== this.version) return;
      this.id = null;
      const paso = this.paso;
      try {
        for (const [usuarioId, reserva] of [...this.reservas]) {
          if (reserva.fin > this.ahora() || this.reservas.get(usuarioId) !== reserva) continue;
          this.reservas.delete(usuarioId);
          reserva.accion();
        }
        if (paso && this.paso === paso && paso.fin <= this.ahora()) {
          this.paso = null;
          // Conservar el plazo vencido mientras el paso espera un commit SQL en la cola.
          paso.accion();
        }
      } finally { this.reprogramar(); }
    }, Math.max(0, fin - this.ahora()));
  }
}
