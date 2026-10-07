/**
 * Hook que "presenta" la mesa con ritmo: recibe los snapshots del servidor tal como llegan y los
 * deja pasar a la pantalla uno a uno, esperando lo que dicta `retrasoAntesDe` (ver `ritmoMesa.ts`).
 * También retiene el resultado de la ronda: el reductor lo borra al llegar la siguiente fase de
 * apuestas, pero aquí debe seguir visible hasta que esa fase se presente, y no aparece hasta
 * que el dealer terminó de jugar y pasó `ESPERA_RESULTADO_MS`.
 * Solo afecta al dibujo; el servidor sigue siendo la fuente de verdad.
 */
import type { MesaEstado } from "@blackjack/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResultadoRonda } from "../state/reductor";
import { ESPERA_RESULTADO_MS, retrasoAntesDe } from "./ritmoMesa";

/** Lo que la pantalla debe dibujar. */
export interface MesaPresentada {
  /** Snapshot a dibujar (puede ir atrás del último que mandó el servidor). */
  mesa: MesaEstado | null;
  /** Resultado de la ronda, solo cuando ya toca mostrarlo; `null` mientras tanto. */
  resultado: ResultadoRonda | null;
}

/**
 * Presenta la mesa y el resultado con las pausas del ritmo de juego.
 * @param mesaServidor - Último snapshot recibido (`null` fuera de una mesa).
 * @param resultadoServidor - Último resultado recibido (`null` al empezar la ronda siguiente).
 * @returns Mesa y resultado ya sincronizados con la animación.
 */
export function useMesaPresentada(mesaServidor: MesaEstado | null, resultadoServidor: ResultadoRonda | null): MesaPresentada {
  const [mostrada, setMostrada] = useState(mesaServidor);
  const [resultadoListo, setResultadoListo] = useState(false);
  const [retenido, setRetenido] = useState(resultadoServidor);

  const cola = useRef<MesaEstado[]>([]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actual = useRef(mesaServidor);
  const desde = useRef(Date.now());

  /** Saca de la cola lo que ya toca mostrar y programa la espera del siguiente. */
  const avanzar = useCallback(() => {
    if (temporizador.current !== null) return;
    const siguiente = cola.current[0];
    if (siguiente === undefined) return;
    const pasar = () => {
      temporizador.current = null;
      cola.current.shift();
      actual.current = siguiente;
      desde.current = Date.now();
      setMostrada(siguiente);
      avanzar();
    };
    const espera = retrasoAntesDe(actual.current, siguiente, Date.now() - desde.current);
    if (espera <= 0) pasar();
    else temporizador.current = setTimeout(pasar, espera);
  }, []);

  useEffect(() => {
    if (mesaServidor === actual.current) return;
    if (mesaServidor === null || actual.current === null || actual.current.id !== mesaServidor.id) {
      // Salir de la mesa o cambiar de mesa: se muestra sin ritmo y se descarta lo pendiente.
      if (temporizador.current !== null) clearTimeout(temporizador.current);
      temporizador.current = null;
      cola.current = [];
      actual.current = mesaServidor;
      desde.current = Date.now();
      setMostrada(mesaServidor);
      return;
    }
    cola.current.push(mesaServidor);
    avanzar();
  }, [mesaServidor, avanzar]);

  // Al desmontar (también en el doble montaje de StrictMode) no deben quedar temporizadores vivos.
  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
      temporizador.current = null;
    },
    [],
  );

  // El resultado se muestra `ESPERA_RESULTADO_MS` después de presentar los pagos.
  const faseMostrada = mostrada?.fase ?? null;
  useEffect(() => {
    if (faseMostrada !== "PAGOS") {
      setResultadoListo(false);
      return;
    }
    const espera = setTimeout(() => setResultadoListo(true), ESPERA_RESULTADO_MS);
    return () => clearTimeout(espera);
  }, [faseMostrada]);

  // El reductor borra el resultado al llegar la ronda siguiente; aquí se conserva hasta presentarla.
  if (resultadoServidor !== null && resultadoServidor !== retenido) setRetenido(resultadoServidor);
  const nuevaRondaPresentada = faseMostrada === null || faseMostrada === "APUESTAS" || faseMostrada === "ESPERANDO";
  if (retenido !== null && resultadoServidor === null && nuevaRondaPresentada) setRetenido(null);

  return { mesa: mostrada, resultado: resultadoListo && faseMostrada === "PAGOS" ? retenido : null };
}
