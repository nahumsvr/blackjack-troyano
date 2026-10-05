/**
 * Puente entre React y el estado del cliente: crea UNA conexión y UN controlador por pestaña,
 * guarda el estado con `useReducer` y lo expone con el hook `useJuego()`.
 * También convierte las excepciones globales (`error`, `unhandledrejection`) en avisos,
 * para que ningún fallo pase desapercibido ni deje la app colgada.
 */
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import { crearAlmacenToken } from "../net/almacenToken";
import type { Transporte } from "../net/transporte";
import { ControladorJuego } from "./controlador";
import { ESTADO_INICIAL, reducir, type EstadoJuego } from "./reductor";

/** Lo que el hook `useJuego` entrega a los componentes. */
export interface ContextoJuego {
  estado: EstadoJuego;
  acciones: ControladorJuego;
}

const Contexto = createContext<ContextoJuego | null>(null);

/** Props del proveedor del estado. */
interface PropsProveedorJuego {
  /** Crea el transporte (real o mock); se llama una sola vez. */
  crearTransporte: () => Transporte;
  children: ReactNode;
}

/**
 * Provee el estado global y las acciones a toda la app.
 * @param props - Fábrica del transporte e hijos.
 * @returns Proveedor de contexto.
 */
export function ProveedorJuego({ crearTransporte, children }: PropsProveedorJuego): ReactNode {
  const [estado, despachar] = useReducer(reducir, ESTADO_INICIAL);
  // `useState` con inicializador garantiza un solo controlador por pestaña.
  // `despachar` de useReducer es estable entre renders, así que el controlador puede guardarlo.
  const [acciones] = useState(() => new ControladorJuego(crearTransporte(), despachar, crearAlmacenToken()));

  useEffect(() => {
    acciones.iniciar();
    // StrictMode monta, desmonta y vuelve a montar en desarrollo: iniciar/detener son reentrantes.
    return () => acciones.detener();
  }, [acciones]);

  useEffect(() => {
    const alError = (evento: ErrorEvent) => {
      console.error("Error no atrapado:", evento.error ?? evento.message);
      acciones.avisar("error", "Ocurrió un error inesperado en la aplicación.");
    };
    const alRechazo = (evento: PromiseRejectionEvent) => {
      console.error("Promesa rechazada sin atrapar:", evento.reason);
      acciones.avisar("error", "Ocurrió un error inesperado en la aplicación.");
    };
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, [acciones]);

  return <Contexto.Provider value={{ estado, acciones }}>{children}</Contexto.Provider>;
}

/**
 * Hook para leer el estado y disparar acciones.
 * @returns Estado global y controlador.
 * @throws Error Si se usa fuera de `<ProveedorJuego>` (error de programación).
 */
export function useJuego(): ContextoJuego {
  const contexto = useContext(Contexto);
  if (contexto === null) throw new Error("useJuego debe usarse dentro de <ProveedorJuego>");
  return contexto;
}
