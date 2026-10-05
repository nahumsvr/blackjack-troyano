/**
 * Lista de avisos (toasts) en la esquina inferior derecha. Los avisos se ocultan solos
 * (el controlador programa su retiro) o al hacer clic en ellos.
 */
import type { ReactNode } from "react";
import { useJuego } from "../state/store";

/**
 * Muestra los avisos vigentes del estado global.
 * @returns Región accesible con los avisos.
 */
export function Avisos(): ReactNode {
  const { estado, acciones } = useJuego();
  return (
    <ul aria-live="polite" className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {estado.avisos.map((aviso) => (
        <li key={aviso.id}>
          <button
            type="button"
            onClick={() => acciones.quitarAviso(aviso.id)}
            className={`w-full rounded px-3 py-2 text-left text-sm shadow-lg ${aviso.nivel === "error" ? "bg-red-700" : "bg-sky-700"}`}
          >
            {aviso.texto}
          </button>
        </li>
      ))}
    </ul>
  );
}
