/** Jugadores T-26: intenciones WS y snapshots compartidos, sin acceso al motor ni a SQL. */
import { ErrorJuego, MensajeClienteSchema, MensajeServidorSchema, MesaIdSchema,
  type EntradaMensajeCliente, type MesaEstado, type MensajeServidor } from "@blackjack/shared";
import { APUESTA_MIN, BOTS_PLANTARSE_EN, BOTS_RESPUESTA_MS, BOTS_RONDAS,
  BOTS_SIN_RONDA_MS, CAPACIDAD_MESA, MESAS, PUERTO, RUTA_WS } from "../server/src/config";

type OpcionesBots = { cantidad: number; mesaId: string; rondas: number; url: string };
type ResultadoBot = { usuario: string; usuarioId: number; rondas: string[] };
const uso = "Uso: bun run bots N [--mesa mesa-1] [--rondas 10|0] [--url ws://127.0.0.1:3000/ws]";

function validar(opciones: OpcionesBots): OpcionesBots {
  if (!Number.isSafeInteger(opciones.cantidad) || opciones.cantidad < 1 || opciones.cantidad > CAPACIDAD_MESA
    || !Number.isSafeInteger(opciones.rondas) || opciones.rondas < 0) throw new Error(uso);
  MesaIdSchema.parse(opciones.mesaId);
  const url = new URL(opciones.url);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") throw new Error(uso);
  return opciones;
}

/**
 * @param argumentos - N y opciones de la línea de comandos.
 * @returns Configuración validada; rondas cero juega hasta Ctrl+C.
 * @throws Error Si falta N o una opción es desconocida, repetida o inválida.
 */
export function leerOpcionesBots(argumentos: string[]): OpcionesBots {
  const opciones = { cantidad: Number(argumentos[0]), mesaId: MESAS[0].id as string,
    rondas: BOTS_RONDAS, url: `ws://127.0.0.1:${PUERTO}${RUTA_WS}` };
  const vistas = new Set<string>();
  for (let indice = 1; indice < argumentos.length; indice += 2) {
    const opcion = argumentos[indice]!;
    const valor = argumentos[indice + 1];
    if (!valor || vistas.has(opcion)) throw new Error(uso);
    vistas.add(opcion);
    switch (opcion) {
      case "--mesa": opciones.mesaId = valor; break;
      case "--rondas": opciones.rondas = Number(valor); break;
      case "--url": opciones.url = valor; break;
      default: throw new Error(uso);
    }
  }
  return validar(opciones);
}

/** Conexión independiente; mantiene una sola intención en vuelo para evitar dobles apuestas. */
class Bot {
  private readonly socket: WebSocket;
  private usuarioId = 0;
  private mesa: MesaEstado | undefined;
  private activo = false;
  private ocupado = false;
  private fallo: Error | undefined;
  private readonly rondas = new Set<string>();
  private relojRonda: ReturnType<typeof setTimeout> | undefined;
  private pendiente: { reqId: string; resolver: (mensaje: MensajeServidor) => void;
    rechazar: (error: Error) => void; reloj: ReturnType<typeof setTimeout> } | undefined;
  private finalizar: (() => void) | undefined;
  private rechazarPartida: ((error: Error) => void) | undefined;
  private readonly alAbortar = () => this.fallar(this.senal.reason);

  /**
   * @param opciones - Destino y límite de rondas compartidos por el grupo.
   * @param usuario - Nombre nuevo, sin reutilizar sesiones ajenas.
   * @param registrar - Salida de resultados públicos.
   * @param senal - Cancelación de todo el grupo ante un fallo.
   * @returns Bot con observadores instalados antes de abrir el socket.
   * @throws Error Si no se puede construir la conexión.
   */
  constructor(private readonly opciones: OpcionesBots, readonly usuario: string,
    private readonly registrar: (texto: string) => void, private readonly senal: AbortSignal) {
    this.socket = new WebSocket(opciones.url);
    this.senal.addEventListener("abort", this.alAbortar, { once: true });
    this.socket.addEventListener("error", () => this.fallar(new Error("Falló el WebSocket")));
    this.socket.addEventListener("close", () => this.fallar(new Error("El servidor cerró la conexión")));
    this.socket.addEventListener("message", (evento) => {
      try {
        const mensaje = MensajeServidorSchema.parse(JSON.parse(String(evento.data)));
        if (mensaje.type === "error") throw new ErrorJuego(mensaje.codigo);
        if (mensaje.type === "mesa.estado" && mensaje.id === opciones.mesaId) this.mesa = mensaje;
        if (mensaje.type === "ronda.resultado" && mensaje.resultados.some((fila) => fila.usuarioId === this.usuarioId)
          && !this.rondas.has(mensaje.rondaId)) {
          this.rondas.add(mensaje.rondaId);
          const resultado = mensaje.resultados.find((fila) => fila.usuarioId === this.usuarioId)!;
          this.registrar(`[${usuario}] ronda ${this.rondas.size}${opciones.rondas ? `/${opciones.rondas}` : ""}: ${resultado.resultado}, pago ${resultado.pago}`);
          this.vigilarRonda();
          if (this.completo()) this.finalizar?.();
        }
        if (this.pendiente && mensaje.reqId === this.pendiente.reqId) {
          const pendiente = this.pendiente!;
          this.pendiente = undefined;
          clearTimeout(pendiente.reloj);
          pendiente.resolver(mensaje);
        }
        this.actuar();
      } catch (error) { this.fallar(error); }
    });
  }

