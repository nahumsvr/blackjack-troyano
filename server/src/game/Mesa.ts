/** Máquina de estados y relojes autoritativos; el transporte inyecta dinero y persistencia. */
import { CantidadApuestaSchema, ErrorJuego, type Asiento, type BilleteraEstado, type Equipado, type FaseMesa, type MesaEstado, type MensajeServidor, type UsuarioVista } from "@blackjack/shared";
import { CAPACIDAD_MESA, TIEMPO_APUESTAS_MS, TIEMPO_TURNO_MS, TIEMPO_RESULTADOS_MS, REINTENTO_PAGOS_MS } from "../config";
import { Baraja } from "./Baraja";
import { Dealer } from "./Dealer";
import { Jugador } from "./Jugador";
import { Mano } from "./Mano";
import { RelojMesa } from "./RelojMesa";
import type { Billetera } from "./Billetera";
import type { ResultadoMesa, RondaTerminada } from "./RondaTerminada";
import { resolver } from "./reglas";

/** Superficie mínima del zapato, inyectable sin añadir controles al protocolo del cliente. */
export type ZapatoMesa = Pick<Baraja, "sacar" | "barajar" | "necesitaRebarajar">;

/** Dependencias del motor; ninguna implementación SQL ni transporte vive en game/. */
export interface ServiciosMesa {
  billetera?: Billetera;
  publicarBilletera?: (usuarioId: number, estado: BilleteraEstado) => void;
  guardarRonda?: (ronda: RondaTerminada) => Promise<void>;
  publicarResultado?: (mensaje: ResultadoMesa) => void;
  registrarError?: (error: unknown) => void;
}

/** Mesa en memoria; sus pasos internos solo los invoca el servidor, nunca el cliente. */
export class Mesa {
  private readonly asientos: (Jugador | null)[] = Array<Jugador | null>(CAPACIDAD_MESA).fill(null);
  private dealer = new Dealer();
  private faseActual: FaseMesa = "ESPERANDO";
  private turno: number | null = null;
  private rondaActual: string | null = null;
  private pendientes: Promise<void> = Promise.resolve();
  private readonly apuestasPendientes = new Set<number>();
  private detenida = false;
  private iniciadaEn: string | null = null;
  private liquidacion: RondaTerminada | null = null;
  private liquidacionConfirmada = false;
  private readonly pagados = new Set<number>();

  /**
   * Crea una mesa con reloj, billetera y persistencia inyectados.
   * @param id - Identificador configurado de mesa.
   * @param nombre - Nombre público.
   * @param publicar - Recibe snapshots independientes tras cada cambio.
   * @param baraja - Zapato real por defecto; se inyecta uno fijo para pruebas.
   * @param reloj - Único temporizador de la mesa; sustituible en pruebas.
   * @param servicios - Billetera y publicaciones privadas confirmadas.
   * @returns Mesa vacía; al sentarse el primer jugador abre el reloj de apuestas.
   */
  constructor(
    readonly id: string, readonly nombre: string,
    private readonly publicar: (mensaje: Extract<MensajeServidor, { type: "mesa.estado" }>) => void,
    private readonly baraja: ZapatoMesa = new Baraja(),
    private readonly reloj = new RelojMesa(),
    private readonly servicios: ServiciosMesa = {},
  ) {}

  /** @returns Fase autoritativa para validar acciones y equipamiento. */
  get fase(): FaseMesa { return this.faseActual; }

  /** @returns UUID de ronda generado al abrir apuestas, o null antes de la primera ronda. */
  get rondaId(): string | null { return this.rondaActual; }

  /** @param usuarioId - Identidad autenticada. @returns true si todavía ocupa un asiento. */
  contiene(usuarioId: number): boolean { return this.asientos.some((jugador) => jugador?.usuarioId === usuarioId); }

  /**
   * Sienta al usuario o refresca su asiento con datos confirmados por el servidor.
   * @param usuario - Identidad validada por auth.
   * @param equipado - Cosméticos del servidor.
   * @returns Snapshot tras sentarse; en una mano activa espera a la siguiente ronda.
   * @throws ErrorJuego MESA_LLENA si no hay un asiento libre.
   */
  unirse(usuario: UsuarioVista, equipado: Equipado): MesaEstado {
    const existente = this.asientos.find((jugador) => jugador?.usuarioId === usuario.id);
    if (existente) {
      const cosmeticosCambiaron = existente.actualizarEquipado(equipado);
      if (existente.conectado && !existente.salidaPendiente && !cosmeticosCambiaron) return this.snapshot();
      existente.conectado = true;
      existente.salidaPendiente = false;
    } else {
      const indice = this.asientos.findIndex((jugador) => jugador === null);
      if (indice < 0) throw new ErrorJuego("MESA_LLENA");
      const jugador = new Jugador(indice as Asiento["indice"], usuario, equipado);
      if (this.fase === "APUESTAS") jugador.reiniciarRonda();
      this.asientos[indice] = jugador;
    }
    if (this.fase === "ESPERANDO") this.abrirApuestas();
    else this.publicarEstado();
    return this.snapshot();
  }

