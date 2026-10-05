/**
 * Pantalla de mesa. Dibuja el snapshot `mesa.estado` tal cual y habilita las acciones solo
 * cuando el servidor las aceptaría (fase y turno); el servidor sigue siendo quien decide.
 * Versión funcional mínima: T-27 aporta los componentes visuales de carta y asiento,
 * y T-28/T-29 el diseño final y el overlay de resultado.
 */
import type { Asiento, CartaVista } from "@blackjack/shared";
import { useState, type ReactNode } from "react";
import { colorDeAsiento } from "../components/colorJugador";
import { PanelBilletera } from "../components/PanelBilletera";
import { Reloj } from "../components/Reloj";
import { useJuego } from "../state/store";
import { validarApuesta } from "../state/validacion";

/** Texto de cada fase para el jugador. */
const TEXTO_FASE = {
  ESPERANDO: "Esperando jugadores",
  APUESTAS: "Hagan sus apuestas",
  REPARTO: "Repartiendo",
  TURNOS: "Turno de los jugadores",
  DEALER: "Juega el dealer",
  PAGOS: "Pagos",
} as const;

/** Texto del resultado propio. */
const TEXTO_RESULTADO = { blackjack: "¡Blackjack!", gana: "Ganaste", empate: "Empate", pierde: "Perdiste", pasado: "Te pasaste" } as const;

/** Apuesta sugerida al abrir la mesa. */
const APUESTA_SUGERIDA = "10";

/**
 * Texto corto de una carta (`A♠`), o `🂠` si está oculta.
 * @param carta - Carta del snapshot.
 * @returns Representación textual.
 */
function textoCarta(carta: CartaVista): string {
  return "oculta" in carta ? "🂠" : `${carta.rango}${carta.palo}`;
}

/**
 * Fila de un asiento de la mesa. El color del asiento (borde, punto y nombre) identifica al
 * jugador; el color nunca es la única pista: el nombre y "(tú)" siempre se muestran.
 * @param props - Asiento y si es el turno o el jugador propio.
 * @returns Elemento del asiento.
 */
function FilaAsiento({ asiento, enTurno, propio }: { asiento: Asiento; enTurno: boolean; propio: boolean }): ReactNode {
  const color = colorDeAsiento(asiento.indice);
  return (
    <li
      data-color={color.nombre}
      className={`rounded border-l-8 p-3 ${color.borde} ${enTurno ? "ring-2 ring-amber-400" : ""} ${propio ? "bg-emerald-800" : "bg-emerald-900/60"}`}
    >
      <div className="flex justify-between">
        <span className={`flex items-center gap-2 font-semibold ${color.texto}`}>
          <span className={`inline-block h-3 w-3 rounded-full ${color.punto}`} aria-hidden="true" />
          {asiento.usuario} {propio && "(tú)"}
        </span>
        {!asiento.conectado && <span className="text-sm text-red-300">desconectado</span>}
      </div>
      <div className="font-mono text-lg">{asiento.cartas.map(textoCarta).join(" ") || "—"}</div>
      <div className="text-sm text-emerald-200">
        Apuesta {asiento.apuesta} · Total {asiento.total} · {asiento.estado}
      </div>
    </li>
  );
}

/**
 * Mesa de juego con apuestas, turnos y resultado.
 * @returns Pantalla de mesa, o nada si no hay snapshot.
 */
