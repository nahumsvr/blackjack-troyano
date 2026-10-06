/**
 * Servidor falso para desarrollar y demostrar la UI sin backend (`?mock=1`).
 * Implementa la misma interfaz `Transporte` que la conexión real y se comporta igual
 * hacia la app: valida las intenciones con el contrato, responde con un pequeño retraso
 * (para ver los estados "pendiente"), repite un `reqId` y notifica cada respuesta a los oyentes.
 *
 * Reproduce las validaciones principales del servidor (fase, turno, saldo, límite diario,
 * clave repetida) solo para poder ver los avisos de error; NO es la fuente de verdad del juego.
 */
import {
  MENSAJES_ERROR,
  MensajeClienteSchema,
  MensajeServidorSchema,
  type BilleteraEstado,
  type CodigoError,
  type FaseMesa,
  type MensajeCliente,
  type MensajeServidor,
  type MesaEstado,
  type Resultado,
} from "@blackjack/shared";
import { ErrorPeticion, errorLocal } from "../net/erroresLocales";
import type { EstadoConexion, EventoTransporte, Intencion, OyenteTransporte, Transporte } from "../net/transporte";
import {
  CONTRASENA_INCORRECTA,
  EQUIPADO_INICIAL,
  ID_DEMO,
  LOBBY_DEMO,
  MESA_DEMO,
  MESA_LLENA,
  TOKEN_DEMO,
  USUARIO_EXISTENTE,
  billeteraInicial,
  catalogoDemo,
  mesaEnFase,
  movimientosDemo,
  resultadoDemo,
} from "./fixtures";

/** Retraso simulado de red, en ms. */
const LATENCIA_MS = 150;

/** Dependencias inyectables del servidor falso (para pruebas). */
export interface OpcionesServidorFalso {
  /** Retraso de cada respuesta en ms; 0 en pruebas. */
  latenciaMs?: number;
  /** Hora local; por defecto `Date.now`. */
  ahora?: () => number;
}

/** Transporte simulado con estado en memoria. */
export class ServidorFalso implements Transporte {
  private readonly oyentes = new Set<OyenteTransporte>();
  private readonly latenciaMs: number;
  private readonly ahora: () => number;
  private estado: EstadoConexion = "cerrado";
  private contador = 0;
  private usuario: string | null = null;
  private sentado = false;
  private fase: FaseMesa = "APUESTAS";
  private mesa: MesaEstado;
  private billetera: BilleteraEstado = billeteraInicial();
  /** Resultado que recibe el usuario demo al llegar a PAGOS. */
  private resultadoElegido: Resultado = "gana";
  private readonly clavesUsadas = new Set<string>();

  /** @param opciones - Latencia y reloj inyectables. */
  constructor(opciones: OpcionesServidorFalso = {}) {
    this.latenciaMs = opciones.latenciaMs ?? LATENCIA_MS;
    this.ahora = opciones.ahora ?? (() => Date.now());
    this.mesa = mesaEnFase(this.fase, this.ahora());
  }

  /** Fase que el mock muestra actualmente. */
  get faseActual(): FaseMesa {
    return this.fase;
  }

  /** Simula abrir la conexión y el mensaje de bienvenida. */
  conectar(): void {
    if (this.estado === "conectado") return;
    this.cambiarEstado("conectando");
    this.diferir(() => {
      // Si se cerró antes de "abrir" (p. ej. el doble montaje de StrictMode), no se conecta.
      if (this.estado !== "conectando") return;
      this.cambiarEstado("conectado");
      this.emitir({ type: "bienvenida", conectados: 3 });
    });
  }

  /** Simula cerrar la conexión. */
  cerrar(): void {
    this.cambiarEstado("cerrado");
  }

  /**
   * Simula una caída de red: pasa a `reconectando` y vuelve tras `ms`.
   * @param ms - Duración de la caída.
   */
  simularCaida(ms: number): void {
    this.cambiarEstado("reconectando");
    setTimeout(() => this.conectar(), ms);
  }

