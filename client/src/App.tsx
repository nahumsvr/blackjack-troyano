/**
 * Componente raíz: decide qué pantalla mostrar a partir del estado global.
 * - Sin sesión → acceso.
 * - Con mesa (el servidor nos sentó) → mesa.
 * - Si no, la vista elegida por el usuario en el lobby (lobby o historial).
 * Las vistas del lobby son una lista para agregar Tienda e Inventario (T-39/T-40) sin reestructurar.
 */
import { useState, type ReactNode } from "react";
import { Avisos } from "./components/Avisos";
import { IndicadorConexion } from "./components/IndicadorConexion";
import { PantallaAcceso } from "./screens/PantallaAcceso";
import { PantallaHistorial } from "./screens/PantallaHistorial";
import { PantallaLobby } from "./screens/PantallaLobby";
import { PantallaMesa } from "./screens/PantallaMesa";
import { useJuego } from "./state/store";

/** Vistas a las que se navega desde el lobby. */
type Vista = "lobby" | "historial";

/**
 * Pantalla activa más los elementos globales (indicador de conexión y avisos).
 * @returns Árbol de la app.
 */
export function App(): ReactNode {
  const { estado } = useJuego();
  const [vista, setVista] = useState<Vista>("lobby");

  let pantalla: ReactNode;
  if (estado.sesion === null) pantalla = <PantallaAcceso />;
  else if (estado.mesa !== null) pantalla = <PantallaMesa />;
  else if (vista === "historial") pantalla = <PantallaHistorial alVolver={() => setVista("lobby")} />;
  else pantalla = <PantallaLobby alVerHistorial={() => setVista("historial")} />;

  return (
    <>
      <div className="fixed bottom-4 left-4 z-40 rounded bg-emerald-950/80 px-2 py-1">
        <IndicadorConexion />
      </div>
      {pantalla}
      <Avisos />
    </>
  );
}
