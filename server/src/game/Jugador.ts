/** Jugador sentado; separa su mano interna de los datos públicos enviados al cliente. */
import type { Asiento, Equipado, EstadoJugador, UsuarioVista } from "@blackjack/shared";
import { Mano } from "./Mano";

/** Estado en memoria de un asiento; el saldo permanece fuera del motor de juego. */
export class Jugador {
  mano = new Mano();
  apuesta = 0;
  conectado = true;
  desconectadoDesde: number | null = null;
  salidaPendiente = false;
  estado: EstadoJugador = "ESPERANDO_RONDA";
  private readonly usuario: UsuarioVista;
  private readonly equipado: Equipado;

  /**
   * Crea un asiento con identidad y cosméticos confirmados por el servidor.
   * @param indice - Posición del asiento en el contrato.
   * @param usuario - Identidad autenticada del servidor.
   * @param equipado - Cosméticos obtenidos por el servidor.
   * @returns Jugador sin apuesta ni cartas, pendiente de la próxima ronda.
   */
  constructor(readonly indice: Asiento["indice"], usuario: UsuarioVista, equipado: Equipado) {
    this.usuario = { ...usuario };
    this.equipado = { ...equipado };
  }

  /** @returns Identidad estable para ordenar turnos y localizar el asiento. */
  get usuarioId(): number { return this.usuario.id; }

  /** Limpia la mano y apuesta al abrir la siguiente ronda. @returns Sin valor. */
  reiniciarRonda(): void {
    this.mano = new Mano();
    this.apuesta = 0;
    this.estado = "SIN_APUESTA";
  }

  /**
   * Refresca los cosméticos del servidor al retomar el asiento.
   * @param equipado - Equipamiento confirmado por la sesión.
   * @returns true si cambió algún cosmético visible para la mesa.
   */
  actualizarEquipado(equipado: Equipado): boolean {
    const cambiado = this.equipado.avatar !== equipado.avatar || this.equipado.reverso !== equipado.reverso;
    Object.assign(this.equipado, equipado);
    return cambiado;
  }

  /** @returns Vista nueva; nunca entrega Mano ni arreglos internos al transporte. */
  snapshot(): Asiento {
    return {
      indice: this.indice, usuarioId: this.usuario.id, usuario: this.usuario.usuario,
      avatar: this.equipado.avatar, reverso: this.equipado.reverso, conectado: this.conectado,
      apuesta: this.apuesta, cartas: this.mano.cartas.map((carta) => carta.aVista()),
      total: this.mano.total(), estado: this.estado,
    };
  }
}