  /**
   * Conserva una apuesta activa hasta finalizar pagos, para no perderla al liberar el asiento.
   * @param usuarioId - Usuario que sale; la propiedad del socket la valida GestorMesas.
   * @returns Libera ahora si no apostó; de lo contrario marca salida al final de la ronda.
   * @throws ErrorJuego NO_ESTAS_EN_MESA.
   */
  salir(usuarioId: number): void {
    const jugador = this.obtenerJugador(usuarioId);
    if (jugador.apuesta === 0 && !this.apuestasPendientes.has(usuarioId)) {
      this.asientos[jugador.indice] = null;
      if (this.asientos.every((asiento) => asiento === null)) {
        this.faseActual = "ESPERANDO";
        this.rondaActual = null;
        this.reloj.cancelar();
      }
    } else {
      jugador.conectado = false;
      jugador.salidaPendiente = true;
      if (jugador.indice === this.turno) { this.avanzarTurno(); return; }
    }
    if (this.fase === "APUESTAS") this.cerrarSiTodosApostaron();
    this.publicarEstado();
  }

  /**
   * Serializa el débito y el reloj para conservar una apuesta aceptada antes del vencimiento.
   * @param usuarioId - Jugador autenticado y dueño del asiento.
   * @param cantidad - Entero de 10 a 500, múltiplo de 10.
   * @param autorizar - Revalida el dueño al ejecutar la acción, después de esperar la cola.
   * @returns Apuesta registrada solo después de confirmar el débito SQL.
   * @throws ErrorJuego FASE_INCORRECTA | NO_ESTAS_EN_MESA | YA_APOSTASTE | CANTIDAD_INVALIDA | FICHAS_INSUFICIENTES | ERROR_INTERNO.
   */
  apostar(usuarioId: number, cantidad: number, autorizar: () => void = () => {}): Promise<void> {
    return this.encolar(async () => {
      autorizar();
      this.exigirPlazo("APUESTAS");
      const jugador = this.obtenerJugador(usuarioId);
      if (jugador.apuesta !== 0) throw new ErrorJuego("YA_APOSTASTE");
      if (!CantidadApuestaSchema.safeParse(cantidad).success) throw new ErrorJuego("CANTIDAD_INVALIDA");
      if (!jugador.conectado || jugador.salidaPendiente) throw new ErrorJuego("NO_ESTAS_EN_MESA");
      if (!this.servicios.billetera || !this.rondaActual) throw new ErrorJuego("ERROR_INTERNO");
      this.apuestasPendientes.add(usuarioId);
      try {
        const saldo = await this.servicios.billetera.debitarApuesta(usuarioId, cantidad, this.rondaActual);
        // Una salida durante SQL conserva este asiento: el débito aceptado tiene que jugarse/pagarse.
        jugador.apuesta = cantidad;
        jugador.estado = "APOSTADO";
        this.servicios.publicarBilletera?.(usuarioId, saldo);
        this.cerrarSiTodosApostaron();
        this.publicarEstado();
      } finally {
        this.apuestasPendientes.delete(usuarioId);
        if (jugador.salidaPendiente && jugador.apuesta === 0) this.salir(usuarioId);
      }
    });
  }

  /**
   * @param usuarioId - Dueño del turno vigente.
   * @param autorizar - Revalidación del socket propietario al ejecutar.
   * @returns Añade una carta; con 21 se planta y al superar 21 queda PASADO.
   * @throws ErrorJuego FASE_INCORRECTA | NO_ESTAS_EN_MESA | NO_ES_TU_TURNO | ERROR_INTERNO.
   */
  pedir(usuarioId: number, autorizar: () => void = () => {}): Promise<void> {
    return this.encolar(() => {
      autorizar();
      const jugador = this.exigirTurno(usuarioId);
      jugador.mano.agregar(this.baraja.sacar());
      if (jugador.mano.estaPasada()) jugador.estado = "PASADO";
      if (jugador.mano.total() >= 21) this.avanzarTurno();
      else this.publicarEstado();
    });
  }

