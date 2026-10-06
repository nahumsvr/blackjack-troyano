/** Reloj reemplazable de la mesa: un solo timeout y descarte de callbacks cancelados. */

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
   * @returns Vencimiento absoluto para todos los clientes.
   */
  programar(demora: number, accion: () => void): number {
    this.cancelar();
    const version = this.version;
    this.vencimiento = this.ahora() + demora;
    this.id = this.temporizador.programar(() => {
      if (version !== this.version) return;
      this.id = null;
      this.vencimiento = null;
      accion();
    }, demora);
    return this.vencimiento;
  }

  /** @returns Cancela el timeout y borra finEn; también invalida callbacks en vuelo. */
  cancelar(): void {
    this.version++;
    if (this.id !== null) this.temporizador.cancelar(this.id);
    this.id = null;
    this.vencimiento = null;
  }
}
