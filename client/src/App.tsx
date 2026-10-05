/**
 * Componente raíz de la interfaz. Elige qué mostrar a partir del estado global.
 * Provisional (T-11): solo muestra el estado de la conexión y de la sesión;
 * las pantallas de acceso, lobby y mesa llegan en T-12, T-13 y T-28.
 */
import type { ReactNode } from "react";
import type { EstadoConexion } from "./net/transporte";
import { useJuego } from "./state/store";

/** Texto visible de cada estado de conexión. */
const TEXTO_CONEXION: Record<EstadoConexion, string> = {
  conectando: "Conectando…",
  conectado: "Conectado",
  reconectando: "Reconectando…",
  cerrado: "Sin conexión",
};

/**
 * Pantalla provisional con el estado de la conexión.
 * @returns Elemento raíz de la app.
 */
export function App(): ReactNode {
  const { estado } = useJuego();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-3xl font-bold">Blackjack</h1>
      <p data-prueba="conexion">{TEXTO_CONEXION[estado.conexion]}</p>
      {estado.conectados !== null && <p>Conectados: {estado.conectados}</p>}
      <p>{estado.sesion === null ? "Sin sesión" : `Sesión de ${estado.sesion.usuario.usuario}`}</p>
      <ul className="fixed right-4 bottom-4 flex flex-col gap-2">
        {estado.avisos.map((aviso) => (
          <li key={aviso.id} className="rounded bg-red-700 px-3 py-2 text-sm">
            {aviso.texto}
          </li>
        ))}
      </ul>
    </main>
  );
}
