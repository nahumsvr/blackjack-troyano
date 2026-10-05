/**
 * Punto de entrada del cliente: monta React dentro del límite de errores raíz.
 * Si falta el contenedor `#raiz` (index.html alterado), se lanza un error explícito.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LimiteErrores } from "./components/LimiteErrores";
import "./estilos.css";

const contenedor = document.getElementById("raiz");
if (contenedor === null) throw new Error("No existe el elemento #raiz en index.html");

createRoot(contenedor).render(
  <StrictMode>
    <LimiteErrores>
      <App />
    </LimiteErrores>
  </StrictMode>,
);
