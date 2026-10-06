/**
 * Componente raíz: decide qué pantalla mostrar a partir del estado global.
 * - Sin sesión → acceso.
 * - Con mesa (el servidor nos sentó) → mesa.
 * - Si no → lobby.
 * La billetera, el historial y la tienda (solo lectura) viven en un menú lateral común, que se
 * abre desde el botón de fichas de cualquier pantalla con sesión; T-39/T-40 agregarán la compra
 * y el inventario.
 */
import { useCallback, useState, type ReactNode } from "react";
import { Avisos } from "./components/Avisos";
import { MenuLateral, type PestanaMenu } from "./components/MenuLateral";
import { PantallaAcceso } from "./screens/PantallaAcceso";
import { PantallaLobby } from "./screens/PantallaLobby";
import { PantallaMesa } from "./screens/PantallaMesa";
import { useJuego } from "./state/store";

/**
 * Pantalla activa más los elementos globales (menú lateral y avisos).
 * @returns Árbol de la app.
 */
export function App(): ReactNode {
  const { estado } = useJuego();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pestana, setPestana] = useState<PestanaMenu>("billetera");

  const abrirMenu = useCallback((destino: PestanaMenu) => {
    setPestana(destino);
    setMenuAbierto(true);
  }, []);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);

  const conSesion = estado.sesion !== null;
  let pantalla: ReactNode;
  if (!conSesion) pantalla = <PantallaAcceso />;
  else if (estado.mesa !== null) pantalla = <PantallaMesa alAbrirMenu={abrirMenu} />;
  else pantalla = <PantallaLobby alAbrirMenu={abrirMenu} />;

  return (
    <>
      {pantalla}
      {/* Sin sesión no hay billetera: el menú se cierra solo si la sesión termina con él abierto. */}
      <MenuLateral abierto={menuAbierto && conSesion} pestana={pestana} alCambiarPestana={setPestana} alCerrar={cerrarMenu} />
      <Avisos />
    </>
  );
}
