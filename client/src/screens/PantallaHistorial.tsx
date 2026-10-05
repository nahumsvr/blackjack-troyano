/**
 * Historial de movimientos (libro contable del usuario), del más reciente al más antiguo,
 * con paginación "ver más" por `antesDe`. Base de T-41.
 */
import { useEffect, type ReactNode } from "react";
import { useJuego } from "../state/store";

/** Texto de cada tipo de movimiento. */
const TEXTO_TIPO = {
  registro: "Registro",
  compra_fichas: "Compra de fichas",
  apuesta: "Apuesta",
  pago: "Pago de ronda",
  compra_articulo: "Compra en tienda",
} as const;

/**
 * Formatea un cambio con signo (`+100`, `−50`, `0`).
 * @param valor - Cambio entero.
 * @returns Texto con signo.
 */
function conSigno(valor: number): string {
  if (valor > 0) return `+${valor.toLocaleString("es-MX")}`;
  if (valor < 0) return `−${Math.abs(valor).toLocaleString("es-MX")}`;
  return "0";
}

/** Props del historial. */
interface PropsPantallaHistorial {
  /** Vuelve al lobby. */
  alVolver: () => void;
}

/**
 * Tabla del historial de movimientos.
 * @param props - Navegación de regreso.
 * @returns Pantalla de historial.
 */
export function PantallaHistorial({ alVolver }: PropsPantallaHistorial): ReactNode {
  const { estado, acciones } = useJuego();
  const conectado = estado.conexion === "conectado";
  const cargando = estado.pendientes.includes("movimientos.listar");
  const items = estado.movimientos?.items ?? [];
  const ultimo = items.at(-1);

  useEffect(() => {
    if (conectado) void acciones.listarMovimientos();
  }, [acciones, conectado]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Historial de movimientos</h1>
        <button type="button" onClick={alVolver} className="rounded border border-emerald-600 px-3 py-1">
          Volver
        </button>
      </header>
      {estado.movimientos === null ? (
        <p className="text-emerald-300">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-emerald-300">Aún no tienes movimientos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-emerald-300">
              <tr>
                <th className="py-1">Fecha</th>
                <th>Tipo</th>
                <th className="text-right">Fichas</th>
                <th className="text-right">Dinero</th>
                <th className="text-right">Fichas después</th>
                <th className="text-right">Dinero después</th>
              </tr>
            </thead>
            <tbody>
              {items.map((fila) => (
                <tr key={fila.id} className="border-t border-emerald-800">
                  <td className="py-1">{new Date(fila.creadoEn).toLocaleString("es-MX")}</td>
                  <td>{TEXTO_TIPO[fila.tipo]}</td>
                  <td className="text-right tabular-nums">{conSigno(fila.deltaFichas)}</td>
                  <td className="text-right tabular-nums">{conSigno(fila.deltaDinero)}</td>
                  <td className="text-right tabular-nums">{fila.fichasDespues.toLocaleString("es-MX")}</td>
                  <td className="text-right tabular-nums">${fila.dineroDespues.toLocaleString("es-MX")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {estado.movimientos?.hayMas === true && ultimo !== undefined && (
        <button
          type="button"
          disabled={cargando || !conectado}
          onClick={() => void acciones.listarMovimientos(ultimo.id)}
          className="self-center rounded border border-emerald-600 px-4 py-1 disabled:opacity-50"
        >
          {cargando ? "Cargando…" : "Ver más"}
        </button>
      )}
    </main>
  );
}
