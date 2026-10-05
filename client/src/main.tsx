/**
 * Punto de entrada del cliente: crea el estado global con la conexión real y monta la app.
 * El proveedor va FUERA del límite de errores para que un fallo de renderizado
 * no cierre la conexión ni pierda el estado. Si falta `#raiz`, se lanza un error explícito.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LimiteErrores } from "./components/LimiteErrores";
import { urlWebSocket } from "./config";
import { Conexion } from "./net/conexion";
import { ProveedorJuego } from "./state/store";
import "./estilos.css";

const contenedor = document.getElementById("raiz");
if (contenedor === null) throw new Error("No existe el elemento #raiz en index.html");

createRoot(contenedor).render(
  <StrictMode>
    <ProveedorJuego crearTransporte={() => new Conexion({ url: urlWebSocket(window.location) })}>
      <LimiteErrores>
        <App />
      </LimiteErrores>
    </ProveedorJuego>
  </StrictMode>,
);
