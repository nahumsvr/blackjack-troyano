/**
 * Controlador del cliente: la única pieza con efectos. Traduce los clics de la UI en intenciones
 * para el servidor, aplica sus respuestas al estado (vía `despachar`) y convierte cualquier fallo
 * en un aviso legible. Ningún método público lanza: devuelven `true`/`false` según el resultado.
 *
 * También orquesta la sesión: al (re)conectar mide el desfase del reloj y manda `reanudar`
 * si hay token guardado; guarda el token de cada `sesion` y lo borra si el servidor lo rechaza.
 */
import type { MensajeServidor } from "@blackjack/shared";
import { DURACION_AVISO_MS } from "../config";
import type { AlmacenToken } from "../net/almacenToken";
import { ErrorPeticion } from "../net/erroresLocales";
import { calcularDesfase } from "../net/reloj";
import type { EventoTransporte, Intencion, Transporte } from "../net/transporte";
import type { Aviso, EventoJuego } from "./reductor";

/** Dependencias opcionales del controlador (inyectables en pruebas). */
export interface OpcionesControlador {
  /** Hora local en ms; por defecto `Date.now`. */
  ahora?: () => number;
  /** Genera la clave de idempotencia de cada compra; por defecto `crypto.randomUUID`. */
  generarClave?: () => string;
  /** Programa el cierre automático de avisos; por defecto `setTimeout`. */
  programar?: (funcion: () => void, ms: number) => unknown;
}

/** Mensaje para errores no previstos (excepciones que no son `ErrorPeticion`). */
const TEXTO_ERROR_INESPERADO = "Ocurrió un error inesperado en la aplicación.";

/** Orquesta transporte, almacenamiento del token y estado. */
export class ControladorJuego {
  private readonly ahora: () => number;
  private readonly generarClave: () => string;
  private readonly programar: (funcion: () => void, ms: number) => unknown;
  private siguienteAviso = 1;
  private desuscribir: (() => void) | null = null;

  /**
   * @param transporte - Conexión real o servidor falso.
   * @param despachar - Aplica un evento al estado global.
   * @param almacen - Dónde se guarda el token de sesión.
   * @param opciones - Dependencias inyectables.
   */
  constructor(
    private readonly transporte: Transporte,
    private readonly despachar: (evento: EventoJuego) => void,
    private readonly almacen: AlmacenToken,
    opciones: OpcionesControlador = {},
  ) {
    this.ahora = opciones.ahora ?? (() => Date.now());
    this.generarClave = opciones.generarClave ?? (() => crypto.randomUUID());
    this.programar = opciones.programar ?? ((funcion, ms) => setTimeout(funcion, ms));
  }

  /** Se suscribe al transporte y abre la conexión. Llamar de nuevo no duplica la suscripción. */
  iniciar(): void {
    if (this.desuscribir === null) this.desuscribir = this.transporte.suscribir((evento) => this.alEvento(evento));
    this.transporte.conectar();
  }

  /** Cancela la suscripción y cierra la conexión. */
  detener(): void {
    this.desuscribir?.();
    this.desuscribir = null;
    this.transporte.cerrar();
  }

  /**
   * Crea una cuenta nueva; la respuesta `sesion` llega por la suscripción.
   * @param usuario - Nombre de usuario (validado antes en el formulario).
   * @param contrasena - Contraseña en claro; viaja solo al servidor.
   * @returns `true` si el servidor creó la cuenta.
   */
  registrar(usuario: string, contrasena: string): Promise<boolean> {
    return this.ejecutar({ type: "registro", usuario, contrasena });
  }

  /**
   * Inicia sesión con usuario y contraseña.
   * @param usuario - Nombre de usuario.
   * @param contrasena - Contraseña.
   * @returns `true` si las credenciales fueron aceptadas.
   */
  iniciarSesion(usuario: string, contrasena: string): Promise<boolean> {
    return this.ejecutar({ type: "login", usuario, contrasena });
  }

