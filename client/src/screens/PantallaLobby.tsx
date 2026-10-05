/**
 * Lobby: mesas disponibles con su ocupación en vivo (topic `lobby`), billetera y cierre de sesión.
 * Base de T-13.
 */
import { useEffect, type ReactNode } from "react";
import { PanelBilletera } from "../components/PanelBilletera";
import { useJuego } from "../state/store";

/** Props del lobby. */
interface PropsPantallaLobby {
  /** Abre el historial de movimientos. */
  alVerHistorial: () => void;
}

/**
 * Lista de mesas y panel de billetera.
 * @param props - Navegación al historial.
 * @returns Pantalla del lobby.
 */
export function PantallaLobby({ alVerHistorial }: PropsPantallaLobby): ReactNode {
  const { estado, acciones } = useJuego();
  const conectado = estado.conexion === "conectado";

  useEffect(() => {
    // Se pide al entrar y tras cada reconexión, porque mientras no hubo conexión se perdieron publicaciones.
    if (!conectado) return;
    void acciones.listarLobby();
    void acciones.consultarBilletera();
  }, [acciones, conectado]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Hola, {estado.sesion?.usuario.usuario}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={alVerHistorial} className="rounded border border-emerald-600 px-3 py-1">
            Historial
          </button>
          <button
            type="button"
            disabled={estado.pendientes.includes("logout")}
            onClick={() => void acciones.cerrarSesion()}
            className="rounded border border-emerald-600 px-3 py-1 disabled:opacity-50"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Mesas</h2>
        {estado.lobby.length === 0 && <p className="text-emerald-300">Cargando mesas…</p>}
        <ul className="grid gap-3 sm:grid-cols-3">
          {estado.lobby.map((mesa) => {
            const llena = mesa.ocupados >= mesa.capacidad;
            return (
              <li key={mesa.id} className="flex flex-col gap-2 rounded bg-emerald-900/60 p-4">
                <span className="font-semibold">{mesa.nombre}</span>
                <span className="text-sm">
                  {mesa.ocupados}/{mesa.capacidad} jugadores · {mesa.fase}
                </span>
                <button
                  type="button"
                  disabled={llena || !conectado || estado.pendientes.includes("mesa.unirse")}
                  onClick={() => void acciones.unirseAMesa(mesa.id)}
                  className="rounded bg-amber-400 py-1 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {llena ? "Llena" : "Unirse"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <PanelBilletera />
    </main>
  );
}
