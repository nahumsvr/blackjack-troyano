/**
 * Estado global del cliente y su reductor PURO (sin efectos, sin `Date`, sin red).
 * Todo lo que se dibuja sale de aquí; todo lo que cambia el estado es un `EventoJuego`.
 * Los efectos (enviar, guardar el token, generar ids) los hace `controlador.ts`.
 *
 * Regla: el estado del juego y la billetera solo cambian con mensajes del servidor.
 * El cliente nunca descuenta fichas ni mueve cartas por su cuenta.
 */
import type {
  ArticuloCatalogo,
  BilleteraEstado,
  Equipado,
  InventarioEstado,
  MensajeServidor,
  MesaEstado,
  MesaResumen,
  Movimiento,
  UsuarioVista,
} from "@blackjack/shared";
import { MAX_AVISOS } from "../config";
import type { EstadoConexion, TipoIntencion } from "../net/transporte";

/** Resultado de la última ronda, tal como lo manda el servidor. */
export type ResultadoRonda = Omit<Extract<MensajeServidor, { type: "ronda.resultado" }>, "type" | "reqId">;

/** Sesión activa del usuario. */
export interface SesionCliente {
  token: string;
  usuario: UsuarioVista;
  equipado: Equipado;
}

/** Aviso visible para el usuario (toast). */
export interface Aviso {
  id: number;
  nivel: "error" | "info";
  texto: string;
}

/** Página de historial de movimientos cargada. */
export interface HistorialMovimientos {
  items: Movimiento[];
  hayMas: boolean;
}

/** Estado completo de la interfaz. */
export interface EstadoJuego {
  conexion: EstadoConexion;
  /** Conexiones abiertas al servidor (mensaje `bienvenida`); `null` hasta recibir la primera. */
  conectados: number | null;
  sesion: SesionCliente | null;
  /** Mesa en la que el servidor dice que estamos; `null` si estamos en el lobby. */
  mesaId: string | null;
  billetera: BilleteraEstado | null;
  lobby: MesaResumen[];
  mesa: MesaEstado | null;
  resultado: ResultadoRonda | null;
  movimientos: HistorialMovimientos | null;
  catalogo: ArticuloCatalogo[] | null;
  inventario: InventarioEstado | null;
  /** Desfase estimado del reloj del servidor respecto al local, en ms. */
  desfaseMs: number;
  /** Acciones enviadas que esperan respuesta; sus botones se deshabilitan. */
  pendientes: TipoIntencion[];
  avisos: Aviso[];
  /** `true` si otra pestaña tomó nuestro asiento: solo miramos la mesa. */
  espectador: boolean;
}

/** Todo lo que puede cambiar el estado. */
export type EventoJuego =
  | { tipo: "conexion"; estado: EstadoConexion }
  | { tipo: "servidor"; mensaje: MensajeServidor }
  | { tipo: "desfase"; ms: number }
  | { tipo: "pendiente"; accion: TipoIntencion; activo: boolean }
  | { tipo: "aviso"; aviso: Aviso }
  | { tipo: "quitarAviso"; id: number }
  | { tipo: "movimientos"; items: Movimiento[]; hayMas: boolean; anexar: boolean }
  | { tipo: "sesionTerminada" }
  | { tipo: "salioDeMesa" }
  | { tipo: "espectador" };

/** Estado al abrir la app. */
export const ESTADO_INICIAL: EstadoJuego = {
  conexion: "cerrado",
  conectados: null,
  sesion: null,
  mesaId: null,
  billetera: null,
  lobby: [],
  mesa: null,
  resultado: null,
  movimientos: null,
  catalogo: null,
  inventario: null,
  desfaseMs: 0,
  pendientes: [],
  avisos: [],
  espectador: false,
};

/**
 * Calcula el estado siguiente. Función pura: mismo estado y evento → mismo resultado.
 * @param estado - Estado actual (no se modifica).
 * @param evento - Evento a aplicar.
 * @returns Estado nuevo (o el mismo objeto si el evento no cambia nada).
 */
