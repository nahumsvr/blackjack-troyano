/** Configuración central del servidor; los valores se amplían por tarea. */
import { LIMITES_CANTIDAD } from "@blackjack/shared";

/** Dirección LAN en la que escucha el servidor. */
export const HOST = "0.0.0.0";
/** Puerto único previsto para el servidor. */
export const PUERTO = 3000;
/** Ruta del upgrade WebSocket descrita en documentation/PLAN.md. */
export const RUTA_WS = "/ws";
/** Topic compartido por las conexiones del lobby. */
export const TOPIC_LOBBY = "lobby";
/** Límite del protocolo medido en bytes UTF-8, antes de decodificar JSON. */
export const MENSAJE_MAX_BYTES = 16 * 1024;
/** Zapato de cuatro mazos; reposición entre rondas por debajo del 25 %. */
export const NUM_MAZOS = 4;
export const UMBRAL_REBARAJAR = 0.25;
/*
 * Los límites de cantidad se definen una sola vez en `LIMITES_CANTIDAD` (shared/protocolo.ts)
 * porque el cliente los necesita para validar formularios y `shared/` no puede importar
 * código del servidor. Aquí solo se re-exportan: cambiarlos en shared/ actualiza a la vez
 * el esquema Zod, el cliente y las validaciones de BilleteraSQL, sin que puedan desalinearse.
 */
/** Límites y unidad indivisible de las apuestas. */
export const APUESTA_MIN = LIMITES_CANTIDAD.apuestaMin;
export const APUESTA_MAX = LIMITES_CANTIDAD.apuestaMax;
export const MULTIPLO_FICHAS = LIMITES_CANTIDAD.multiplo;
/** Límites de una compra y tasa de dinero simulado por ficha. */
export const COMPRA_FICHAS_MIN = LIMITES_CANTIDAD.compraMin;
export const COMPRA_FICHAS_MAX = LIMITES_CANTIDAD.compraMax;
export const TASA_FICHAS = 1;
/** Día natural de compra, independiente de la zona horaria del servidor. */
export const LIMITE_DIARIO = 5_000;
export const ZONA_HORARIA = "America/Mexico_City";
/** Bienvenida y vigencia de sesiones de PLAN §1. */
export const DINERO_INICIAL = 10_000;
export const FICHAS_INICIALES = 500;
export const TOKEN_BYTES = 32;
export const SESION_DURACION_MS = 7 * 24 * 60 * 60 * 1000;
/** Artículos del seed que se entregan y equipan al registrarse. */
export const EQUIPADO_INICIAL = {
  avatar: "avatar_basico", reverso: "reverso_clasico", tema: "tema_verde",
} as const;