  /**
   * Cambia la fase de la mesa demo y publica el snapshot (si el usuario está sentado).
   * En `PAGOS` publica también el resultado de la ronda (con un `rondaId` nuevo, como una ronda
   * real) y la billetera con el pago acreditado.
   * @param fase - Fase a mostrar.
   */
  irAFase(fase: FaseMesa): void {
    this.fase = fase;
    this.mesa = mesaEnFase(fase, this.ahora());
    if (!this.sentado) return;
    this.emitir({ type: "mesa.estado", ...this.mesa });
    if (fase !== "PAGOS") return;
    const ronda = resultadoDemo(this.resultadoElegido, crypto.randomUUID());
    this.emitir({ type: "ronda.resultado", ...ronda });
    const pago = ronda.resultados.find((fila) => fila.usuarioId === ID_DEMO)?.pago ?? 0;
    if (pago > 0) {
      this.billetera = { ...this.billetera, fichas: this.billetera.fichas + pago };
      this.emitir({ type: "billetera", ...this.billetera });
    }
  }

  /**
   * Elige el resultado del usuario demo y juega la fase de pagos con él.
   * @param resultado - Resultado a mostrar.
   */
  simularResultado(resultado: Resultado): void {
    this.resultadoElegido = resultado;
    this.irAFase("PAGOS");
  }

  /**
   * Valida y responde una intención como lo haría el servidor real.
   * @param intencion - Mensaje del cliente sin `reqId`.
   * @returns Respuesta directa.
   * @throws ErrorPeticion MENSAJE_CLIENTE_INVALIDO | SIN_CONEXION | código del contrato.
   */
  enviar(intencion: Intencion): Promise<MensajeServidor> {
    const reqId = `mock-${++this.contador}`;
    const validado = MensajeClienteSchema.safeParse({ ...intencion, reqId });
    if (!validado.success) return Promise.reject(errorLocal("MENSAJE_CLIENTE_INVALIDO"));
    if (this.estado !== "conectado") return Promise.reject(errorLocal("SIN_CONEXION"));
    return new Promise((resolver, rechazar) => {
      this.diferir(() => {
        if (this.estado !== "conectado") {
          rechazar(errorLocal("SIN_CONEXION"));
          return;
        }
        const respuesta = this.responder(validado.data);
        if (respuesta.type === "error") {
          // Igual que la conexión real: el error con reqId se notifica y además rechaza la petición.
          this.emitir({ ...respuesta, reqId });
          rechazar(new ErrorPeticion(respuesta.codigo, respuesta.mensaje));
          return;
        }
        const conReqId = { ...respuesta, reqId };
        this.emitir(conReqId);
        resolver(conReqId);
      });
    });
  }

