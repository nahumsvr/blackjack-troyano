/** Multiplexa fase y reservas en un solo timeout, conservando el plazo público de la fase. */

/** Fuentes de tiempo inyectables para probar minutos de juego sin esperar tiempo real. */
export interface TemporizadorMesa {
  ahora(): number;
  programar(accion: () => void, demora: number): unknown;
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

  /** @param temporizador - Reloj del servidor o implementación manual de pruebas. */
  constructor(private readonly temporizador: TemporizadorMesa = temporizadorReal) {}

  /** @returns Epoch ms del vencimiento vigente, o null si no hay reloj. */
  get finEn(): number | null { return this.vencimiento; }

  /** @returns Epoch ms del servidor, también usado para fechar las rondas. */
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

  /** @returns Cancela la fase y borra finEn; las reservas siguen hasta reconexión o vencimiento. */
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

  /** @param usuarioId - Asiento recuperado o liberado. @returns Cancela solo su reserva. */
  cancelarReserva(usuarioId: number): void { this.reservas.delete(usuarioId); this.reprogramar(); }

  /** @returns Cancela fase, reservas y callbacks obsoletos al detener la mesa. */
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
