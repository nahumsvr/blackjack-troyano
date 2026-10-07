/**
 * Pantalla de mesa. Dibuja el snapshot `mesa.estado` tal cual y habilita las acciones solo
 * cuando el servidor las aceptaría (fase y turno); el servidor sigue siendo quien decide.
 * La mesa se dibuja con `MesaVisual` (dealer al centro, jugadores alrededor). Al centro del paño
 * aparecen pistas de qué hacer ("Haz tu apuesta", "¡Te toca!") y, tras cerrar el resultado de la
 * ronda, una píldora para volver a verlo. El resultado se muestra con `OverlayResultado` (T-29).
 * Todo lo que dibuja pasa por `useMesaPresentada`, que espacia los cambios del servidor en el tiempo.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { colorDeAsiento } from "../components/colorJugador";
import { MesaVisual } from "../components/MesaVisual";
import { BotonBilletera } from "../components/BotonBilletera";
import { BotonJuego } from "../components/BotonJuego";
import { PRESENTACION_RESULTADO, netoResultado } from "../components/efectosResultado";
import { IndicadorConexion } from "../components/IndicadorConexion";
import type { PestanaMenu } from "../components/MenuLateral";
import { OverlayResultado, type DatosResultado } from "../components/OverlayResultado";
import { Ficha } from "../components/Ficha";
import { Reloj } from "../components/Reloj";
import { useMesaPresentada } from "../components/useMesaPresentada";
import { SelectorApuesta } from "../components/SelectorApuesta";
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

/** Mensaje del panel del jugador en las fases donde no le toca hacer nada. */
const TEXTO_ESPERA: Record<"ESPERANDO" | "DEALER" | "PAGOS", string> = {
  ESPERANDO: "Esperando a que se sienten más jugadores…",
  DEALER: "Juega el dealer…",
  PAGOS: "Pagando la ronda…",
};

/** Apuesta sugerida al abrir la mesa. */
const APUESTA_SUGERIDA = "10";

/** Props de la pantalla de mesa. */
interface PropsPantallaMesa {
  /** Abre el menú lateral (billetera e historial) sin salir de la mesa. */
  alAbrirMenu: (pestana: PestanaMenu) => void;
}

/**
 * Mesa de juego con apuestas, turnos y resultado.
 * @param props - Apertura del menú lateral.
 * @returns Pantalla de mesa, o nada si no hay snapshot.
 */
