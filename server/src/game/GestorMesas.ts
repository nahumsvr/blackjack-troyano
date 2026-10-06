/** Coordina las mesas del motor y la propiedad de los asientos entre conexiones. */
import { ErrorJuego, type Equipado, type MesaEstado, type MesaResumen, type MensajeServidor, type UsuarioVista } from "@blackjack/shared";
import { CAPACIDAD_MESA, MESAS, TOPIC_LOBBY, topicMesa } from "../config";
import { Mesa } from "./Mesa";

/** Mantiene un solo asiento por usuario y una sola conexión propietaria del asiento. */
export class GestorMesas {
  private readonly mesas: Map<string, Mesa>;
  private readonly ubicaciones = new Map<number, string>();
  private readonly propietarios = new Map<number, string>();
  private readonly resumenesPublicados = new Map<string, string>(MESAS.map(({ id }) => [id, "ESPERANDO:0"]));

  /**
   * Construye el motor de las tres mesas y mantiene sus índices de ocupación.
   * @param publicar - Transporte pub/sub; recibe mensajes del contrato sin reqId.
   * @param alReemplazar - Retira la suscripción y avisa a la conexión anterior.
   * @returns Gestor con las tres mesas y publicaciones nativas, sin importar store/.
   */
  constructor(private readonly publicar: (topic: string, mensaje: MensajeServidor) => void,
    private readonly alReemplazar: (conexionId: string) => void = () => {}) {
    this.mesas = new Map(MESAS.map(({ id, nombre }) => [id, new Mesa(id, nombre, (mensaje) => {
      this.sincronizarUbicaciones();
      this.publicar(topicMesa(id), mensaje);
      const resumen = `${mensaje.fase}:${mensaje.asientos.filter(Boolean).length}`;
      // Las cartas y apuestas cambian el snapshot, pero no la fase/ocupación del lobby.
      if (resumen !== this.resumenesPublicados.get(id)) {
        this.resumenesPublicados.set(id, resumen);
        this.publicar(TOPIC_LOBBY, { type: "lobby", mesas: this.listar() });
      }
    })]));
  }

  /** Resume ocupación y fase para el lobby. @returns Copia de las tres mesas. */
  listar(): MesaResumen[] {
    return [...this.mesas.values()].map((mesa) => ({
      id: mesa.id, nombre: mesa.nombre, ocupados: mesa.snapshot().asientos.filter(Boolean).length,
      capacidad: CAPACIDAD_MESA, fase: mesa.fase,
    }));
  }

  /** Localiza el asiento autoritativo. @param usuarioId - Identidad autenticada. @returns Mesa ocupada o null. */
  mesaDeUsuario(usuarioId: number): string | null {
    return this.ubicaciones.get(usuarioId) ?? null;
  }

  /**
   * Obtiene una vista pública sin exponer los asientos internos.
   * @param mesaId - Mesa configurada.
   * @returns Copia pública; modificarla no altera asientos del servidor.
   * @throws ErrorJuego MESA_NO_EXISTE.
   */
  snapshot(mesaId: string): MesaEstado {
    return this.obtener(mesaId).snapshot();
  }

  /**
   * Asigna el primer asiento libre; otra conexión del mismo usuario toma su asiento.
   * @param mesaId - Mesa de destino.
   * @param usuario - Identidad proveniente de la sesión SQL.
   * @param equipado - Cosméticos de la sesión, nunca del mensaje de entrada.
   * @param conexionId - Identificador único del socket propietario.
   * @returns Snapshot autoritativo para la respuesta directa.
   * @throws ErrorJuego MESA_NO_EXISTE | YA_EN_OTRA_MESA | MESA_LLENA.
   */
  unirse(mesaId: string, usuario: UsuarioVista, equipado: Equipado, conexionId: string): MesaEstado {
    const mesa = this.obtener(mesaId);
    const actual = this.mesaDeUsuario(usuario.id);
    if (actual !== null && actual !== mesaId) throw new ErrorJuego("YA_EN_OTRA_MESA");
    const snapshot = mesa.unirse(usuario, equipado);
    this.ubicaciones.set(usuario.id, mesaId);
    const anterior = this.propietarios.get(usuario.id);
    // El gestor decide la transferencia; el transporte retira la conexión anterior.
    this.propietarios.set(usuario.id, conexionId);
    if (anterior !== undefined && anterior !== conexionId) this.alReemplazar(anterior);
    return snapshot;
  }

  /**
   * Retira el asiento del propietario cuando el motor permite liberarlo.
   * @param usuarioId - Usuario que solicita salir.
   * @param conexionId - Debe ser la conexión dueña, no una pestaña espectadora.
   * @returns Mesa de origen; conserva una apuesta activa hasta finalizar PAGOS.
   * @throws ErrorJuego NO_ESTAS_EN_MESA.
   */
  salir(usuarioId: number, conexionId: string): string {
    const mesa = this.mesaDelPropietario(usuarioId, conexionId);
    mesa.salir(usuarioId);
    this.propietarios.delete(usuarioId);
    return mesa.id;
  }

  /**
   * Libera únicamente el asiento que aún pertenece al socket cerrado.
   * @param usuarioId - Identidad del socket antes de borrar su sesión.
   * @param conexionId - Identificador único; un cierre tardío no afecta al nuevo dueño.
   * @returns Sin efecto para espectadores o usuarios sin asiento.
   */
  desconectar(usuarioId: number, conexionId: string): void {
    const mesaId = this.mesaDeUsuario(usuarioId);
    if (mesaId !== null && this.propietarios.get(usuarioId) === conexionId) this.salir(usuarioId, conexionId);
  }

  /**
   * Obtiene el motor para los pasos internos del servidor.
   * @param mesaId - Mesa configurada.
   * @returns Motor para los pasos internos del servidor; nunca se envía al cliente.
   * @throws ErrorJuego MESA_NO_EXISTE.
   */
  obtener(mesaId: string): Mesa {
    const mesa = this.mesas.get(mesaId);
    if (!mesa) throw new ErrorJuego("MESA_NO_EXISTE");
    return mesa;
  }

  /**
   * Comprueba la conexión propietaria antes de aceptar intenciones de juego.
   * @param usuarioId - Identidad autenticada.
   * @param conexionId - Debe ser el propietario, no una pestaña espectadora.
   * @returns Motor de su asiento para que T-20 valide y ejecute las acciones.
   * @throws ErrorJuego NO_ESTAS_EN_MESA.
   */
  mesaDelPropietario(usuarioId: number, conexionId: string): Mesa {
    const mesaId = this.mesaDeUsuario(usuarioId);
    if (mesaId === null || this.propietarios.get(usuarioId) !== conexionId) throw new ErrorJuego("NO_ESTAS_EN_MESA");
    return this.obtener(mesaId);
  }

  private sincronizarUbicaciones(): void {
    // El motor libera salidas al terminar PAGOS; limpiar también el índice del gestor.
    for (const [usuarioId, mesaId] of this.ubicaciones) {
      if (!this.obtener(mesaId).contiene(usuarioId)) {
        this.ubicaciones.delete(usuarioId);
        this.propietarios.delete(usuarioId);
      }
    }
  }
}
