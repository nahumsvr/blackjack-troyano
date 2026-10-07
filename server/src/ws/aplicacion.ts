/** Compone autenticación, economía y partidas sobre transporte y contrato compartidos. */
import type { SQL, Server } from "bun";
import { ErrorJuego, type MensajeServidor } from "@blackjack/shared";
import { Sesiones } from "../auth/Sesiones";
import { crearEnrutadorAutenticado } from "../auth/manejadores";
import { PUERTO, topicMesa, topicUsuario } from "../config";
import { GestorMesas, type FabricaMesa } from "../game/GestorMesas";
import type { Billetera } from "../game/Billetera";
import { BilleteraSQL } from "../store/BilleteraSQL";
import { Tienda } from "../store/Tienda";
import { crearManejadoresEconomia } from "../store/manejadores";
import type { DatosConexion, SocketConexion } from "./Enrutador";
import { iniciarServidor } from "./servidor";
import { crearManejadoresJuego } from "./juego";
import { HistorialSQL } from "../db/HistorialSQL";

/**
 * Compone sesiones persistentes, economía y juego sobre el transporte compartido.
 * El stop del servidor devuelve una promesa: esperar su fin antes de cerrar SQL
 * permite intentar completar pagos e historial. Cada mesa realiza un único intento
 * de cierre; cualquier fallo SQL, incluso transitorio, rechaza esa promesa.
 * @param conexion - Pool SQL persistente que el llamador debe cerrar al apagar.
 * @param puerto - Puerto público; cero asigna uno libre para las pruebas.
 * @param crearMesa - Fábrica interna de pruebas; producción usa el zapato criptográfico.
 * @returns Servidor de partidas con publicaciones nativas Bun y cierre ordenado.
 * @throws Error Si el puerto no está disponible; los errores de dominio se responden por WS.
 */
export function iniciarAplicacion(conexion: SQL, puerto = PUERTO, crearMesa?: FabricaMesa): Server<DatosConexion> {
  let servidor: Server<DatosConexion>;
  let cerrando = false;
  const conexiones = new Map<string, SocketConexion>();
  const billetera = new BilleteraSQL(conexion);
  const historial = new HistorialSQL(conexion);
  const publicar = (topic: string, mensaje: MensajeServidor) => cerrando ? 0 : servidor.publish(topic, JSON.stringify(mensaje));
  const economia = crearManejadoresEconomia(billetera, new Tienda(conexion), publicar);
  function operarJuego(operacion: "debitarApuesta" | "acreditarPago" | "comprarFichas", usuarioId: number, cantidad: number, referencia: string) {
    return economia.serializarUsuario(usuarioId, async () => {
      const estado = await billetera[operacion](usuarioId, cantidad, referencia);
      // La cola cubre también publicar: una compra concurrente no puede adelantar este saldo.
      publicar(topicUsuario(usuarioId), { type: "billetera", ...estado });
      return estado;
    });
  }
  const billeteraJuego: Billetera = {
    consultar: (usuarioId) => economia.serializarUsuario(usuarioId, () => billetera.consultar(usuarioId)),
    comprarFichas: (usuarioId, cantidad, clave) => operarJuego("comprarFichas", usuarioId, cantidad, clave),
    debitarApuesta: (usuarioId, cantidad, rondaId) => operarJuego("debitarApuesta", usuarioId, cantidad, rondaId),
    acreditarPago: (usuarioId, cantidad, rondaId) => operarJuego("acreditarPago", usuarioId, cantidad, rondaId),
  };
  const gestor = new GestorMesas(publicar, (conexionId) => {
    const anterior = conexiones.get(conexionId);
    if (!anterior) return;
    // PLAN §7.5: perder la propiedad no retira la vista ni sus snapshots.
    anterior.send(JSON.stringify({ type: "error", codigo: "NO_ESTAS_EN_MESA", mensaje: "Otra pestaña tomó tu asiento; ahora solo miras la mesa." }));
  }, {
    billetera: billeteraJuego,
    guardarRonda: (ronda) => historial.guardar(ronda),
    publicarResultado: (mensaje) => {
      const mesa = gestor.listar().find(({ id }) => gestor.obtener(id).rondaId === mensaje.rondaId);
      if (mesa) publicar(topicMesa(mesa.id), mensaje);
    },
  }, crearMesa);
  function desuscribirMesa(socket: SocketConexion): void {
    if (socket.data.mesaId !== undefined) socket.unsubscribe(topicMesa(socket.data.mesaId));
    delete socket.data.mesaId;
  }
  function suscribirMesa(socket: SocketConexion, mesaId: string): void {
    desuscribirMesa(socket);
    socket.subscribe(topicMesa(mesaId));
    socket.data.mesaId = mesaId;
  }
  function limpiarMesa(socket: SocketConexion, motivo: "desconexion" | "sesion"): void {
    conexiones.delete(socket.data.conexionId!);
    desuscribirMesa(socket);
    if (socket.data.usuarioId === undefined) return;
    gestor.desconectar(socket.data.usuarioId, socket.data.conexionId!, motivo === "desconexion");
  }
  const enrutador = crearEnrutadorAutenticado(new Sesiones(conexion), {
    ...crearManejadoresJuego(gestor),
    ...economia,
    "lobby.listar": () => ({ type: "lobby", mesas: gestor.listar() }),
    "mesa.unirse": (socket, mensaje) => {
      const { usuario, equipado, conexionId } = socket.data;
      if (!usuario || !equipado || !conexionId) throw new ErrorJuego("NO_AUTENTICADO");
      const snapshot = gestor.unirse(mensaje.mesaId, usuario, equipado, conexionId);
      suscribirMesa(socket, mensaje.mesaId);
      return { type: "mesa.estado", ...snapshot };
    },
    "mesa.salir": (socket) => {
      try {
        gestor.salir(socket.data.usuarioId!, socket.data.conexionId!);
      } catch (error) {
        // Una espectadora puede dejar su vista sin liberar el asiento de la dueña,
        // incluso cuando esta ya salió. mesaId identifica la suscripción, no la propiedad.
        if (!(error instanceof ErrorJuego) || error.codigo !== "NO_ESTAS_EN_MESA" || socket.data.mesaId === undefined) throw error;
      }
      desuscribirMesa(socket);
      return { type: "ok" };
    },
  }, {
    mesaDeUsuario: (usuarioId) => gestor.mesaDeUsuario(usuarioId),
    alAutenticar: (socket, sesion) => {
      conexiones.set(socket.data.conexionId!, socket);
      const mesaId = gestor.mesaDeUsuario(sesion.usuario.id);
      if (mesaId === null) return;
      const snapshot = gestor.unirse(mesaId, sesion.usuario, sesion.equipado, socket.data.conexionId!);
      suscribirMesa(socket, mesaId);
      socket.send(JSON.stringify({ type: "mesa.estado", ...snapshot }));
    },
    alCerrar: limpiarMesa,
  });
  servidor = iniciarServidor(puerto, enrutador, (socket) => limpiarMesa(socket, "desconexion"));
  const detenerTransporte = servidor.stop.bind(servidor);
  servidor.stop = async (cerrarConexiones) => {
    cerrando = true;
    gestor.detener();
    await detenerTransporte(cerrarConexiones);
    await gestor.cerrar();
  };
  return servidor;
}