  /** @returns Registro y asiento confirmados. @throws Error Ante rechazo, cierre o timeout. */
  async preparar(): Promise<void> {
    await new Promise<void>((resolver, rechazar) => {
      const reloj = setTimeout(() => terminar(new Error("No abrió el WebSocket")), BOTS_RESPUESTA_MS);
      const terminar = (error?: Error) => {
        clearTimeout(reloj);
        this.socket.removeEventListener("open", abrir);
        this.senal.removeEventListener("abort", abortar);
        this.socket.removeEventListener("close", cerrar);
        this.socket.removeEventListener("error", cerrar);
        if (error) rechazar(error); else resolver();
      };
      const abrir = () => terminar();
      const abortar = () => terminar(new Error("Bots cancelados"));
      const cerrar = () => terminar(this.fallo ?? new Error("Falló el WebSocket"));
      this.socket.addEventListener("open", abrir, { once: true });
      this.socket.addEventListener("close", cerrar, { once: true });
      this.socket.addEventListener("error", cerrar, { once: true });
      this.senal.addEventListener("abort", abortar, { once: true });
      if (this.senal.aborted) abortar();
      else if (this.socket.readyState === WebSocket.OPEN) abrir();
      else if (this.socket.readyState === WebSocket.CLOSED) cerrar();
    });
    const sesion = await this.enviar({ type: "registro", usuario: this.usuario, contrasena: crypto.randomUUID() });
    if (sesion.type !== "sesion") throw new Error("Se esperaba una sesión");
    this.usuarioId = sesion.usuario.id;
    const mesa = await this.enviar({ type: "mesa.unirse", mesaId: this.opciones.mesaId });
    if (mesa.type !== "mesa.estado" || mesa.id !== this.opciones.mesaId) throw new Error("Se esperaba el estado de la mesa");
    this.vigilarRonda();
  }

  /** @returns Rondas confirmadas. @throws Error Ante fallo de juego o cancelación. */
  jugar(): Promise<ResultadoBot> {
    return new Promise<void>((resolver, rechazar) => {
      this.finalizar = resolver;
      this.rechazarPartida = rechazar;
      if (this.fallo) { rechazar(this.fallo); return; }
      this.activo = true;
      this.actuar();
    }).then(() => ({ usuario: this.usuario, usuarioId: this.usuarioId, rondas: [...this.rondas] }));
  }

  /** @returns Libera observadores y relojes y solicita cerrar el socket. */
  cerrar(): void {
    this.activo = false;
    this.senal.removeEventListener("abort", this.alAbortar);
    clearTimeout(this.relojRonda);
    if (this.pendiente) {
      clearTimeout(this.pendiente.reloj);
      this.pendiente.rechazar(new Error("Bots detenidos"));
      this.pendiente = undefined;
    }
    this.socket.close();
  }

  private completo(): boolean { return this.opciones.rondas > 0 && this.rondas.size >= this.opciones.rondas; }

  private vigilarRonda(): void {
    clearTimeout(this.relojRonda);
    if (!this.completo()) this.relojRonda = setTimeout(() => this.fallar(new Error("La mesa no termina rondas")), BOTS_SIN_RONDA_MS);
  }

  private fallar(error: unknown): void {
    if (this.fallo || this.completo()) return;
    this.fallo = new Error(`[${this.usuario}] ${error instanceof Error ? error.message : String(error)}`);
    clearTimeout(this.relojRonda);
    if (this.pendiente) {
      clearTimeout(this.pendiente.reloj);
      this.pendiente.rechazar(this.fallo);
      this.pendiente = undefined;
    }
    this.rechazarPartida?.(this.fallo);
  }

