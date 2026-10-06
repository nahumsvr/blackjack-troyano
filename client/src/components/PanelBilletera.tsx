/**
 * Panel de billetera: dinero, fichas, límite diario y compra de fichas.
 * El saldo SOLO cambia con los mensajes `billetera` del servidor; aquí no se calcula nada.
 * Base de T-30.
 */
import { useState, type ReactNode } from "react";
import { useJuego } from "../state/store";
import { horaLocal, validarCompra } from "../state/validacion";

/** Cantidad sugerida al abrir el panel. */
const COMPRA_SUGERIDA = "1000";

/**
 * Muestra la billetera y permite comprar fichas.
 * @returns Panel de billetera, o nada si aún no llega la billetera.
 */
export function PanelBilletera(): ReactNode {
  const { estado, acciones } = useJuego();
  const [texto, setTexto] = useState(COMPRA_SUGERIDA);
  const billetera = estado.billetera;
  if (billetera === null) return null;
  const validacion = validarCompra(texto, billetera);
  const comprando = estado.pendientes.includes("fichas.comprar");
  const puedeComprar = validacion.ok && !comprando && estado.conexion === "conectado";

  return (
    <section aria-label="Billetera" className="flex flex-col gap-2 rounded bg-emerald-900/60 p-4">
      <p>
        Dinero: <strong>${billetera.dinero.toLocaleString("es-MX")}</strong> · Fichas:{" "}
        <strong>{billetera.fichas.toLocaleString("es-MX")}</strong>
      </p>
      <p className="text-sm text-emerald-200">
        Te quedan {billetera.disponibleHoy.toLocaleString("es-MX")} de {billetera.limiteDiario.toLocaleString("es-MX")} fichas por comprar hoy; se
        reinicia a las {horaLocal(billetera.reinicioEn)}.
      </p>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          aria-label="Fichas a comprar"
          className="w-28 rounded bg-emerald-950 px-2 py-1"
        />
        <button
          type="button"
          disabled={!puedeComprar}
          onClick={() => validacion.ok && void acciones.comprarFichas(validacion.cantidad)}
          className="rounded bg-amber-400 px-3 py-1 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {comprando ? "Comprando…" : "Comprar fichas"}
        </button>
      </div>
      {!validacion.ok && <p className="text-sm text-amber-300">{validacion.motivo}</p>}
    </section>
  );
}
