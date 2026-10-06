/**
 * Indicador del estado de la conexión propia (conectado / reconectando / sin conexión).
 * Versión básica de T-12; T-42 agrega el detalle de jugadores desconectados en la mesa.
 */
import type { ReactNode } from "react";
import type { EstadoConexion } from "../net/transporte";
import { useJuego } from "../state/store";

/** Texto y color de cada estado. */
const PRESENTACION: Record<EstadoConexion, { texto: string; color: string }> = {
  conectando: { texto: "Conectando…", color: "bg-amber-500" },
  conectado: { texto: "Conectado", color: "bg-emerald-500" },
  reconectando: { texto: "Reconectando…", color: "bg-amber-500" },
  cerrado: { texto: "Sin conexión", color: "bg-red-600" },
};

/**
 * Punto de color con el estado de la conexión.
 * @returns Indicador accesible.
 */
export function IndicadorConexion(): ReactNode {
  const { estado } = useJuego();
  const { texto, color } = PRESENTACION[estado.conexion];
  return (
    <span role="status" className="flex items-center gap-2 text-sm">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
      {texto}
    </span>
  );
}