  /**
   * Cierra la sesión. Aunque el servidor no responda, la sesión se olvida localmente.
   * @returns `true` si el servidor confirmó el cierre.
   */
  async cerrarSesion(): Promise<boolean> {
    const exito = await this.ejecutar({ type: "logout" });
    this.almacen.borrar();
    this.despachar({ tipo: "sesionTerminada" });
    return exito;
  }

  /** @returns `true` si se recibió la lista de mesas. */
  listarLobby(): Promise<boolean> {
    return this.ejecutar({ type: "lobby.listar" });
  }

  /**
   * Se sienta en una mesa; el snapshot llega por la suscripción.
   * @param mesaId - Identificador de la mesa.
   * @returns `true` si el servidor aceptó.
   */
  unirseAMesa(mesaId: string): Promise<boolean> {
    return this.ejecutar({ type: "mesa.unirse", mesaId });
  }

  /** @returns `true` si el servidor liberó el asiento (la vista vuelve al lobby). */
  async salirDeMesa(): Promise<boolean> {
    const exito = await this.ejecutar({ type: "mesa.salir" });
    if (exito) this.despachar({ tipo: "salioDeMesa" });
    return exito;
  }

  /**
   * Apuesta fichas en la ronda actual.
   * @param cantidad - Entero múltiplo de 10 dentro del rango del contrato.
   * @returns `true` si la apuesta fue aceptada.
   */
  apostar(cantidad: number): Promise<boolean> {
    return this.ejecutar({ type: "apostar", cantidad });
  }

  /** @returns `true` si el servidor repartió la carta. */
  pedir(): Promise<boolean> {
    return this.ejecutar({ type: "pedir" });
  }

  /** @returns `true` si el servidor registró el plantarse. */
  plantarse(): Promise<boolean> {
    return this.ejecutar({ type: "plantarse" });
  }

  /** @returns `true` si se recibió el estado de la billetera. */
  consultarBilletera(): Promise<boolean> {
    return this.ejecutar({ type: "billetera.consultar" });
  }

  /**
   * Compra fichas con dinero simulado. Cada llamada usa una clave nueva: si el mismo clic
   * llegara dos veces al servidor, la clave repetida evita cobrar doble.
   * @param cantidad - Fichas a comprar (entero, múltiplo de 10, dentro del rango del contrato).
   * @returns `true` si la compra se realizó.
   */
  comprarFichas(cantidad: number): Promise<boolean> {
    return this.ejecutar({ type: "fichas.comprar", cantidad, clave: this.generarClave() });
  }

  /**
   * Pide el catálogo de la tienda; la respuesta `catalogo` llega por `alEvento` y el reductor
   * la guarda en `estado.catalogo`. Por ahora solo se consulta (la compra es T-39).
   * @returns `true` si se recibió el catálogo.
   */
  cargarCatalogo(): Promise<boolean> {
    return this.ejecutar({ type: "tienda.catalogo" });
  }

  /**
   * Carga el historial de movimientos.
   * @param antesDe - Id del último movimiento visible para "ver más"; sin él se carga la primera página.
   * @returns `true` si se recibió la página.
   */
  async listarMovimientos(antesDe?: string): Promise<boolean> {
    const intencion: Intencion = antesDe === undefined ? { type: "movimientos.listar" } : { type: "movimientos.listar", antesDe };
    const respuesta = await this.peticion(intencion);
    if (respuesta?.type !== "movimientos") return false;
    this.despachar({ tipo: "movimientos", items: respuesta.items, hayMas: respuesta.hayMas, anexar: antesDe !== undefined });
    return true;
  }

  /**
   * Muestra un aviso que se oculta solo tras `DURACION_AVISO_MS`.
   * @param nivel - `error` o `info`.
   * @param texto - Texto en español para el usuario.
   */
  avisar(nivel: Aviso["nivel"], texto: string): void {
    const id = this.siguienteAviso++;
    this.despachar({ tipo: "aviso", aviso: { id, nivel, texto } });
    this.programar(() => this.despachar({ tipo: "quitarAviso", id }), DURACION_AVISO_MS);
  }