export function PantallaMesa(): ReactNode {
  const { estado, acciones } = useJuego();
  const [textoApuesta, setTextoApuesta] = useState(APUESTA_SUGERIDA);
  const mesa = estado.mesa;
  if (mesa === null) return null;

  const miId = estado.sesion?.usuario.id ?? null;
  const propio = mesa.asientos.find((asiento) => asiento !== null && asiento.usuarioId === miId) ?? null;
  const conectado = estado.conexion === "conectado";
  const ocupado = estado.pendientes.some((accion) => accion === "apostar" || accion === "pedir" || accion === "plantarse");
  const puedeActuar = conectado && !estado.espectador && !ocupado && propio !== null;

  const validacionApuesta = validarApuesta(textoApuesta, estado.billetera?.fichas ?? 0);
  const puedeApostar = puedeActuar && mesa.fase === "APUESTAS" && propio?.estado === "SIN_APUESTA" && validacionApuesta.ok;
  const esMiTurno = puedeActuar && mesa.fase === "TURNOS" && mesa.turnoDe === miId;
  const jugadorEnTurno = mesa.asientos.find((asiento) => asiento !== null && asiento.usuarioId === mesa.turnoDe) ?? null;
  const miResultado = estado.resultado?.resultados.find((resultado) => resultado.usuarioId === miId) ?? null;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{mesa.nombre}</h1>
          <p>
            {TEXTO_FASE[mesa.fase]}
            {jugadorEnTurno !== null && (
              <>
                {" · "}
                <span className={`font-semibold ${colorDeAsiento(jugadorEnTurno.indice).texto}`}>
                  {jugadorEnTurno.usuarioId === miId ? "te toca" : `turno de ${jugadorEnTurno.usuario}`}
                </span>
              </>
            )}
          </p>
        </div>
        <Reloj finEn={mesa.finEn} desfaseMs={estado.desfaseMs} />
        <button
          type="button"
          disabled={!conectado || estado.pendientes.includes("mesa.salir")}
          onClick={() => void acciones.salirDeMesa()}
          className="rounded border border-emerald-600 px-3 py-1 disabled:opacity-50"
        >
          Salir de la mesa
        </button>
      </header>

      {estado.espectador && (
        <p className="rounded bg-sky-800 p-2 text-sm">Tu asiento se abrió en otra pestaña; aquí solo puedes mirar.</p>
      )}
      {propio?.estado === "ESPERANDO_RONDA" && <p className="rounded bg-sky-800 p-2 text-sm">Entraste a media ronda: juegas desde la siguiente.</p>}

      <section className="rounded bg-emerald-900/60 p-4">
        <h2 className="font-semibold">Dealer</h2>
        <div className="font-mono text-lg">{mesa.dealer.cartas.map(textoCarta).join(" ") || "—"}</div>
        <div className="text-sm">Total {mesa.dealer.total ?? "?"}</div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mesa.asientos.map((asiento, indice) =>
          asiento === null ? (
            <li key={indice} className="rounded border border-dashed border-emerald-800 p-3 text-emerald-600">
              Asiento libre
            </li>
          ) : (
            <FilaAsiento key={indice} asiento={asiento} enTurno={mesa.turnoDe === asiento.usuarioId} propio={asiento.usuarioId === miId} />
          ),
        )}
      </ul>

      {miResultado !== null && (
        <p className="rounded bg-amber-400 p-3 text-center text-lg font-bold text-emerald-950">
          {TEXTO_RESULTADO[miResultado.resultado]} · apostaste {miResultado.apuesta}, recibes {miResultado.pago}
        </p>
      )}

      <section className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              value={textoApuesta}
              onChange={(evento) => setTextoApuesta(evento.target.value)}
              aria-label="Fichas a apostar"
              className="w-24 rounded bg-emerald-950 px-2 py-1"
            />
            <button
              type="button"
              disabled={!puedeApostar}
              onClick={() => validacionApuesta.ok && void acciones.apostar(validacionApuesta.cantidad)}
              className="rounded bg-amber-400 px-3 py-1 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apostar
            </button>
          </div>
          {mesa.fase === "APUESTAS" && !validacionApuesta.ok && <span className="text-sm text-amber-300">{validacionApuesta.motivo}</span>}
        </div>
        <button
          type="button"
          disabled={!esMiTurno}
          onClick={() => void acciones.pedir()}
          className="rounded bg-sky-500 px-4 py-1 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Pedir
        </button>
        <button
          type="button"
          disabled={!esMiTurno}
          onClick={() => void acciones.plantarse()}
          className="rounded bg-sky-500 px-4 py-1 font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Plantarse
        </button>
      </section>

      <PanelBilletera />
    </main>
  );
}
