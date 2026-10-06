/** Fixtures aislados de PostgreSQL y clientes WebSocket reales para el Hito 1. */
import { SQL } from "bun";
import { MensajeServidorSchema, type EntradaMensajeCliente, type MensajeServidor } from "@blackjack/shared";

/**
 * Crea exclusivamente un schema aleatorio; no reinicia datos del usuario.
 * @param destino - TEST_DATABASE_URL de PostgreSQL.
 * @returns Pool aislado y cierre que elimina solo el schema creado por esta prueba.
 * @throws Propaga fallos de conexión o de aplicación del esquema.
 */
export async function crearBasePruebas(destino: string) {
  const schema = `hito1_${crypto.randomUUID().replaceAll("-", "")}`;
  const admin = new SQL(destino);
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  const conexion = new SQL(destino, { max: 12, connection: { search_path: schema }, prepare: false });
  const cerrar = async () => {
    await conexion.close();
    await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  };
  try {
    await conexion.unsafe(await Bun.file(new URL("../db/schema.sql", import.meta.url)).text());
    await conexion.unsafe(await Bun.file(new URL("../db/seed.sql", import.meta.url)).text());
    return { conexion, cerrar };
  } catch (error) {
    await cerrar();
    throw error;
  }
}

/** Cliente real que conserva publicaciones y correlaciona las respuestas por reqId. */
export class ClienteWsPrueba {
  readonly mensajes: MensajeServidor[] = [];
  private readonly observadores = new Set<() => void>();
  private constructor(readonly socket: WebSocket) {
    socket.addEventListener("message", (evento) => {
      this.mensajes.push(MensajeServidorSchema.parse(JSON.parse(String(evento.data))));
      for (const observar of this.observadores) observar();
    });
  }

  /**
   * @param url - Endpoint real de pruebas.
   * @returns Cliente abierto con observadores instalados antes de la bienvenida.
   * @throws Error Si el socket no abre en un segundo.
   */
  static async conectar(url: string): Promise<ClienteWsPrueba> {
    const socket = new WebSocket(url);
    const cliente = new ClienteWsPrueba(socket);
    await new Promise<void>((resolver, rechazar) => {
      const reloj = setTimeout(() => rechazar(new Error("El socket no abrió")), 900);
      socket.addEventListener("open", () => { clearTimeout(reloj); resolver(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(reloj); rechazar(new Error("Falló el socket")); }, { once: true });
    });
    return cliente;
  }

  /**
   * @param entrada - Intención compartida; cada envío tiene un reqId independiente.
   * @returns Respuesta directa, incluyendo errores de dominio.
   * @throws Error Si no hay respuesta en el plazo del cliente real.
   */
  enviar(entrada: EntradaMensajeCliente): Promise<MensajeServidor> {
    const reqId = entrada.reqId ?? crypto.randomUUID();
    const respuesta = this.esperar((mensaje) => mensaje.reqId === reqId, this.mensajes.length, 8000);
    this.socket.send(JSON.stringify({ ...entrada, reqId }));
    return respuesta;
  }

  /**
   * @param predicado - Respuesta o publicación requerida.
   * @param desde - Índice de inicio, para no reutilizar publicaciones anteriores.
   * @param timeout - Plazo; por defecto menor de un segundo.
   * @returns Primer mensaje que cumple el predicado.
   * @throws Error Si no llega a tiempo.
   */
  esperar(predicado: (mensaje: MensajeServidor) => boolean, desde = 0, timeout = 900): Promise<MensajeServidor> {
    return new Promise((resolver, rechazar) => {
      const reloj = setTimeout(() => {
        this.observadores.delete(observar);
        rechazar(new Error("No llegó el mensaje esperado"));
      }, timeout);
      const observar = () => {
        const mensaje = this.mensajes.slice(desde).find(predicado);
        if (!mensaje) return;
        clearTimeout(reloj);
        this.observadores.delete(observar);
        resolver(mensaje);
      };
      this.observadores.add(observar);
      observar();
    });
  }

  /** @returns Confirmación de cierre del socket. */
  async cerrar(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolver) => {
      this.socket.addEventListener("close", () => resolver(), { once: true });
      this.socket.close();
    });
  }
}
