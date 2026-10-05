/**
 * Lógica de la cuenta regresiva animada (temporizador circular y barra de turno).
 * El contrato solo manda `finEn` (cuándo vence), no cuánto dura la fase; por eso la duración
 * total se toma la primera vez que este cliente ve cada `finEn`. Quien entra a media fase ve
 * la barra completa con los segundos que le quedan, que es justo el tiempo que tiene para actuar.
 */
import { useEffect, useRef, useState } from "react";
import { msRestantes } from "../net/reloj";

/** Por debajo de estos segundos el temporizador se pone rojo y late cada segundo. */
export const SEGUNDOS_URGENTES = 5;
/** Fracción restante a partir de la cual el temporizador pasa de verde a ámbar. */
const FRACCION_ATENCION = 0.5;

/** Qué tan cerca está el vencimiento. */
export type NivelUrgencia = "calma" | "atencion" | "urgente";

/** Estado de una cuenta regresiva en un cuadro de animación. */
export interface CuentaRegresiva {
  restanteMs: number;
  /** Duración de referencia (lo que faltaba cuando este cliente vio el `finEn`). */
  totalMs: number;
  /** Fracción restante entre 0 y 1 (1 = recién empieza). */
  fraccion: number;
  /** Segundos enteros que se muestran (redondeo hacia arriba: "1" hasta el último instante). */
  segundos: number;
  /** Urgencia para color y latido. */
  nivel: NivelUrgencia;
}

/**
 * Fracción de tiempo que queda.
 * @param restanteMs - Ms que faltan.
 * @param totalMs - Duración de referencia.
 * @returns Valor entre 0 y 1; 0 si la duración no es positiva.
 */
export function fraccionRestante(restanteMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, restanteMs / totalMs));
}

/**
 * Nivel de urgencia para el color y el latido del temporizador.
 * Las esperas cortas (p. ej. los 5 s de PAGOS, donde nadie tiene que actuar) nunca se marcan
 * como urgentes: el rojo se reserva para cuando de verdad se acaba el tiempo de decidir.
 * @param restanteMs - Ms que faltan.
 * @param totalMs - Duración de referencia.
 * @returns `urgente` en los últimos segundos, `atencion` pasada la mitad, `calma` antes.
 */
export function nivelUrgencia(restanteMs: number, totalMs: number): NivelUrgencia {
  const limiteUrgente = SEGUNDOS_URGENTES * 1000;
  if (totalMs > limiteUrgente && restanteMs <= limiteUrgente) return "urgente";
  if (fraccionRestante(restanteMs, totalMs) <= FRACCION_ATENCION) return "atencion";
  return "calma";
}

/**
 * Calcula la cuenta regresiva de un instante.
 * @param restanteMs - Ms que faltan.
 * @param totalMs - Duración de referencia.
 * @returns Cuenta con fracción, segundos visibles y nivel de urgencia.
 */
export function calcularCuenta(restanteMs: number, totalMs: number): CuentaRegresiva {
  const fraccion = fraccionRestante(restanteMs, totalMs);
  return { restanteMs, totalMs, fraccion, segundos: Math.ceil(restanteMs / 1000), nivel: nivelUrgencia(restanteMs, totalMs) };
}

/**
 * Cuenta regresiva hacia un `finEn` del servidor, actualizada en cada cuadro de animación
 * (para que el anillo y la barra se vacíen de forma continua, sin saltos por segundo).
 * @param finEn - Epoch ms del servidor; `null` si no hay reloj.
 * @param desfaseMs - Desfase medido con `ping` (ver `net/reloj.ts`).
 * @returns Cuenta actual, o `null` si no hay reloj.
 */
export function useCuentaRegresiva(finEn: number | null, desfaseMs: number): CuentaRegresiva | null {
  const [cuenta, setCuenta] = useState<(CuentaRegresiva & { finEn: number }) | null>(null);
  // El desfase puede corregirse a media cuenta; se lee por referencia para no reiniciar la duración total.
  const desfase = useRef(desfaseMs);
  useEffect(() => {
    desfase.current = desfaseMs;
  }, [desfaseMs]);

  useEffect(() => {
    if (finEn === null) return;
    let totalMs: number | null = null;
    let cuadro = 0;
    const avanzar = () => {
      const restanteMs = msRestantes(finEn, Date.now(), desfase.current) ?? 0;
      totalMs ??= restanteMs;
      setCuenta({ ...calcularCuenta(restanteMs, totalMs), finEn });
      if (restanteMs > 0) cuadro = requestAnimationFrame(avanzar);
    };
    cuadro = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(cuadro);
  }, [finEn]);

  // Solo vale la cuenta del `finEn` actual (evita mostrar un cuadro del reloj anterior).
  if (finEn === null || cuenta === null || cuenta.finEn !== finEn) return null;
  return cuenta;
}