  /**
   * Registra un oyente.
   * @param oyente - Función a notificar.
   * @returns Función que cancela la suscripción.
   */
  suscribir(oyente: OyenteTransporte): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  /**
   * Calcula la respuesta a un mensaje ya validado. Los efectos secundarios a otros
   * "topics" (billetera, lobby) se emiten aquí mismo.
   * @param mensaje - Mensaje del cliente validado.
   * @returns Respuesta directa (sin `reqId`).
   */
  private responder(mensaje: MensajeCliente): MensajeServidor {
    const requiereSesion = !["registro", "login", "reanudar", "ping"].includes(mensaje.type);
    if (requiereSesion && this.usuario === null) return error("NO_AUTENTICADO");
    switch (mensaje.type) {
      case "registro":
        if (this.usuario !== null) return error("YA_AUTENTICADO");
        if (mensaje.usuario === USUARIO_EXISTENTE) return error("USUARIO_EXISTE");
        return this.iniciarSesion(mensaje.usuario);
      case "login":
        if (this.usuario !== null) return error("YA_AUTENTICADO");
        if (mensaje.contrasena === CONTRASENA_INCORRECTA) return error("CREDENCIALES_INVALIDAS");
        return this.iniciarSesion(mensaje.usuario);
      case "reanudar":
        return mensaje.token === TOKEN_DEMO ? this.iniciarSesion("demo") : error("SESION_INVALIDA");
      case "logout":
        this.usuario = null;
        this.sentado = false;
        return { type: "ok" };
      case "lobby.listar":
        return { type: "lobby", mesas: LOBBY_DEMO };
      case "mesa.unirse":
        if (!LOBBY_DEMO.some((mesa) => mesa.id === mensaje.mesaId)) return error("MESA_NO_EXISTE");
        if (mensaje.mesaId === MESA_LLENA) return error("MESA_LLENA");
        if (mensaje.mesaId !== MESA_DEMO) return error("MESA_NO_EXISTE"); // el mock solo simula la mesa 1
        this.sentado = true;
        this.mesa = mesaEnFase(this.fase, this.ahora());
        return { type: "mesa.estado", ...this.mesa };
      case "mesa.salir":
        if (!this.sentado) return error("NO_ESTAS_EN_MESA");
        this.sentado = false;
        this.emitir({ type: "lobby", mesas: LOBBY_DEMO });
        return { type: "ok" };
      case "apostar":
        return this.apostar(mensaje.cantidad);
      case "pedir":
      case "plantarse":
        return this.jugar(mensaje.type);
      case "billetera.consultar":
        return { type: "billetera", ...this.billetera };
      case "fichas.comprar":
        return this.comprarFichas(mensaje.cantidad, mensaje.clave);
      case "tienda.catalogo":
        return { type: "catalogo", articulos: catalogoDemo() };
      case "tienda.comprar":
        return error(catalogoDemo().some((articulo) => articulo.id === mensaje.articuloId) ? "FICHAS_INSUFICIENTES" : "ARTICULO_NO_EXISTE");
      case "inventario.listar":
        return { type: "inventario", articulos: catalogoDemo().filter((articulo) => articulo.poseido).map(({ poseido: _poseido, ...articulo }) => articulo), equipado: EQUIPADO_INICIAL };
      case "inventario.equipar":
        return error("NO_POSEIDO");
      case "movimientos.listar":
        return this.listarMovimientos(mensaje.limite, mensaje.antesDe);
      case "ping":
        return { type: "pong", t: this.ahora() };
    }
  }

  /**
   * Abre la sesión del usuario indicado.
   * @param usuario - Nombre de usuario.
   * @returns Mensaje `sesion`.
   */
  private iniciarSesion(usuario: string): MensajeServidor {
    this.usuario = usuario;
    return {
      type: "sesion",
      token: TOKEN_DEMO,
      usuario: { id: ID_DEMO, usuario },
      billetera: this.billetera,
      equipado: EQUIPADO_INICIAL,
      mesaId: this.sentado ? MESA_DEMO : null,
    };
  }

  /**
   * Registra la apuesta del usuario en el snapshot y descuenta sus fichas.
   * @param cantidad - Fichas (ya validadas por el esquema).
   * @returns Snapshot actualizado o error.
   */
  private apostar(cantidad: number): MensajeServidor {
    if (!this.sentado) return error("NO_ESTAS_EN_MESA");
    if (this.mesa.fase !== "APUESTAS") return error("FASE_INCORRECTA");
    const propio = this.mesa.asientos[0];
    if (propio === null || propio === undefined) return error("NO_ESTAS_EN_MESA");
    if (propio.apuesta > 0) return error("YA_APOSTASTE");
    if (cantidad > this.billetera.fichas) return error("FICHAS_INSUFICIENTES");
    this.billetera = { ...this.billetera, fichas: this.billetera.fichas - cantidad };
    this.mesa = { ...this.mesa, asientos: this.mesa.asientos.map((asiento) => (asiento?.usuarioId === ID_DEMO ? { ...asiento, apuesta: cantidad, estado: "APOSTADO" } : asiento)) };
    this.emitir({ type: "billetera", ...this.billetera });
    return { type: "mesa.estado", ...this.mesa };
  }

