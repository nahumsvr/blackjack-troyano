/**
 * Historial de movimientos (libro contable del usuario), del más reciente al más antiguo,
 * con paginación "ver más" por `antesDe`. Se muestra dentro del menú lateral, así que usa
 * una lista compacta en vez de una tabla ancha. Se recarga cada vez que se monta
 * (al abrir la pestaña), para incluir las rondas recién jugadas. Base de T-41.
 */
import type { Movimiento } from "@blackjack/shared";
import { useEffect, type ReactNode } from "react";
import { useJuego } from "../state/store";

/** Texto de cada tipo de movimiento. */
const TEXTO_TIPO: Record<Movimiento["tipo"], string> = {
  registro: "Registro",
  compra_fichas: "Compra de fichas",
  apuesta: "Apuesta",
  pago: "Pago de ronda",
  compra_articulo: "Compra en tienda",
};

/**
 * Formatea un cambio con signo (`+100`, `−50`).
 * @param valor - Cambio entero distinto de cero.
 * @returns Texto con signo.
 */
function conSigno(valor: number): string {
  const absoluto = Math.abs(valor).toLocaleString("es-MX");
  return valor > 0 ? `+${absoluto}` : `−${absoluto}`;
}

/**
 * Lista del historial con carga inicial y "ver más".
 * @returns Historial de movimientos.
 */
export function HistorialMovimientos(): ReactNode {
  const { estado, acciones } = useJuego();
  const conectado = estado.conexion === "conectado";
  const cargando = estado.pendientes.includes("movimientos.listar");
  const items = estado.movimientos?.items ?? [];
  const ultimo = items.at(-1);

  useEffect(() => {
    if (conectado) void acciones.listarMovimientos();
  }, [acciones, conectado]);

  if (estado.movimientos === null) return <p className="text-emerald-300">Cargando…</p>;
  if (items.length === 0) return <p className="text-emerald-300">Aún no tienes movimientos.</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-emerald-800">
        {items.map((fila) => (
          <li key={fila.id} className="flex items-start justify-between gap-3 py-2 text-sm">
            <div>
              <div className="font-semibold">{TEXTO_TIPO[fila.tipo]}</div>
              <div className="text-xs text-emerald-300">{new Date(fila.creadoEn).toLocaleString("es-MX")}</div>
            </div>
            <div className="text-right tabular-nums">
              {fila.deltaFichas !== 0 && (
                <div className={fila.deltaFichas > 0 ? "text-lime-300" : "text-orange-300"}>{conSigno(fila.deltaFichas)} fichas</div>
              )}
              {fila.deltaDinero !== 0 && (
                <div className={fila.deltaDinero > 0 ? "text-lime-300" : "text-orange-300"}>{conSigno(fila.deltaDinero)} $</div>
              )}
              <div className="text-xs text-emerald-300">
                Saldo: {fila.fichasDespues.toLocaleString("es-MX")} fichas · ${fila.dineroDespues.toLocaleString("es-MX")}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {estado.movimientos.hayMas && ultimo !== undefined && (
        <button
          type="button"
          disabled={cargando || !conectado}
          onClick={() => void acciones.listarMovimientos(ultimo.id)}
          className="self-center rounded border border-emerald-600 px-4 py-1 disabled:opacity-50"
        >
          {cargando ? "Cargando…" : "Ver más"}
        </button>
      )}
    </div>
  );
}
