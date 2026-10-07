/**
 * Punto de entrada del cliente: elige el transporte (servidor real, o el servidor falso
 * con `?mock=1`), crea el estado global y monta la app. Con `?mock=1&muestrario` monta en su
 * lugar el muestrario de cartas (página de prueba de T-27).
 * El proveedor va FUERA del límite de errores para que un fallo de renderizado
 * no cierre la conexión ni pierda el estado. Si falta `#raiz`, se lanza un error explícito.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LimiteErrores } from "./components/LimiteErrores";
import { urlWebSocket } from "./config";
import { PanelMock } from "./mock/PanelMock";
import { ServidorFalso } from "./mock/servidorFalso";
import { Conexion } from "./net/conexion";
import { PantallaMuestrario } from "./screens/PantallaMuestrario";
import type { Transporte } from "./net/transporte";
import { ProveedorJuego } from "./state/store";
import "./estilos.css";

const contenedor = document.getElementById("raiz");
if (contenedor === null) throw new Error("No existe el elemento #raiz en index.html");

const parametros = new URLSearchParams(window.location.search);
const servidorFalso = parametros.has("mock") ? new ServidorFalso() : null;
// El muestrario es una herramienta del mock: sin `mock` se ignora y se abre la app normal.
const verMuestrario = servidorFalso !== null && parametros.has("muestrario");
const crearTransporte = (): Transporte => servidorFalso ?? new Conexion({ url: urlWebSocket(window.location) });

createRoot(contenedor).render(
  <StrictMode>
    <ProveedorJuego crearTransporte={crearTransporte}>
      <LimiteErrores>
        {servidorFalso !== null && <PanelMock servidor={servidorFalso} />}
        {verMuestrario ? <PantallaMuestrario /> : <App />}
      </LimiteErrores>
    </ProveedorJuego>
  </StrictMode>,
);
