/**
 * T-11: criterio de "hecho" con piezas reales. El cliente (`Conexion` + `ControladorJuego` + reductor)
 * habla por un WebSocket de verdad con el servidor autenticado sobre PostgreSQL; se apaga el servidor
 * y se vuelve a levantar en el mismo puerto sin recargar nada. Se omite sin `TEST_DATABASE_URL`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { Sesiones } from "../../server/src/auth/Sesiones";
import { crearEnrutadorAutenticado } from "../../server/src/auth/manejadores";
import { iniciarServidor } from "../../server/src/ws/servidor";
import type { DatosConexion } from "../../server/src/ws/Enrutador";
import { BilleteraSQL } from "../../server/src/store/BilleteraSQL";
import { crearBasePruebas } from "../../server/test/soporteHito1";
import { crearAlmacenToken } from "../src/net/almacenToken";
import { Conexion } from "../src/net/conexion";
import { ControladorJuego } from "../src/state/controlador";
import { ESTADO_INICIAL, reducir, type EstadoJuego } from "../src/state/reductor";

const destino = process.env.TEST_DATABASE_URL;
/** Esperas cortas para que la prueba no dure segundos; la lógica es la misma que con 1/2/4/8/10 s. */
const ESPERAS_PRUEBA = [40, 80, 120];

/** Almacén en memoria con la forma de `Storage`: sobrevive al "reinicio" como `localStorage` entre cargas. */
function storageFalso(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (indice) => [...datos.keys()][indice] ?? null,
    removeItem: (clave) => { datos.delete(clave); },
    setItem: (clave, valor) => { datos.set(clave, valor); },
  };
}

/**
 * Espera a que se cumpla una condición.
 * @param condicion - Se evalúa cada 10 ms.
 * @param descripcion - Texto del error si vence el plazo.
 * @param plazoMs - Plazo máximo.
 * @throws Error Si la condición no se cumple a tiempo.
 */
async function esperarHasta(condicion: () => boolean, descripcion: string, plazoMs = 4000): Promise<void> {
  const limite = Date.now() + plazoMs;
  while (!condicion()) {
    if (Date.now() > limite) throw new Error(`Tiempo agotado esperando: ${descripcion}`);
    await Bun.sleep(10);
  }
}

(destino ? describe : describe.skip)("T-11: reiniciar el servidor con la app abierta", () => {
  let base: Awaited<ReturnType<typeof crearBasePruebas>>;
  let sesiones: Sesiones;
  let servidor: Server<DatosConexion>;
  let puerto = 0;
  let controlador: ControladorJuego | null = null;
  let estado: EstadoJuego = ESTADO_INICIAL;
  let conexiones: EstadoJuego["conexion"][] = [];
  const nombre = () => `t11_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;

  /** Levanta el servidor real; `p = 0` elige puerto libre la primera vez y luego se reutiliza el mismo. */
  function levantar(p: number): Server<DatosConexion> {
    const billetera = new BilleteraSQL(base.conexion);
    return iniciarServidor(p, crearEnrutadorAutenticado(sesiones, {
      "billetera.consultar": async (socket) => ({ type: "billetera", ...await billetera.consultar(socket.data.usuarioId!) }),
    }));
  }

  /** Abre una "pestaña": conexión, controlador y almacén nuevos, con el estado registrado paso a paso. */
  function abrirApp(almacen = crearAlmacenToken(storageFalso)) {
    estado = ESTADO_INICIAL;
    conexiones = [];
    const conexion = new Conexion({ url: `ws://127.0.0.1:${puerto}/ws`, esperas: ESPERAS_PRUEBA });
    controlador = new ControladorJuego(conexion, (evento) => {
      estado = reducir(estado, evento);
      if (conexiones.at(-1) !== estado.conexion) conexiones.push(estado.conexion);
    }, almacen);
    controlador.iniciar();
    return { controlador, almacen };
  }

  /** Apaga y vuelve a levantar el servidor en el mismo puerto, como un reinicio real. */
  async function reiniciarServidor(): Promise<void> {
    servidor.stop(true);
    await esperarHasta(() => estado.conexion === "reconectando", "estado reconectando");
    servidor = levantar(puerto);
  }

  beforeAll(async () => {
    base = await crearBasePruebas(destino!);
    sesiones = new Sesiones(base.conexion);
    servidor = levantar(0);
    puerto = servidor.port ?? 0;
  });
  afterEach(() => { controlador?.detener(); controlador = null; });
  afterAll(async () => { servidor?.stop(true); if (base) await base.cerrar(); });

  test("muestra reconectando y vuelve solo con la misma sesión, sin recargar ni volver a iniciar sesión", async () => {
    const { controlador: ctrl, almacen } = abrirApp();
    await esperarHasta(() => estado.conexion === "conectado", "conexión inicial");
    expect(await ctrl.registrar(nombre(), "secreto11")).toBe(true);
    const antes = estado.sesion;
    expect(antes).not.toBeNull();
    expect(almacen.leer()).toBe(antes!.token);
    const billeteraAntes = estado.billetera;

    await reiniciarServidor();

    // Vuelve a "conectado" y la sesión se recupera por `reanudar` con el token guardado.
    await esperarHasta(() => estado.conexion === "conectado", "reconexión");
    await esperarHasta(() => estado.sesion !== null && estado.pendientes.length === 0, "reanudar aplicado");
    expect(conexiones).toContain("reconectando");
    expect(conexiones.at(-1)).toBe("conectado");
    expect(estado.sesion?.usuario).toEqual(antes!.usuario);
    expect(estado.sesion?.token).toBe(antes!.token);
    expect(estado.billetera).toEqual(billeteraAntes);
    expect(almacen.leer()).toBe(antes!.token);
    // El estado local no prueba nada por sí solo: una intención protegida solo funciona si el servidor
    // nuevo (que arrancó sin sesiones en sus sockets) recibió `reanudar` de verdad.
    expect(await ctrl.consultarBilletera()).toBe(true);
    expect(estado.avisos).toEqual([]);
  });

  test("si el token ya no existe en el servidor, olvida la sesión y avisa", async () => {
    const { controlador: ctrl, almacen } = abrirApp();
    await esperarHasta(() => estado.conexion === "conectado", "conexión inicial");
    expect(await ctrl.registrar(nombre(), "secreto11")).toBe(true);
    const token = estado.sesion!.token;
    await base.conexion`DELETE FROM sesiones WHERE token = ${token}`;

    await reiniciarServidor();

    await esperarHasta(() => estado.conexion === "conectado" && estado.sesion === null, "sesión olvidada");
    await esperarHasta(() => estado.avisos.length > 0, "aviso de sesión inválida");
    expect(almacen.leer()).toBeNull();
    expect(estado.avisos.at(-1)?.nivel).toBe("error");
  });
});
