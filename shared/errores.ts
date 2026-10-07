/** Códigos estables y textos públicos para errores de dominio y del protocolo. */
import { z } from "zod";

/** Códigos de error de dominio que viajan en los mensajes `error`. */
export const CodigoErrorSchema = z.enum([
  "MENSAJE_INVALIDO", "DEMASIADAS_SOLICITUDES", "NO_AUTENTICADO", "YA_AUTENTICADO",
  "USUARIO_EXISTE", "CREDENCIALES_INVALIDAS", "SESION_INVALIDA", "MESA_NO_EXISTE",
  "MESA_LLENA", "YA_EN_OTRA_MESA", "NO_ESTAS_EN_MESA", "FASE_INCORRECTA",
  "NO_ES_TU_TURNO", "YA_APOSTASTE", "CANTIDAD_INVALIDA", "FICHAS_INSUFICIENTES",
  "DINERO_INSUFICIENTE", "LIMITE_DIARIO", "ARTICULO_NO_EXISTE", "YA_POSEIDO",
  "NO_POSEIDO", "BLOQUEADO_EN_MANO", "NO_PUEDES_DOBLAR", "ERROR_INTERNO",
]);
export type CodigoError = z.infer<typeof CodigoErrorSchema>;
/** Mensaje en español para cada código; viaja en `error.mensaje` y el cliente lo muestra tal cual. */
export const MENSAJES_ERROR = {
  MENSAJE_INVALIDO: "El mensaje no es válido",
  DEMASIADAS_SOLICITUDES: "Enviaste demasiadas solicitudes; espera un momento",
  NO_AUTENTICADO: "Inicia sesión para continuar",
  YA_AUTENTICADO: "Ya iniciaste sesión en esta conexión",
  USUARIO_EXISTE: "Este nombre de usuario ya existe",
  CREDENCIALES_INVALIDAS: "El usuario o la contraseña son incorrectos",
  SESION_INVALIDA: "La sesión no es válida o expiró",
  MESA_NO_EXISTE: "La mesa no existe",
  MESA_LLENA: "La mesa está llena",
  YA_EN_OTRA_MESA: "Ya estás sentado en otra mesa",
  NO_ESTAS_EN_MESA: "No estás sentado en una mesa",
  FASE_INCORRECTA: "Esta acción no está disponible en la fase actual",
  NO_ES_TU_TURNO: "No es tu turno",
  YA_APOSTASTE: "Ya apostaste en esta ronda",
  NO_PUEDES_DOBLAR: "Solo puedes doblar con tus dos cartas iniciales",
  CANTIDAD_INVALIDA: "La cantidad debe ser un entero múltiplo de 10 dentro del rango permitido",
  FICHAS_INSUFICIENTES: "No tienes suficientes fichas",
  DINERO_INSUFICIENTE: "No tienes suficiente dinero",
  LIMITE_DIARIO: "Alcanzaste el límite diario de compra de fichas",
  ARTICULO_NO_EXISTE: "El artículo no existe",
  YA_POSEIDO: "Ya tienes este artículo",
  NO_POSEIDO: "No tienes este artículo",
  BLOQUEADO_EN_MANO: "No puedes equipar artículos durante una mano activa",
  ERROR_INTERNO: "Ocurrió un error interno; intenta de nuevo",
} as const satisfies Record<CodigoError, string>;

/** Error de dominio que el enrutador transforma en una respuesta pública. */
export class ErrorJuego extends Error {
  readonly codigo: CodigoError;

  /**
   * Crea un error con el texto español correspondiente al código.
   * @param codigo - Código estable definido por el contrato.
   * @returns Instancia para lanzar o convertir en mensaje error.
   */
  constructor(codigo: CodigoError) {
    super(MENSAJES_ERROR[codigo]);
    this.name = "ErrorJuego";
    this.codigo = codigo;
  }
}
