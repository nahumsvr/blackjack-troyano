/**
 * Muestrario de cartas del modo mock (`?mock=1&muestrario`): página de prueba que dibuja las
 * 52 cartas, los 5 reversos del catálogo y los asientos y el dealer en sus estados, para
 * revisarlos de un vistazo sin jugar una ronda. No usa la conexión ni el estado global; solo
 * los componentes de la mesa con datos de `mock/fixtures.ts`.
 */
import type { MesaEstado } from "@blackjack/shared";
import { useState, type ReactNode } from "react";
import { Asiento, AsientoLibre } from "../components/Asiento";
import { baraja52 } from "../components/baraja";
import { Carta, type TamanoCarta } from "../components/Carta";
import { ManoDealer } from "../components/ManoDealer";
import { catalogoDemo, ID_DEMO, mesaEnFase } from "../mock/fixtures";

/** Tamaños de carta que se pueden elegir en el muestrario. */
const TAMANOS: TamanoCarta[] = ["normal", "chica"];

/**
 * Sección con título sobre el paño de la mesa.
 * @param props - Título y contenido.
 * @returns Bloque de la sección.
 */
function Seccion({ titulo, children }: { titulo: string; children: ReactNode }): ReactNode {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-emerald-800 p-4 shadow-inner">
      <h2 className="text-sm font-semibold tracking-widest text-emerald-100/80 uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Asientos de un snapshot de ejemplo, con el usuario demo como jugador propio.
 * @param props - Snapshot de la mesa.
 * @returns Fila con los 5 lugares (ocupados o libres).
 */
function FilaAsientos({ mesa }: { mesa: MesaEstado }): ReactNode {
  return (
    <div className="flex flex-wrap items-end justify-center gap-6">
      {mesa.asientos.map((asiento, indice) =>
        asiento === null ? (
          <AsientoLibre key={indice} />
        ) : (
          <Asiento key={indice} asiento={asiento} enTurno={asiento.usuarioId === mesa.turnoDe} propio={asiento.usuarioId === ID_DEMO} />
        ),
      )}
    </div>
  );
}

/**
 * Página del muestrario.
 * @returns Frentes por palo, reversos del catálogo, asientos y dealer.
 */
export function PantallaMuestrario(): ReactNode {
  const [tamano, setTamano] = useState<TamanoCarta>("normal");
  const baraja = baraja52();
  const palos = [...new Set(baraja.map((carta) => carta.palo))];
  const reversos = catalogoDemo().filter((articulo) => articulo.tipo === "reverso");
  const turnos = mesaEnFase("TURNOS");
  const pagos = mesaEnFase("PAGOS");

  /** Vuelve a la app quitando `muestrario` de la URL (conserva `mock`). */
  const volver = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("muestrario");
    window.location.assign(url);
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Muestrario de cartas</h1>
        <div className="flex gap-1" role="group" aria-label="Tamaño de carta">
          {TAMANOS.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={tamano === opcion}
              onClick={() => setTamano(opcion)}
              className={`rounded px-2 py-0.5 text-sm ${tamano === opcion ? "bg-emerald-500 text-emerald-950" : "bg-emerald-800 hover:bg-emerald-700"}`}
            >
              {opcion}
            </button>
          ))}
        </div>
        <button type="button" onClick={volver} className="ml-auto rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600">
          Volver a la app
        </button>
      </header>

      <Seccion titulo={`Frentes (${baraja.length} cartas)`}>
        {palos.map((palo) => (
          <div key={palo} className="flex flex-wrap gap-2">
            {baraja
              .filter((carta) => carta.palo === palo)
              .map((carta) => (
                <Carta key={`${carta.rango}${carta.palo}`} carta={carta} tamano={tamano} entrada="voltear" />
              ))}
          </div>
        ))}
      </Seccion>

      <Seccion titulo={`Reversos del catálogo (${reversos.length})`}>
        <div className="flex flex-wrap gap-6">
          {reversos.map((articulo) => (
            <figure key={articulo.id} className="flex flex-col items-center gap-1">
              <Carta carta={{ oculta: true }} tamano={tamano} entrada="voltear" reverso={articulo.id} />
              <figcaption className="text-xs text-emerald-100">{articulo.nombre}</figcaption>
            </figure>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Dealer: carta oculta y revelada">
        <div className="flex flex-wrap justify-around gap-8">
          <ManoDealer dealer={turnos.dealer} participantes={1} />
          <ManoDealer dealer={pagos.dealer} participantes={1} />
        </div>
      </Seccion>

      <Seccion titulo="Asientos en turnos (jugando, blackjack, apostado, libre, desconectado)">
        <FilaAsientos mesa={turnos} />
      </Seccion>
      <Seccion titulo="Asientos en pagos (plantado, blackjack, pasado)">
        <FilaAsientos mesa={pagos} />
      </Seccion>
    </main>
  );
}
