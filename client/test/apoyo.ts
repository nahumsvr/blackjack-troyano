/**
 * Utilidades de prueba del cliente: mensajes válidos según el contrato de `shared`,
 * un WebSocket falso, un planificador de temporizadores manual y un transporte falso.
 */
import type { BilleteraEstado, MensajeServidor, MesaEstado } from "@blackjack/shared";
import type { SocketMinimo } from "../src/net/conexion";
import { errorLocal } from "../src/net/erroresLocales";
import type { EstadoConexion, EventoTransporte, Intencion, OyenteTransporte, Transporte } from "../src/net/transporte";

export const TOKEN = "a1".repeat(32);

export const BILLETERA: BilleteraEstado = {
  dinero: 10000,
  fichas: 500,
  compradoHoy: 0,
  disponibleHoy: 5000,
  limiteDiario: 5000,
  reinicioEn: "2026-10-06T06:00:00.000Z",
};

export const SESION: Extract<MensajeServidor, { type: "sesion" }> = {
  type: "sesion",
  token: TOKEN,
  usuario: { id: 1, usuario: "nahum" },
  billetera: BILLETERA,
  equipado: { avatar: "avatar_basico", reverso: "reverso_clasico", tema: "tema_verde" },
  mesaId: null,
};

/**
 * Snapshot de mesa válido con un jugador sentado en el asiento 0.
 * @param fase - Fase de la mesa.
 * @returns Mesa lista para usar en pruebas.
 */
export function mesa(fase: MesaEstado["fase"]): MesaEstado {
  return {
    id: "mesa-1",
    nombre: "Mesa 1",
    fase,
    finEn: 1_000_000,
    turnoDe: null,
    dealer: { cartas: [], total: null },
    asientos: [
      {
        indice: 0,
        usuarioId: 1,
        usuario: "nahum",
        avatar: "avatar_basico",
        reverso: "reverso_clasico",
        conectado: true,
        apuesta: 0,
        cartas: [],
        total: 0,
        estado: "SIN_APUESTA",
      },
      null,
      null,
      null,
      null,
    ],
  };
}

/** Planificador manual: guarda las funciones programadas y las ejecuta a demanda. */
export class RelojManual {
  private siguiente = 1;
  readonly tareas = new Map<number, { funcion: () => void; ms: number }>();

  programar = (funcion: () => void, ms: number): unknown => {
    const id = this.siguiente++;
    this.tareas.set(id, { funcion, ms });
    return id;
  };

  cancelar = (id: unknown): void => {
    this.tareas.delete(id as number);
  };

  /** @returns Esperas (ms) de las tareas pendientes, en orden de creación. */
  esperas(): number[] {
    return [...this.tareas.values()].map((tarea) => tarea.ms);
  }

  /** Ejecuta y elimina todas las tareas pendientes en este momento. */
  ejecutarTodo(): void {
    const actuales = [...this.tareas.entries()];
    for (const [id, tarea] of actuales) {
      this.tareas.delete(id);
      tarea.funcion();
    }
  }
}

/** WebSocket falso controlado por la prueba. */
export class SocketFalso implements SocketMinimo {
  readyState = 0;
  enviados: string[] = [];
  onopen: ((evento: Event) => void) | null = null;
  onclose: ((evento: CloseEvent) => void) | null = null;
  onerror: ((evento: Event) => void) | null = null;
  onmessage: ((evento: MessageEvent) => void) | null = null;

  send(datos: string): void {
    this.enviados.push(datos);
  }

  close(): void {
    this.readyState = 3;
  }

  /** Simula que el servidor aceptó la conexión. */
  abrir(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  /** Simula que la conexión se cayó. */
  caer(): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close"));
  }

  /**
   * Simula un frame del servidor.
   * @param datos - Objeto (se serializa) o texto crudo.
   */
  recibir(datos: unknown): void {
    const texto = typeof datos === "string" ? datos : JSON.stringify(datos);
    this.onmessage?.(new MessageEvent("message", { data: texto }));
  }

  /** @returns El último mensaje enviado, ya parseado. */
  ultimo(): Record<string, unknown> {
    const texto = this.enviados.at(-1);
    if (texto === undefined) throw new Error("No se ha enviado nada");
    return JSON.parse(texto) as Record<string, unknown>;
  }
}

/** Respuesta programada del transporte falso para una intención. */
type Responder = (intencion: Intencion) => MensajeServidor | Error;

/** Transporte falso para probar el controlador sin sockets. */
export class TransporteFalso implements Transporte {
  enviadas: Intencion[] = [];
  conectado = false;
  private readonly oyentes = new Set<OyenteTransporte>();

  /** @param responder - Decide qué responde (o con qué error falla) cada intención. */
  constructor(public responder: Responder = () => ({ type: "ok" })) {}

  conectar(): void {
    this.conectado = true;
  }

  cerrar(): void {
    this.conectado = false;
  }

  async enviar(intencion: Intencion): Promise<MensajeServidor> {
    this.enviadas.push(intencion);
    if (!this.conectado) throw errorLocal("SIN_CONEXION");
    const respuesta = this.responder(intencion);
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  }

  suscribir(oyente: OyenteTransporte): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  /** @param evento - Evento a notificar a los oyentes. */
  emitir(evento: EventoTransporte): void {
    for (const oyente of this.oyentes) oyente(evento);
  }

  /** @param estado - Nuevo estado de conexión a notificar. */
  cambiarEstado(estado: EstadoConexion): void {
    this.emitir({ tipo: "conexion", estado });
  }
}

/** Espera a que se resuelvan las promesas encoladas. */
export async function vaciarPromesas(): Promise<void> {
  for (let vuelta = 0; vuelta < 5; vuelta++) await Promise.resolve();
}
