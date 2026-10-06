/** Asientos autoritativos del lobby; T-18 incorporará el motor de cada mesa. */
import { ErrorJuego, type Asiento, type Equipado, type MesaEstado, type MesaResumen, type MensajeServidor, type UsuarioVista } from "@blackjack/shared";
import { CAPACIDAD_MESA, MESAS, TOPIC_LOBBY, topicMesa } from "../config";

/** Mantiene un solo asiento por usuario y una sola conexión propietaria del asiento. */
export class GestorMesas {
  private readonly mesas = new Map<string, { nombre: string; asientos: (Asiento | null)[] }>(
    MESAS.map((mesa) => [mesa.id, { nombre: mesa.nombre, asientos: Array<Asiento | null>(CAPACIDAD_MESA).fill(null) }]),
  );
  private readonly ubicaciones = new Map<number, string>();
  private readonly propietarios = new Map<number, string>();

  /**
   * Construye las mesas e informa al transporte cuando otra conexión toma un asiento.
   * @param publicar - Transporte pub/sub; recibe mensajes del contrato sin reqId.
   * @param alReemplazar - Avisa a la conexión anterior; conserva su suscripción como espectadora.
   * @returns Gestor en memoria, sin acceso a SQL o billeteras.
   */
  constructor(private readonly publicar: (topic: string, mensaje: MensajeServidor) => void,
    private readonly alReemplazar: (conexionId: string) => void = () => {}) {}

  /** Resume ocupación y capacidad para el lobby. @returns Copia de las tres mesas. */
  listar(): MesaResumen[] {
    return [...this.mesas].map(([id, mesa]) => ({
      id, nombre: mesa.nombre, ocupados: mesa.asientos.filter((asiento) => asiento !== null).length,
      capacidad: CAPACIDAD_MESA, fase: "ESPERANDO",
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
    const mesa = this.obtener(mesaId);
    return {
      id: mesaId, nombre: mesa.nombre, fase: "ESPERANDO", finEn: null, turnoDe: null,
      dealer: { cartas: [], total: null }, asientos: structuredClone(mesa.asientos),
    };
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
    let cambiado = false;
    if (actual === null) {
      const indice = mesa.asientos.findIndex((asiento) => asiento === null);
      if (indice < 0) throw new ErrorJuego("MESA_LLENA");
      mesa.asientos[indice] = {
        indice: indice as Asiento["indice"], usuarioId: usuario.id, usuario: usuario.usuario,
        avatar: equipado.avatar, reverso: equipado.reverso, conectado: true,
        apuesta: 0, cartas: [], total: 0, estado: "ESPERANDO_RONDA",
      };
      this.ubicaciones.set(usuario.id, mesaId);
      cambiado = true;
    } else {
      const asiento = mesa.asientos.find((asiento) => asiento?.usuarioId === usuario.id)!;
      cambiado = asiento.avatar !== equipado.avatar || asiento.reverso !== equipado.reverso || !asiento.conectado;
      asiento.avatar = equipado.avatar;
      asiento.reverso = equipado.reverso;
      asiento.conectado = true;
    }
    const anterior = this.propietarios.get(usuario.id);
    // El gestor decide la transferencia; el transporte avisa a la espectadora sin retirar su vista.
    this.propietarios.set(usuario.id, conexionId);
    if (anterior !== undefined && anterior !== conexionId) this.alReemplazar(anterior);
    if (cambiado) this.publicarCambios(mesaId, actual === null);
    return this.snapshot(mesaId);
  }

  /**
   * Libera el asiento únicamente cuando la conexión que sale todavía es propietaria.
   * @param usuarioId - Usuario que solicita salir.
   * @param conexionId - Debe ser la conexión dueña, no una pestaña espectadora.
   * @returns Mesa cuyo asiento se liberó.
   * @throws ErrorJuego NO_ESTAS_EN_MESA.
   */
  salir(usuarioId: number, conexionId: string): string {
    const mesaId = this.mesaDeUsuario(usuarioId);
    if (mesaId === null || this.propietarios.get(usuarioId) !== conexionId) throw new ErrorJuego("NO_ESTAS_EN_MESA");
    this.liberar(usuarioId, mesaId);
    return mesaId;
  }

  /**
   * Libera únicamente el asiento que aún pertenece al socket cerrado.
   * @param usuarioId - Identidad del socket antes de borrar su sesión.
   * @param conexionId - Identificador único; un cierre tardío no afecta al nuevo dueño.
   * @returns Sin efecto para espectadores o usuarios sin asiento.
   */
  desconectar(usuarioId: number, conexionId: string): void {
    const mesaId = this.mesaDeUsuario(usuarioId);
    if (mesaId !== null && this.propietarios.get(usuarioId) === conexionId) this.liberar(usuarioId, mesaId);
  }

  private obtener(mesaId: string) {
    const mesa = this.mesas.get(mesaId);
    if (!mesa) throw new ErrorJuego("MESA_NO_EXISTE");
    return mesa;
  }

  private liberar(usuarioId: number, mesaId: string): void {
    const mesa = this.obtener(mesaId);
    const indice = mesa.asientos.findIndex((asiento) => asiento?.usuarioId === usuarioId);
    if (indice >= 0) mesa.asientos[indice] = null;
    this.ubicaciones.delete(usuarioId);
    this.propietarios.delete(usuarioId);
    // Hito 1 no tiene rondas ni apuestas; T-36 añadirá la reserva de reconexión de 60 s.
    this.publicarCambios(mesaId);
  }

  private publicarCambios(mesaId: string, ocupacionCambio = true): void {
    this.publicar(topicMesa(mesaId), { type: "mesa.estado", ...this.snapshot(mesaId) });
    // Transferir propiedad o refrescar cosméticos no cambia el resumen del lobby.
    if (ocupacionCambio) this.publicar(TOPIC_LOBBY, { type: "lobby", mesas: this.listar() });
  }
}