export function PantallaMesa({ alAbrirMenu }: PropsPantallaMesa): ReactNode {
  const { estado, acciones } = useJuego();
  const [textoApuesta, setTextoApuesta] = useState(APUESTA_SUGERIDA);
  // Ronda cuyo resultado el usuario ya cerró (la píldora central permite reabrirlo).
  const [rondaCerrada, setRondaCerrada] = useState<string | null>(null);
  const miId = estado.sesion?.usuario.id ?? null;
  // La mesa y el resultado se dibujan con ritmo (pausa antes de repartir, dealer carta por carta,
  // resultado tras la última carta); lo que el servidor decidió ya no cambia.
  const { mesa, resultado: ronda } = useMesaPresentada(estado.mesa, estado.resultado);
  const datosResultado = useMemo<DatosResultado | null>(() => {
    const propio = ronda?.resultados.find((resultado) => resultado.usuarioId === miId);
    return ronda === null || propio === undefined ? null : { rondaId: ronda.rondaId, propio, dealer: ronda.dealer };
  }, [ronda, miId]);
  const cerrarResultado = useCallback(() => setRondaCerrada(ronda?.rondaId ?? null), [ronda]);

  if (mesa === null) return null;

  const propio = mesa.asientos.find((asiento) => asiento !== null && asiento.usuarioId === miId) ?? null;
  const conectado = estado.conexion === "conectado";
  const ocupado = estado.pendientes.some((accion) => accion === "apostar" || accion === "pedir" || accion === "plantarse");
  const puedeActuar = conectado && !estado.espectador && !ocupado && propio !== null;

  const validacionApuesta = validarApuesta(textoApuesta, estado.billetera?.fichas ?? 0);
  const esMiTurno = puedeActuar && mesa.fase === "TURNOS" && mesa.turnoDe === miId;
  const jugadorEnTurno = mesa.asientos.find((asiento) => asiento !== null && asiento.usuarioId === mesa.turnoDe) ?? null;
  const resultadoVisible = datosResultado !== null && rondaCerrada !== datosResultado.rondaId;
  // Pistas para el jugador propio; no dependen de peticiones pendientes para no parpadear al hacer clic.
  const turnoPropio = !estado.espectador && mesa.fase === "TURNOS" && mesa.turnoDe === miId;
  const debeApostar = !estado.espectador && mesa.fase === "APUESTAS" && propio?.estado === "SIN_APUESTA";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{mesa.nombre}</h1>
          <p>
            <span key={mesa.fase} className="inline-block animate-aparecer">
              {TEXTO_FASE[mesa.fase]}
            </span>
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
        <div className="flex flex-wrap items-center gap-2">
          <IndicadorConexion />
          <BotonBilletera alAbrir={() => alAbrirMenu("billetera")} />
          <button
            type="button"
            disabled={!conectado || estado.pendientes.includes("mesa.salir")}
            onClick={() => void acciones.salirDeMesa()}
            className="rounded border border-emerald-600 px-3 py-1 disabled:opacity-50"
          >
            Salir de la mesa
          </button>
        </div>
      </header>

      {estado.espectador && (
        <p className="rounded bg-sky-800 p-2 text-sm">Tu asiento se abrió en otra pestaña; aquí solo puedes mirar.</p>
      )}

      <MesaVisual mesa={mesa} miId={miId} desfaseMs={estado.desfaseMs}>
        {datosResultado !== null && !resultadoVisible ? (
          <button
            type="button"
            onClick={() => setRondaCerrada(null)}
            className="animate-aparecer rounded-full bg-emerald-950/90 px-4 py-1.5 text-sm font-semibold shadow-lg ring-1 ring-amber-300/60 transition-transform hover:scale-105 active:scale-95"
          >
            {PRESENTACION_RESULTADO[datosResultado.propio.resultado].titulo} · {textoNeto(datosResultado)} · ver resultado
          </button>
        ) : turnoPropio ? (
          <p key="turno" className="animate-aparecer rounded-full bg-amber-400 px-4 py-1.5 font-bold text-emerald-950 shadow-lg">
            ¡Te toca! Pide carta o plántate
          </p>
        ) : debeApostar ? (
          <p key="apuesta" className="animate-aparecer rounded-full bg-emerald-950/80 px-4 py-1.5 text-sm font-semibold text-amber-200 shadow-lg">
            Haz tu apuesta antes de que acabe el tiempo
          </p>
        ) : null}
      </MesaVisual>

      {/* Panel del jugador, centrado bajo su asiento: muestra solo lo que puede hacer en esta fase. */}
      <section
        aria-label="Tus acciones"
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-3xl bg-emerald-900/50 px-6 py-5 text-center shadow-inner ring-1 ring-emerald-700/50"
      >
        {propio === null || estado.espectador ? (
          <p className="text-emerald-200">Estás mirando la mesa.</p>
        ) : propio.estado === "ESPERANDO_RONDA" ? (
          <p className="text-emerald-200">Entraste a media ronda: juegas desde la siguiente.</p>
        ) : mesa.fase === "APUESTAS" && propio.estado === "SIN_APUESTA" ? (
          <SelectorApuesta
            texto={textoApuesta}
            alCambiar={setTextoApuesta}
            fichas={estado.billetera?.fichas ?? 0}
            validacion={validacionApuesta}
            habilitado={puedeActuar}
            enviando={estado.pendientes.includes("apostar")}
            alApostar={(cantidad) => void acciones.apostar(cantidad)}
          />
        ) : mesa.fase === "APUESTAS" ? (
          <p className="flex items-center gap-3 text-lg font-semibold">
            <Ficha cantidad={propio.apuesta} tamano="grande" />
            Apostaste {propio.apuesta.toLocaleString("es-MX")}. Esperando a los demás…
          </p>
        ) : mesa.fase === "REPARTO" || mesa.fase === "TURNOS" ? (
          <>
            <div className="flex flex-wrap justify-center gap-4">
              <BotonJuego variante="verde" icono="+" llamando={esMiTurno} disabled={!esMiTurno} onClick={() => void acciones.pedir()}>
                Pedir
              </BotonJuego>
              <BotonJuego variante="rojo" icono="✋" llamando={esMiTurno} disabled={!esMiTurno} onClick={() => void acciones.plantarse()}>
                Plantarse
              </BotonJuego>
            </div>
            <p className="text-sm text-emerald-200">{textoTurno(mesa.fase, turnoPropio, jugadorEnTurno?.usuario ?? null)}</p>
          </>
        ) : (
          <p className="text-emerald-200">{TEXTO_ESPERA[mesa.fase]}</p>
        )}
      </section>

      <OverlayResultado datos={datosResultado} visible={resultadoVisible} alCerrar={cerrarResultado} />
    </main>
  );
}

/**
 * Ganancia o pérdida en texto corto para la píldora del resultado.
 * @param datos - Resultado propio.
 * @returns "+100 fichas", "−50 fichas" o "sin cambios".
 */
function textoNeto(datos: DatosResultado): string {
  const neto = netoResultado(datos.propio.apuesta, datos.propio.pago);
  if (neto === 0) return "sin cambios";
  return `${neto > 0 ? "+" : "−"}${Math.abs(neto).toLocaleString("es-MX")} fichas`;
}

/**
 * Leyenda bajo Pedir/Plantarse durante el reparto y los turnos.
 * @param fase - `REPARTO` o `TURNOS`.
 * @param turnoPropio - Es el turno de este jugador.
 * @param enTurno - Nombre de quien juega, si hay alguien en turno.
 * @returns Texto corto para el jugador.
 */
function textoTurno(fase: "REPARTO" | "TURNOS", turnoPropio: boolean, enTurno: string | null): string {
  if (fase === "REPARTO") return "Repartiendo cartas…";
  // Sin el total: se ve sobre tu última carta cuando termina de descubrirse (aquí lo adelantaría).
  if (turnoPropio) return "¿Otra carta o te plantas?";
  return enTurno === null ? "Esperando turno…" : `Turno de ${enTurno}`;
}