export function reducir(estado: EstadoJuego, evento: EventoJuego): EstadoJuego {
  switch (evento.tipo) {
    case "conexion":
      return { ...estado, conexion: evento.estado };
    case "servidor":
      return aplicarMensaje(estado, evento.mensaje);
    case "desfase":
      return { ...estado, desfaseMs: evento.ms };
    case "pendiente": {
      const sinAccion = estado.pendientes.filter((accion) => accion !== evento.accion);
      return { ...estado, pendientes: evento.activo ? [...sinAccion, evento.accion] : sinAccion };
    }
    case "aviso":
      return { ...estado, avisos: [...estado.avisos, evento.aviso].slice(-MAX_AVISOS) };
    case "quitarAviso":
      return { ...estado, avisos: estado.avisos.filter((aviso) => aviso.id !== evento.id) };
    case "movimientos": {
      const previos = evento.anexar && estado.movimientos !== null ? estado.movimientos.items : [];
      return { ...estado, movimientos: { items: [...previos, ...evento.items], hayMas: evento.hayMas } };
    }
    case "sesionTerminada":
      // Se conserva lo que no depende del usuario (conexión, lobby, desfase, avisos).
      return {
        ...ESTADO_INICIAL,
        conexion: estado.conexion,
        conectados: estado.conectados,
        lobby: estado.lobby,
        desfaseMs: estado.desfaseMs,
        avisos: estado.avisos,
      };
    case "salioDeMesa":
      return { ...estado, mesa: null, mesaId: null, resultado: null, espectador: false };
    case "espectador":
      // Solo tiene sentido si estamos viendo una mesa; en el lobby se ignora.
      return estado.mesa === null ? estado : { ...estado, espectador: true };
  }
}

/**
 * Aplica un mensaje del servidor. Los `error` y `movimientos` no se aplican aquí:
 * el controlador los procesa porque necesitan saber qué petición los originó.
 * @param estado - Estado actual.
 * @param mensaje - Mensaje ya validado con Zod.
 * @returns Estado nuevo.
 */
function aplicarMensaje(estado: EstadoJuego, mensaje: MensajeServidor): EstadoJuego {
  switch (mensaje.type) {
    case "bienvenida":
      return { ...estado, conectados: mensaje.conectados };
    case "sesion":
      return {
        ...estado,
        sesion: { token: mensaje.token, usuario: mensaje.usuario, equipado: mensaje.equipado },
        billetera: mensaje.billetera,
        mesaId: mensaje.mesaId,
        mesa: mensaje.mesaId === null ? null : estado.mesa,
        espectador: false,
      };
    case "lobby":
      return { ...estado, lobby: mensaje.mesas };
    case "mesa.estado": {
      const { type: _tipo, reqId: _reqId, ...mesa } = mensaje;
      // El resultado de la ronda anterior se oculta cuando empieza la siguiente fase de apuestas.
      const nuevaRonda = mesa.fase === "APUESTAS" && estado.mesa?.fase !== "APUESTAS";
      return { ...estado, mesa, mesaId: mesa.id, resultado: nuevaRonda ? null : estado.resultado };
    }
    case "ronda.resultado": {
      const { type: _tipo, reqId: _reqId, ...resultado } = mensaje;
      return { ...estado, resultado };
    }
    case "billetera": {
      const { type: _tipo, reqId: _reqId, ...billetera } = mensaje;
      return { ...estado, billetera };
    }
    case "catalogo":
      return { ...estado, catalogo: mensaje.articulos };
    case "inventario": {
      const inventario = { articulos: mensaje.articulos, equipado: mensaje.equipado };
      const sesion = estado.sesion === null ? null : { ...estado.sesion, equipado: mensaje.equipado };
      return { ...estado, inventario, sesion };
    }
    case "movimientos":
    case "error":
    case "ok":
    case "pong":
      return estado;
  }
}
