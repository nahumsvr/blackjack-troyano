/** Cliente aislado de T-38: reproduce el navegador por HTTP sin crypto.randomUUID. */
import { TIMEOUT_PETICION_MS, urlWebSocket } from "../src/config";
import { Conexion } from "../src/net/conexion";
import { ControladorJuego } from "../src/state/controlador";
import { ESTADO_INICIAL, reducir, type EstadoJuego } from "../src/state/reductor";
import { LIMITES_CANTIDAD } from "@blackjack/shared";

// Solo se altera este proceso cliente: el servidor conserva su Crypto normal.
Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
const pagina = new URL(Bun.argv[2]!);
const modelo: { estado: EstadoJuego } = { estado: ESTADO_INICIAL };
let token: string | null = null;
const controlador = new ControladorJuego(new Conexion({ url: urlWebSocket(pagina) }),
  (evento) => { modelo.estado = reducir(modelo.estado, evento); },
  { leer: () => token, guardar: (valor) => { token = valor; }, borrar: () => { token = null; } },
  { programar: () => null });
try {
  controlador.iniciar();
  const hasta = performance.now() + TIMEOUT_PETICION_MS;
  while (modelo.estado.conexion !== "conectado") {
    if (performance.now() >= hasta) throw new Error("El cliente LAN no conectó.");
    await Bun.sleep(10);
  }
  if (!await controlador.registrar("lan38_http", "secreto38")) {
    throw new Error(modelo.estado.avisos.at(-1)?.texto ?? "El registro LAN falló.");
  }
  if (!await controlador.comprarFichas(LIMITES_CANTIDAD.compraMin) || !await controlador.comprarFichas(LIMITES_CANTIDAD.compraMin)
    || !await controlador.listarLobby()) throw new Error("Las intenciones LAN fallaron.");
  console.info(JSON.stringify({ conexion: modelo.estado.conexion, usuario: modelo.estado.sesion?.usuario.usuario,
    fichas: modelo.estado.billetera?.fichas, dinero: modelo.estado.billetera?.dinero,
    mesas: modelo.estado.lobby.length, errores: modelo.estado.avisos.filter((aviso) => aviso.nivel === "error").length }));
} finally { controlador.detener(); }
