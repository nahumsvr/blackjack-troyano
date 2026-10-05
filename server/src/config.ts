/** Configuración central del transporte de T-06; los valores se amplían por tarea. */
/** Dirección LAN en la que escucha el servidor. */
export const HOST = "0.0.0.0";
/** Puerto único previsto para el servidor. */
export const PUERTO = 3000;
/** Ruta del upgrade WebSocket descrita en documentation/PLAN.md. */
export const RUTA_WS = "/ws";
/** Topic compartido por las conexiones del lobby. */
export const TOPIC_LOBBY = "lobby";
/** Límites y unidad indivisible de las apuestas. */
export const APUESTA_MIN = 10;
export const APUESTA_MAX = 500;
export const MULTIPLO_FICHAS = 10;
/** Límites de una compra y tasa de dinero simulado por ficha. */
export const COMPRA_FICHAS_MIN = 10;
export const COMPRA_FICHAS_MAX = 5_000;
export const TASA_FICHAS = 1;
/** Día natural de compra, independiente de la zona horaria del servidor. */
export const LIMITE_DIARIO = 5_000;
export const ZONA_HORARIA = "America/Mexico_City";
