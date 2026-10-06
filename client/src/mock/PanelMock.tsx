/**
 * Barra superior del modo mock (`?mock=1`): permite recorrer las 6 fases de la mesa, forzar
 * cada resultado de la ronda (para ver sus animaciones) y simular una caída de red sin servidor.
 * No se muestra fuera del modo mock.
 */
import { FaseMesaSchema, ResultadoSchema } from "@blackjack/shared";
import { useState, type ReactNode } from "react";
import type { ServidorFalso } from "./servidorFalso";

/** Duración de la caída simulada, en ms. */
const CAIDA_MS = 3000;

/** Props del panel. */
interface PropsPanelMock {
  /** Servidor falso que controla el panel. */
  servidor: ServidorFalso;
}

/**
 * Controles del mock.
 * @param props - Servidor falso.
 * @returns Barra de controles (en el flujo normal, para no tapar la UI).
 */
export function PanelMock({ servidor }: PropsPanelMock): ReactNode {
  const [fase, setFase] = useState(servidor.faseActual);
  return (
    <aside className="flex flex-wrap items-center gap-1 bg-fuchsia-900 px-2 py-1 text-xs">
      <span className="font-bold">MOCK</span>
      {FaseMesaSchema.options.map((opcion) => (
        <button
          key={opcion}
          type="button"
          onClick={() => {
            servidor.irAFase(opcion);
            setFase(opcion);
          }}
          className={`rounded px-2 py-0.5 ${fase === opcion ? "bg-fuchsia-500" : "bg-fuchsia-800 hover:bg-fuchsia-700"}`}
        >
          {opcion}
        </button>
      ))}
      <span className="ml-2 font-bold">Resultado:</span>
      {ResultadoSchema.options.map((resultado) => (
        <button
          key={resultado}
          type="button"
          onClick={() => {
            servidor.simularResultado(resultado);
            setFase("PAGOS");
          }}
          className="rounded bg-fuchsia-800 px-2 py-0.5 hover:bg-fuchsia-700"
        >
          {resultado}
        </button>
      ))}
      <button type="button" onClick={() => servidor.simularCaida(CAIDA_MS)} className="ml-2 rounded bg-red-800 px-2 py-0.5">
        Simular caída
      </button>
    </aside>
  );
}