  /**
   * Oculta un aviso antes de tiempo.
   * @param id - Id del aviso.
   */
  quitarAviso(id: number): void {
    this.despachar({ tipo: "quitarAviso", id });
  }

  /**
   * Envía una intención y reporta solo si tuvo éxito.
   * @param intencion - Mensaje a enviar.
   * @returns `true` si hubo respuesta sin error.
   */
  private async ejecutar(intencion: Intencion): Promise<boolean> {
    return (await this.peticion(intencion)) !== null;
  }

  /**
   * Envía una intención marcándola como pendiente mientras espera, y convierte cualquier fallo en aviso.
   * @param intencion - Mensaje a enviar.
   * @returns La respuesta, o `null` si falló.
   */
  private async peticion(intencion: Intencion): Promise<MensajeServidor | null> {
    this.despachar({ tipo: "pendiente", accion: intencion.type, activo: true });
    try {
      return await this.transporte.enviar(intencion);
    } catch (error) {
      this.manejarError(error);
      return null;
    } finally {
      this.despachar({ tipo: "pendiente", accion: intencion.type, activo: false });
    }
  }

  /**
   * Reacciona a cada evento del transporte.
   * @param evento - Cambio de conexión o mensaje del servidor.
   */
  private alEvento(evento: EventoTransporte): void {
    if (evento.tipo === "conexion") {
      this.despachar({ tipo: "conexion", estado: evento.estado });
      if (evento.estado === "conectado") void this.alConectar();
      return;
    }
    const mensaje = evento.mensaje;
    this.despachar({ tipo: "servidor", mensaje });
    if (mensaje.type === "sesion") this.almacen.guardar(mensaje.token);
    // Los errores con reqId ya llegan como rechazo de su petición; aquí solo los espontáneos.
    if (mensaje.type === "error" && mensaje.reqId === undefined) {
      this.manejarError(new ErrorPeticion(mensaje.codigo, mensaje.mensaje));
    }
  }

  /** Tras cada (re)conexión: recupera la sesión guardada y sincroniza el reloj. */
  private async alConectar(): Promise<void> {
    const token = this.almacen.leer();
    const reanudar = token === null ? Promise.resolve(true) : this.ejecutar({ type: "reanudar", token });
    await Promise.all([reanudar, this.medirDesfase()]);
  }

  /** Mide el desfase con el reloj del servidor con un `ping`; si falla, conserva el anterior. */
  private async medirDesfase(): Promise<void> {
    const enviadoEn = this.ahora();
    try {
      const respuesta = await this.transporte.enviar({ type: "ping" });
      if (respuesta.type === "pong") {
        this.despachar({ tipo: "desfase", ms: calcularDesfase(enviadoEn, this.ahora(), respuesta.t) });
      }
    } catch {
      // Sin pong no hay corrección; la cuenta regresiva usa la hora local (desfase previo).
    }
  }

  /**
   * Convierte un fallo en el efecto que corresponde y en un aviso legible.
   * @param error - Lo que rechazó la petición.
   */
  private manejarError(error: unknown): void {
    if (!(error instanceof ErrorPeticion)) {
      console.error("Error inesperado en el controlador:", error);
      this.avisar("error", TEXTO_ERROR_INESPERADO);
      return;
    }
    switch (error.codigo) {
      case "SESION_INVALIDA":
      case "NO_AUTENTICADO":
        // El token guardado ya no sirve: se olvida y se vuelve a la pantalla de acceso.
        this.almacen.borrar();
        this.despachar({ tipo: "sesionTerminada" });
        break;
      case "NO_ESTAS_EN_MESA":
        // Otra pestaña del mismo usuario tomó el asiento: esta queda mirando.
        this.despachar({ tipo: "espectador" });
        break;
    }
    this.avisar("error", error.message);
  }
}