  /**
   * @param usuarioId - Dueño del turno vigente.
   * @param autorizar - Revalidación del socket propietario al ejecutar.
   * @returns Planta al jugador y selecciona el siguiente turno elegible.
   * @throws ErrorJuego FASE_INCORRECTA | NO_ESTAS_EN_MESA | NO_ES_TU_TURNO.
   */
  plantarse(usuarioId: number, autorizar: () => void = () => {}): Promise<void> {
    return this.encolar(() => { autorizar(); this.exigirTurno(usuarioId); this.avanzarTurno(); });
  }

  /** @returns Espera las acciones en vuelo; útil para cierre y ensayos con reloj manual. */
  async esperarOperaciones(): Promise<void> {
    for (;;) {
      const pendientes = this.pendientes;
      await pendientes;
      if (pendientes === this.pendientes) return;
    }
  }

  /**
   * Paso interno posterior al débito confirmado; no implementa la intención WS apostar.
   * @param usuarioId - Usuario elegible para esta ronda.
   * @param cantidad - Apuesta ya confirmada por el servicio inyectado; paso de bancos internos.
   * @returns Registra y publica; programa cierre anticipado si todos apostaron.
   * @throws ErrorJuego FASE_INCORRECTA | NO_ESTAS_EN_MESA | YA_APOSTASTE | CANTIDAD_INVALIDA.
   */
  registrarApuestaConfirmada(usuarioId: number, cantidad: number): void {
    this.exigirFase("APUESTAS");
    const jugador = this.obtenerJugador(usuarioId);
    if (jugador.apuesta !== 0) throw new ErrorJuego("YA_APOSTASTE");
    if (!CantidadApuestaSchema.safeParse(cantidad).success) throw new ErrorJuego("CANTIDAD_INVALIDA");
    if (!jugador.conectado || jugador.salidaPendiente) throw new ErrorJuego("NO_ESTAS_EN_MESA");
    jugador.apuesta = cantidad;
    jugador.estado = "APOSTADO";
    this.cerrarSiTodosApostaron();
    this.publicarEstado();
  }

