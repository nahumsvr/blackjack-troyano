/** Máquina de estados y relojes autoritativos; el transporte inyecta dinero y persistencia. */
import { CantidadApuestaSchema, ErrorJuego, type Asiento, type Equipado, type FaseMesa, type MesaEstado, type MensajeServidor, type UsuarioVista } from "@blackjack/shared";
import { CAPACIDAD_MESA, TIEMPO_APUESTAS_MS, TIEMPO_TURNO_MS, TIEMPO_RESULTADOS_MS, TIEMPO_REINTENTO_MS, MAX_REINTENTOS_RELOJ } from "../config";
import { Baraja } from "./Baraja";
import { Dealer } from "./Dealer";
import { Jugador } from "./Jugador";
import { Mano } from "./Mano";
import { RelojMesa } from "./RelojMesa";

/** Superficie mínima del zapato, inyectable sin añadir controles al protocolo del cliente. */
export type ZapatoMesa = Pick<Baraja, "sacar" | "barajar" | "necesitaRebarajar">;

/** Mesa en memoria; sus pasos internos solo los invoca el servidor, nunca el cliente. */
export class Mesa {
  private readonly asientos: (Jugador | null)[] = Array<Jugador | null>(CAPACIDAD_MESA).fill(null);
  private dealer = new Dealer();
  private faseActual: FaseMesa = "ESPERANDO";
  private turno: number | null = null;
  private rondaActual: string | null = null;
  private detenida = false;
  /** Vencimiento original de APUESTAS; sobrevive a un cierre anticipado que luego se cancela. */
  private finApuestas = 0;
  private cierreAnticipado = false;
  private reintentos = 0;

  /**
   * Crea una mesa vacía con publicaciones independientes de su estado interno.
   * @param id - Identificador configurado de mesa.
   * @param nombre - Nombre público.
   * @param publicar - Recibe snapshots independientes tras cada cambio.
   * @param baraja - Zapato real por defecto; se inyecta uno fijo para pruebas.
   * @param reloj - Único temporizador de la mesa; sustituible en pruebas.
   * @param alLiquidar - Paga y registra la ronda; PAGOS no avanza hasta que se resuelve (T-20/T-21 lo inyectan).
   * @returns Mesa vacía; al sentarse el primer jugador abre el reloj de apuestas.
   */
  constructor(
    readonly id: string, readonly nombre: string,
    private readonly publicar: (mensaje: Extract<MensajeServidor, { type: "mesa.estado" }>) => void,
    private readonly baraja: ZapatoMesa = new Baraja(),
    private readonly reloj = new RelojMesa(),
    private readonly alLiquidar: () => Promise<void> | void = () => {},
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
    else {
      // Quien llega antes de que dispare un cierre anticipado devuelve el plazo a su vencimiento original.
      if (this.fase === "APUESTAS") this.cerrarSiTodosApostaron();
      this.publicarEstado();
    }
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
    if (jugador.apuesta === 0) {
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
   * Paso interno posterior al débito confirmado; no implementa la intención WS apostar.
   * @param usuarioId - Usuario elegible para esta ronda.
   * @param cantidad - Apuesta cuyo débito deberá confirmar T-20 antes de llamar aquí.
   * @returns Registra y publica la apuesta; si ya apostaron todos, programa el cierre anticipado.
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
   *   Llamado por el reloj, el fallo se reintenta (ver `programar`) y las apuestas quedan intactas.
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
   * Paso de máquina de estados; T-19/T-20 validarán quién o qué lo dispara.
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
   * Paso interno que T-21 invocará solo después de confirmar pagos e historial.
   * @returns Limpia manos, libera salidas pendientes y abre APUESTAS o ESPERANDO.
   * @throws ErrorJuego FASE_INCORRECTA fuera de PAGOS.
   */
  finalizarPagos(): void {
    this.exigirFase("PAGOS");
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

  /** Impide nuevos relojes durante el cierre del transporte. @returns Sin valor. */
  detener(): void { this.detenida = true; this.reloj.cancelar(); }

  private abrirApuestas(): void {
    this.dealer = new Dealer();
    this.turno = null;
    for (const jugador of this.asientos) jugador?.reiniciarRonda();
    this.faseActual = this.asientos.some((jugador) => jugador !== null) ? "APUESTAS" : "ESPERANDO";
    this.rondaActual = this.fase === "APUESTAS" ? crypto.randomUUID() : null;
    this.reloj.cancelar();
    this.cierreAnticipado = false;
    if (this.fase === "APUESTAS") {
      this.finApuestas = this.reloj.ahora() + TIEMPO_APUESTAS_MS;
      this.programar(TIEMPO_APUESTAS_MS, () => this.cerrarApuestas());
    }
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
    // El plazo de resultados no basta: se avanza solo tras liquidar, o se perdería el pago de la ronda.
    this.programar(TIEMPO_RESULTADOS_MS, async () => {
      // Sin await cuando es síncrono: así el avance sigue ocurriendo en el mismo tick.
      const pendiente = this.alLiquidar();
      if (pendiente) await pendiente;
      if (this.fase === "PAGOS") this.finalizarPagos();
    });
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
      this.cierreAnticipado = true;
      this.programar(0, () => this.cerrarApuestas());
    } else if (this.cierreAnticipado) {
      this.cierreAnticipado = false;
      this.programar(Math.max(0, this.finApuestas - this.reloj.ahora()), () => this.cerrarApuestas());
    }
  }

  /**
   * Único punto que arma el reloj. Un paso que falla no debe dejar la mesa sin timeout:
   * se reintenta un número acotado de veces y luego se deja el error registrado.
   */
  private programar(demora: number, accion: () => Promise<void> | void): void {
    if (this.detenida) return;
    this.reloj.programar(demora, async () => {
      if (this.detenida) return;
      try {
        await accion();
        this.reintentos = 0;
      } catch (error) {
        console.error(`Error en reloj de ${this.id}`, error);
        // Si el paso ya armó otro reloj (p. ej. cambió de fase) no se pisa.
        if (this.reloj.finEn === null && this.reintentos++ < MAX_REINTENTOS_RELOJ) this.programar(TIEMPO_REINTENTO_MS, accion);
      }
    });
  }
}