  /**
   * Simula pedir o plantarse en el turno del usuario.
   * @param accion - `pedir` agrega un 2♣; `plantarse` termina el turno.
   * @returns Snapshot actualizado o error.
   */
  private jugar(accion: "pedir" | "plantarse"): MensajeServidor {
    if (!this.sentado) return error("NO_ESTAS_EN_MESA");
    if (this.mesa.fase !== "TURNOS") return error("FASE_INCORRECTA");
    if (this.mesa.turnoDe !== ID_DEMO) return error("NO_ES_TU_TURNO");
    this.mesa = {
      ...this.mesa,
      turnoDe: accion === "plantarse" ? null : this.mesa.turnoDe,
      asientos: this.mesa.asientos.map((asiento) => {
        if (asiento?.usuarioId !== ID_DEMO) return asiento;
        if (accion === "plantarse") return { ...asiento, estado: "PLANTADO" };
        const total = asiento.total + 2;
        return { ...asiento, cartas: [...asiento.cartas, { rango: "2", palo: "♣" }], total, estado: total > 21 ? "PASADO" : "JUGANDO" };
      }),
    };
    return { type: "mesa.estado", ...this.mesa };
  }

  /**
   * Compra fichas respetando dinero, límite diario e idempotencia por clave.
   * @param cantidad - Fichas (ya validadas por el esquema).
   * @param clave - Clave de idempotencia del clic.
   * @returns Billetera actualizada o error.
   */
  private comprarFichas(cantidad: number, clave: string): MensajeServidor {
    // Clave repetida: se responde el saldo actual sin cobrar otra vez (doble clic o reintento).
    if (this.clavesUsadas.has(clave)) return { type: "billetera", ...this.billetera };
    if (cantidad > this.billetera.dinero) return error("DINERO_INSUFICIENTE");
    if (cantidad > this.billetera.disponibleHoy) return error("LIMITE_DIARIO");
    this.clavesUsadas.add(clave);
    const compradoHoy = this.billetera.compradoHoy + cantidad;
    this.billetera = {
      ...this.billetera,
      dinero: this.billetera.dinero - cantidad,
      fichas: this.billetera.fichas + cantidad,
      compradoHoy,
      disponibleHoy: Math.max(0, this.billetera.limiteDiario - compradoHoy),
    };
    return { type: "billetera", ...this.billetera };
  }

  /**
   * Devuelve una página del historial de ejemplo.
   * @param limite - Máximo de filas.
   * @param antesDe - Id a partir del cual continuar (exclusivo).
   * @returns Mensaje `movimientos`.
   */
  private listarMovimientos(limite: number, antesDe: string | undefined): MensajeServidor {
    const todos = movimientosDemo();
    const desde = antesDe === undefined ? todos : todos.filter((fila) => Number(fila.id) < Number(antesDe));
    return { type: "movimientos", items: desde.slice(0, limite), hayMas: desde.length > limite };
  }

  /**
   * Ejecuta una función tras la latencia simulada.
   * @param funcion - Trabajo a diferir.
   */
  private diferir(funcion: () => void): void {
    setTimeout(funcion, this.latenciaMs);
  }

  /**
   * Cambia el estado y lo notifica.
   * @param estado - Nuevo estado.
   */
  private cambiarEstado(estado: EstadoConexion): void {
    if (this.estado === estado) return;
    this.estado = estado;
    this.notificar({ tipo: "conexion", estado });
  }

  /**
   * Publica un mensaje del servidor a los oyentes, validándolo antes como haría la conexión real.
   * Un fixture fuera de contrato es un bug del mock: se avisa en consola y no se publica.
   * @param mensaje - Mensaje a publicar.
   */
  private emitir(mensaje: MensajeServidor): void {
    const validado = MensajeServidorSchema.safeParse(mensaje);
    if (!validado.success) {
      console.error("El mock generó un mensaje fuera de contrato:", mensaje, validado.error.issues);
      return;
    }
    this.notificar({ tipo: "mensaje", mensaje: validado.data });
  }

  /**
   * Notifica un evento a todos los oyentes, aislando sus excepciones.
   * @param evento - Evento a notificar.
   */
  private notificar(evento: EventoTransporte): void {
    for (const oyente of this.oyentes) {
      try {
        oyente(evento);
      } catch (excepcion) {
        console.error("Error en un oyente del mock:", excepcion);
      }
    }
  }
}

/**
 * Construye un mensaje `error` con el texto oficial del contrato.
 * @param codigo - Código de error.
 * @returns Mensaje de error sin `reqId`.
 */
function error(codigo: CodigoError): MensajeServidor {
  return { type: "error", codigo, mensaje: MENSAJES_ERROR[codigo] };
}