  /**
   * Reparte por vueltas, publica REPARTO y selecciona el primer turno elegible.
   * @returns Sin apuestas reinicia la ronda; con apuestas reparte sin filtrar la carta oculta.
   * @throws ErrorJuego FASE_INCORRECTA | ERROR_INTERNO si falla el suministro de cartas.
   */
  cerrarApuestas(): void {
    this.exigirFase("APUESTAS");
    const jugadores = this.participantes();
    if (jugadores.length === 0) { this.abrirApuestas(); return; }
    if (this.baraja.necesitaRebarajar()) this.baraja.barajar();
    const manos = jugadores.map(() => new Mano());
    const dealer = new Dealer();
    // Solo sustituir las manos después del reparto completo: un fallo de suministro
    // no deja cartas parciales en APUESTAS ni publica un estado imposible.
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (const mano of manos) mano.agregar(this.baraja.sacar());
      dealer.mano.agregar(this.baraja.sacar());
    }
    for (const [indice, jugador] of jugadores.entries()) jugador.mano = manos[indice]!;
    this.reloj.cancelar();
    this.dealer = dealer;
    for (const jugador of jugadores) if (jugador.mano.esBlackjack()) jugador.estado = "BLACKJACK";
    this.faseActual = "REPARTO";
    this.publicarEstado();
    if (this.dealer.mano.esBlackjack()) this.jugarDealer();
    else this.seleccionarTurno(0);
  }

  /**
   * Paso interno disparado por una acción validada, salida o vencimiento del servidor.
   * @returns Planta el turno vigente y pasa al siguiente, o a DEALER/PAGOS.
   * @throws ErrorJuego FASE_INCORRECTA si no hay un turno de jugador activo.
   */
  avanzarTurno(): void {
    this.exigirFase("TURNOS");
    if (this.turno === null) throw new ErrorJuego("FASE_INCORRECTA");
    const actual = this.asientos[this.turno]!;
    if (actual.estado === "JUGANDO") actual.estado = "PLANTADO";
    this.seleccionarTurno(this.turno + 1);
  }

  /**
   * Paso interno que el reloj invoca después de confirmar pagos e historial.
   * @returns Limpia manos, libera salidas pendientes y abre APUESTAS o ESPERANDO.
   * @throws ErrorJuego FASE_INCORRECTA fuera de PAGOS | ERROR_INTERNO si la liquidación sigue pendiente.
   */
  finalizarPagos(): void {
    this.exigirFase("PAGOS");
    if (this.liquidacion && !this.liquidacionConfirmada) throw new ErrorJuego("ERROR_INTERNO");
    for (const [indice, jugador] of this.asientos.entries()) {
      if (jugador?.salidaPendiente) this.asientos[indice] = null;
    }
    this.abrirApuestas();
  }

  /** @returns Copia pública; fuera de DEALER/PAGOS oculta todas las cartas tras la primera. */
  snapshot(): MesaEstado {
    const revelar = this.fase === "DEALER" || this.fase === "PAGOS";
    return {
      id: this.id, nombre: this.nombre, fase: this.fase, finEn: this.reloj.finEn,
      turnoDe: this.turno === null ? null : this.asientos[this.turno]!.usuarioId,
      dealer: {
        cartas: this.dealer.mano.cartas.map((carta, indice) => revelar || indice === 0 ? carta.aVista() : { oculta: true }),
        total: revelar ? this.dealer.mano.total() : null,
      },
      asientos: this.asientos.map((jugador) => jugador?.snapshot() ?? null),
    };
  }

  /** @returns Cancela el reloj al detener el servidor o el banco de pruebas. */
  detener(): void { this.detenida = true; this.reloj.cancelar(); }

  /**
   * Drena las acciones y completa una liquidación pendiente antes de cerrar SQL.
   * @returns Confirmación de pagos e historial pendientes, sin nuevos relojes ni resultados públicos.
   * @throws Error Propaga un fallo persistente de billetera/historial en el último intento.
   */
  async cerrar(): Promise<void> {
    this.detener();
    await this.esperarOperaciones();
    // Cancelar el reloj no descarta pagos iniciados: conservar UUID y créditos confirmados.
    if (this.liquidacion && !this.liquidacionConfirmada) await this.encolar(() => this.liquidar(true));
  }

  private abrirApuestas(): void {
    this.dealer = new Dealer();
    this.turno = null;
    for (const jugador of this.asientos) jugador?.reiniciarRonda();
    this.faseActual = this.asientos.some((jugador) => jugador !== null) ? "APUESTAS" : "ESPERANDO";
    this.rondaActual = this.fase === "APUESTAS" ? crypto.randomUUID() : null;
    this.iniciadaEn = this.rondaActual ? new Date(this.reloj.ahora()).toISOString() : null;
    this.liquidacion = null;
    this.liquidacionConfirmada = false;
    this.pagados.clear();
    this.reloj.cancelar();
    if (this.fase === "APUESTAS") this.programar(TIEMPO_APUESTAS_MS, () => this.cerrarApuestas());
    this.publicarEstado();
  }

  private seleccionarTurno(desde: number): void {
    for (let indice = desde; indice < this.asientos.length; indice++) {
      const jugador = this.asientos[indice];
      if (!jugador || jugador.apuesta === 0 || jugador.estado !== "APOSTADO") continue;
      if (!jugador.conectado) { jugador.estado = "PLANTADO"; continue; }
      jugador.estado = "JUGANDO";
      this.turno = indice;
      this.faseActual = "TURNOS";
      this.programar(TIEMPO_TURNO_MS, () => this.avanzarTurno());
      this.publicarEstado();
      return;
    }
    this.jugarDealer();
  }

  private jugarDealer(): void {
    this.turno = null;
    this.faseActual = "DEALER";
    this.reloj.cancelar();
    this.publicarEstado();
    // Un natural ya tiene su resultado frente a cualquier dealer sin natural.
    if (this.participantes().some((jugador) => !jugador.mano.estaPasada() && !jugador.mano.esBlackjack())) {
      while (this.dealer.debePedir()) {
        this.dealer.mano.agregar(this.baraja.sacar());
        this.publicarEstado();
      }
    }
    this.faseActual = "PAGOS";
    this.reloj.cancelar();
    if (this.servicios.billetera && this.servicios.guardarRonda && this.servicios.publicarResultado) {
      this.liquidacion = {
        id: this.rondaActual!, mesaId: this.id, iniciadaEn: this.iniciadaEn!,
        terminadaEn: new Date(this.reloj.ahora()).toISOString(),
        dealer: { cartas: this.dealer.mano.cartas.map((carta) => carta.aVista()), total: this.dealer.mano.total() },
        jugadores: this.participantes().map((jugador) => ({
          usuarioId: jugador.usuarioId, asiento: jugador.indice, apuesta: jugador.apuesta,
          cartas: jugador.mano.cartas.map((carta) => carta.aVista()), total: jugador.mano.total(),
          ...resolver(jugador.mano, this.dealer.mano, jugador.apuesta),
        })),
      };
      this.iniciarLiquidacion();
    } else this.programar(TIEMPO_RESULTADOS_MS, () => this.finalizarPagos());
    this.publicarEstado();
  }

  private participantes(): Jugador[] {
    return this.asientos.filter((jugador): jugador is Jugador => jugador !== null && jugador.apuesta > 0);
  }

  private obtenerJugador(usuarioId: number): Jugador {
    const jugador = this.asientos.find((asiento) => asiento?.usuarioId === usuarioId);
    if (!jugador) throw new ErrorJuego("NO_ESTAS_EN_MESA");
    return jugador;
  }

  private exigirFase(fase: FaseMesa): void { if (this.fase !== fase) throw new ErrorJuego("FASE_INCORRECTA"); }
  private publicarEstado(): void { this.publicar({ type: "mesa.estado", ...this.snapshot() }); }

  private cerrarSiTodosApostaron(): void {
    const elegibles = this.asientos.filter((jugador) => jugador?.conectado && !jugador.salidaPendiente);
    // Cerrar en el próximo tick conserva la respuesta a la última apuesta antes del reparto.
    if (this.participantes().length > 0 && elegibles.every((jugador) => jugador!.apuesta > 0)) {
      this.programar(0, () => this.cerrarApuestas());
    }
  }

  private programar(demora: number, accion: () => void, mostrarVencimiento = true): void {
    if (this.detenida) return;
    const fase = this.fase, ronda = this.rondaActual, turno = this.turno;
    this.reloj.programar(demora, () => {
      const paso = () => {
        if (!this.detenida && this.fase === fase && this.rondaActual === ronda && this.turno === turno) accion();
      };
      if (this.servicios.billetera) {
        void this.encolar(paso).catch((error: unknown) => console.error(`Error en reloj de ${this.id}`, error));
      } else {
        try { paso(); } catch (error) { console.error(`Error en reloj de ${this.id}`, error); }
      }
    }, mostrarVencimiento);
  }

  private iniciarLiquidacion(): void {
    void this.encolar(() => this.liquidar()).catch((error: unknown) => {
      if (this.servicios.registrarError) this.servicios.registrarError(error);
      else console.error(`Error al liquidar ${this.id}`, error);
      // Retener cartas y resultados: nunca empezar otra ronda con pagos/historial incompletos.
      if (!this.detenida && this.fase === "PAGOS") {
        this.programar(REINTENTO_PAGOS_MS, () => this.iniciarLiquidacion(), false);
        this.publicarEstado();
      }
    });
  }

  private async liquidar(alCerrar = false): Promise<void> {
    const ronda = this.liquidacion;
    if (!ronda || (this.detenida && !alCerrar)) return;
    if (!this.liquidacionConfirmada) {
      for (const jugador of ronda.jugadores) {
        if (this.pagados.has(jugador.usuarioId)) continue;
        const estado = await this.servicios.billetera!.acreditarPago(jugador.usuarioId, jugador.pago, ronda.id);
        this.pagados.add(jugador.usuarioId);
        if (!this.detenida) this.servicios.publicarBilletera?.(jugador.usuarioId, estado);
      }
      await this.servicios.guardarRonda!(ronda);
      this.liquidacionConfirmada = true;
    }
    if (this.detenida) return;
    this.servicios.publicarResultado!({
      type: "ronda.resultado", rondaId: ronda.id,
      dealer: { cartas: [...ronda.dealer.cartas], total: ronda.dealer.total },
      resultados: ronda.jugadores.map(({ usuarioId, resultado, apuesta, pago }) => ({ usuarioId, resultado, apuesta, pago })),
    });
    this.programar(TIEMPO_RESULTADOS_MS, () => this.finalizarPagos());
    this.publicarEstado();
  }

  private encolar<T>(accion: () => T | Promise<T>): Promise<T> {
    const actual = this.pendientes.then(accion);
    this.pendientes = actual.then(() => {}, () => {});
    return actual;
  }

  private exigirPlazo(fase: FaseMesa): void {
    this.exigirFase(fase);
    if (this.detenida || (this.reloj.finEn !== null && this.reloj.ahora() >= this.reloj.finEn)) {
      throw new ErrorJuego("FASE_INCORRECTA");
    }
  }

  private exigirTurno(usuarioId: number): Jugador {
    this.exigirPlazo("TURNOS");
    const jugador = this.obtenerJugador(usuarioId);
    if (this.turno !== jugador.indice || jugador.estado !== "JUGANDO") throw new ErrorJuego("NO_ES_TU_TURNO");
    return jugador;
  }
}
