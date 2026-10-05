/**
 * Pantalla de mesa. Dibuja el snapshot `mesa.estado` tal cual y habilita las acciones solo
 * cuando el servidor las aceptaría (fase y turno); el servidor sigue siendo quien decide.
 * La mesa se dibuja con `MesaVisual` (dealer al centro, jugadores alrededor);
 * T-28/T-29 completan los controles de apuesta y el overlay de resultado.
 */
import { useState, type ReactNode } from "react";
import { colorDeAsiento } from "../components/colorJugador";
import { MesaVisual } from "../components/MesaVisual";
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
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
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

      <MesaVisual mesa={mesa} miId={miId}>
        {miResultado !== null && (
          <p className="rounded-lg bg-amber-400 px-4 py-2 text-center text-lg font-bold text-emerald-950 shadow-xl">
            {TEXTO_RESULTADO[miResultado.resultado]} · apostaste {miResultado.apuesta}, recibes {miResultado.pago}
          </p>
        )}
      </MesaVisual>

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
