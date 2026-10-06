/**
 * Menú lateral (cajón que se desliza desde la derecha) con la billetera y el historial.
 * Se abre desde el botón de fichas de cualquier pantalla, también desde la mesa, para comprar
 * fichas o revisar movimientos sin perder de vista la partida (la mesa sigue actualizándose detrás).
 *
 * Accesibilidad: es un diálogo modal; se cierra con Esc, con el botón ✕ o tocando el fondo,
 * y al abrirse el foco pasa al botón de cerrar.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { HistorialMovimientos } from "./HistorialMovimientos";
import { PanelBilletera } from "./PanelBilletera";

/** Pestañas del menú lateral. */
export type PestanaMenu = "billetera" | "historial";

/** Título visible de cada pestaña. */
const TITULO_PESTANA: Record<PestanaMenu, string> = { billetera: "Billetera", historial: "Historial" };

/** Props del menú lateral. */
interface PropsMenuLateral {
  abierto: boolean;
  pestana: PestanaMenu;
  alCambiarPestana: (pestana: PestanaMenu) => void;
  alCerrar: () => void;
}

/**
 * Cajón lateral con pestañas de billetera e historial.
 * @param props - Estado de apertura, pestaña activa y manejadores.
 * @returns Fondo oscuro y cajón (ocultos e inertes cuando está cerrado).
 */
export function MenuLateral({ abierto, pestana, alCambiarPestana, alCerrar }: PropsMenuLateral): ReactNode {
  const botonCerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    botonCerrar.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, alCerrar]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={alCerrar}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${abierto ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-menu-lateral"
        inert={!abierto}
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col bg-emerald-950 shadow-2xl transition-transform duration-200 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-emerald-800 p-4">
          <h2 id="titulo-menu-lateral" className="text-lg font-bold">
            {TITULO_PESTANA[pestana]}
          </h2>
          <button ref={botonCerrar} type="button" onClick={alCerrar} aria-label="Cerrar menú" className="rounded px-2 text-xl hover:bg-emerald-800">
            ✕
          </button>
        </header>
        <div role="tablist" className="grid grid-cols-2 border-b border-emerald-800">
          {(Object.keys(TITULO_PESTANA) as PestanaMenu[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="tab"
              aria-selected={pestana === opcion}
              onClick={() => alCambiarPestana(opcion)}
              className={`py-2 text-sm ${pestana === opcion ? "border-b-2 border-amber-400 font-semibold" : "text-emerald-300 hover:text-emerald-100"}`}
            >
              {TITULO_PESTANA[opcion]}
            </button>
          ))}
        </div>
        {/* El contenido solo se monta abierto: así el historial se recarga cada vez que se consulta. */}
        <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
          {abierto && (pestana === "billetera" ? <PanelBilletera /> : <HistorialMovimientos />)}
        </div>
      </aside>
    </>
  );
}