  private enviar(entrada: EntradaMensajeCliente): Promise<MensajeServidor> {
    if (this.fallo) return Promise.reject(this.fallo);
    return new Promise((resolver, rechazar) => {
      const reqId = crypto.randomUUID();
      this.pendiente = { reqId, resolver, rechazar,
        reloj: setTimeout(() => this.fallar(new Error(`Sin respuesta a ${entrada.type}`)), BOTS_RESPUESTA_MS) };
      try { this.socket.send(JSON.stringify(MensajeClienteSchema.parse({ ...entrada, reqId }))); }
      catch (error) { this.fallar(error); }
    });
  }

  private actuar(): void {
    if (!this.activo || this.ocupado || this.fallo || this.completo() || !this.mesa) return;
    const asiento = this.mesa.asientos.find((jugador) => jugador?.usuarioId === this.usuarioId);
    let accion: EntradaMensajeCliente | undefined;
    if (this.mesa.fase === "APUESTAS" && asiento?.estado === "SIN_APUESTA") accion = { type: "apostar", cantidad: APUESTA_MIN };
    if (this.mesa.fase === "TURNOS" && this.mesa.turnoDe === this.usuarioId && asiento?.estado === "JUGANDO") {
      accion = { type: asiento.total < BOTS_PLANTARSE_EN ? "pedir" : "plantarse" };
    }
    if (!accion) return;
    // El servidor publica y responde al mismo cambio. Serializar evita actuar dos veces
    // mientras llegan esos snapshots, y siempre decide usando el último recibido.
    this.ocupado = true;
    void this.enviar(accion).then((respuesta) => {
      if (respuesta.type !== "mesa.estado" || respuesta.id !== this.opciones.mesaId) {
        this.fallar(new Error("Se esperaba el estado de la mesa")); return;
      }
      this.ocupado = false;
      this.actuar();
    }, (error: unknown) => this.fallar(error));
  }
}

/**
 * Registra cuentas nuevas y las sienta antes de habilitar la primera apuesta del grupo.
 * @param opciones - Número de bots, mesa, rondas (cero = continuo) y endpoint WS.
 * @param registrar - Salida de progreso; nunca escribe tokens ni contraseñas.
 * @param senal - Cancelación opcional para terminar también durante registro o espera.
 * @returns Usuarios y UUID de las rondas en las que participaron; cierra los sockets.
 * @throws Error Si el protocolo falla, el servidor rechaza una intención o deja de responder.
 */
export async function ejecutarBots(opciones: OpcionesBots, registrar: (texto: string) => void = console.info,
  senal?: AbortSignal): Promise<ResultadoBot[]> {
  validar(opciones);
  const cancelar = new AbortController();
  const conjunta = senal ? AbortSignal.any([senal, cancelar.signal]) : cancelar.signal;
  const prefijo = `bot_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const bots: Bot[] = [];
  try {
    for (let indice = 0; indice < opciones.cantidad; indice++) bots.push(new Bot(opciones, `${prefijo}_${indice + 1}`, registrar, conjunta));
    // Registrar/sentar en orden evita una ráfaga de hash/SQL al arrancar el pool.
    // Solo la preparación es secuencial; todos juegan por sus sockets independientes.
    for (const bot of bots) await bot.preparar();
    registrar(`${bots.length} bots sentados en ${opciones.mesaId}; apuesta ${APUESTA_MIN}, objetivo ${BOTS_PLANTARSE_EN}.`);
    const resultado = await Promise.all(bots.map((bot) => bot.jugar()));
    registrar(`Completadas ${opciones.rondas} rondas por bot, sin errores.`);
    return resultado;
  } catch (error) { cancelar.abort(error); throw error; }
  finally { for (const bot of bots) bot.cerrar(); }
}

if (import.meta.main) {
  const cancelar = new AbortController();
  const detener = () => cancelar.abort(new Error("Bots cancelados"));
  process.once("SIGINT", detener);
  process.once("SIGTERM", detener);
  try { await ejecutarBots(leerOpcionesBots(Bun.argv.slice(2)), console.info, cancelar.signal); }
  catch (error) {
    if (cancelar.signal.aborted) console.info("Bots detenidos.");
    else { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  } finally { process.removeListener("SIGINT", detener); process.removeListener("SIGTERM", detener); }
}
