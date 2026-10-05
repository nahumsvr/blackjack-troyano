/** Uniones discriminadas para todos los mensajes WebSocket del PLAN §3. */
import { z } from "zod";
import { CodigoErrorSchema, MENSAJES_ERROR } from "./errores";
import {
  ArticuloCatalogoSchema, ArticuloIdSchema, BilleteraEstadoSchema, CartaVisibleSchema,
  EnteroNoNegativoSchema, EquipadoSchema, InventarioEstadoSchema, MesaEstadoSchema,
  MesaIdSchema, MesaResumenSchema, MovimientoIdSchema, MovimientoSchema,
  ResultadoJugadorSchema, UsuarioNombreSchema, UsuarioVistaSchema,
} from "./tipos";

export const ReqIdSchema = z.string().max(36);
export const TokenSchema = z.string().regex(/^[a-fA-F0-9]{64}$/);
export const UuidSchema = z.uuid();
/** Límites de referencia del protocolo; el servidor pasa su config al crear el esquema. */
export const LimitesCantidadSchema = z.strictObject({
  apuestaMin: z.number().int().positive(), apuestaMax: z.number().int().positive(),
  compraMin: z.number().int().positive(), compraMax: z.number().int().positive(),
  multiplo: z.number().int().positive(),
}).refine((limites) => limites.apuestaMin <= limites.apuestaMax && limites.compraMin <= limites.compraMax,
  { message: "Los mínimos no pueden superar los máximos" });
export type LimitesCantidad = z.infer<typeof LimitesCantidadSchema>;
export const LIMITES_CANTIDAD = {
  apuestaMin: 10, apuestaMax: 500, compraMin: 10, compraMax: 5000, multiplo: 10,
} as const satisfies LimitesCantidad;
export const CantidadApuestaSchema = z.number().int().min(LIMITES_CANTIDAD.apuestaMin)
  .max(LIMITES_CANTIDAD.apuestaMax).multipleOf(LIMITES_CANTIDAD.multiplo);
export const CantidadCompraSchema = z.number().int().min(LIMITES_CANTIDAD.compraMin)
  .max(LIMITES_CANTIDAD.compraMax).multipleOf(LIMITES_CANTIDAD.multiplo);
const peticion = { reqId: ReqIdSchema.optional() };
const credenciales = { usuario: UsuarioNombreSchema, contrasena: z.string().min(6).max(72) };

/**
 * Construye el contrato entrante con los límites centrales del servidor.
 * @param limites - Configuración de apuestas/compras; por defecto los valores del PLAN.
 * @returns Unión discriminada sin dependencias de código del servidor o del navegador.
 * @throws ZodError Si la configuración no contiene límites enteros positivos coherentes.
 */
export function crearMensajeClienteSchema(limites: LimitesCantidad = LIMITES_CANTIDAD) {
  const valores = LimitesCantidadSchema.parse(limites);
  const apuesta = z.number().int().min(valores.apuestaMin).max(valores.apuestaMax).multipleOf(valores.multiplo);
  const compra = z.number().int().min(valores.compraMin).max(valores.compraMax).multipleOf(valores.multiplo);
  return z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("registro"), ...peticion, ...credenciales }),
  z.strictObject({ type: z.literal("login"), ...peticion, ...credenciales }),
  z.strictObject({ type: z.literal("reanudar"), ...peticion, token: TokenSchema }),
  z.strictObject({ type: z.literal("logout"), ...peticion }),
  z.strictObject({ type: z.literal("lobby.listar"), ...peticion }),
  z.strictObject({ type: z.literal("mesa.unirse"), ...peticion, mesaId: MesaIdSchema }),
  z.strictObject({ type: z.literal("mesa.salir"), ...peticion }),
  z.strictObject({ type: z.literal("apostar"), ...peticion, cantidad: apuesta }),
  z.strictObject({ type: z.literal("pedir"), ...peticion }),
  z.strictObject({ type: z.literal("plantarse"), ...peticion }),
  z.strictObject({ type: z.literal("billetera.consultar"), ...peticion }),
  z.strictObject({ type: z.literal("fichas.comprar"), ...peticion, cantidad: compra, clave: UuidSchema }),
  z.strictObject({ type: z.literal("tienda.catalogo"), ...peticion }),
  z.strictObject({ type: z.literal("tienda.comprar"), ...peticion, articuloId: ArticuloIdSchema }),
  z.strictObject({ type: z.literal("inventario.listar"), ...peticion }),
  z.strictObject({ type: z.literal("inventario.equipar"), ...peticion, articuloId: ArticuloIdSchema }),
  z.strictObject({ type: z.literal("movimientos.listar"), ...peticion,
    limite: z.number().int().min(1).max(100).default(50), antesDe: MovimientoIdSchema.optional() }),
  z.strictObject({ type: z.literal("ping"), ...peticion }),
  ]);
}
export const MensajeClienteSchema = crearMensajeClienteSchema();

export const ErrorMensajeSchema = z.strictObject({
  type: z.literal("error"), ...peticion, codigo: CodigoErrorSchema, mensaje: z.string().min(1),
});
export const MensajeServidorSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bienvenida"), ...peticion, conectados: EnteroNoNegativoSchema }),
  z.strictObject({ type: z.literal("sesion"), ...peticion, token: TokenSchema,
    usuario: UsuarioVistaSchema, billetera: BilleteraEstadoSchema,
    equipado: EquipadoSchema, mesaId: MesaIdSchema.nullable() }),
  MesaEstadoSchema.safeExtend({ type: z.literal("mesa.estado"), ...peticion }),
  z.strictObject({ type: z.literal("lobby"), ...peticion, mesas: z.array(MesaResumenSchema) }),
  z.strictObject({ type: z.literal("ronda.resultado"), ...peticion, rondaId: UuidSchema,
    dealer: z.strictObject({ cartas: z.array(CartaVisibleSchema), total: EnteroNoNegativoSchema }),
    resultados: z.array(ResultadoJugadorSchema) }),
  BilleteraEstadoSchema.safeExtend({ type: z.literal("billetera"), ...peticion }),
  z.strictObject({ type: z.literal("catalogo"), ...peticion, articulos: z.array(ArticuloCatalogoSchema) }),
  InventarioEstadoSchema.extend({ type: z.literal("inventario"), ...peticion }),
  z.strictObject({ type: z.literal("movimientos"), ...peticion, items: z.array(MovimientoSchema), hayMas: z.boolean() }),
  z.strictObject({ type: z.literal("ok"), ...peticion }),
  ErrorMensajeSchema,
  z.strictObject({ type: z.literal("pong"), ...peticion, t: EnteroNoNegativoSchema }),
]);

export type MensajeCliente = z.infer<typeof MensajeClienteSchema>;
/** Entrada antes de aplicar el valor por defecto de movimientos.listar.limite. */
export type EntradaMensajeCliente = z.input<typeof MensajeClienteSchema>;
export type MensajeServidor = z.infer<typeof MensajeServidorSchema>;
export type MensajeError = z.infer<typeof ErrorMensajeSchema>;

/**
 * Clasifica una validación fallida sin implementar el transporte o el enrutador.
 * @param entrada - JSON ya decodificado que no pasó MensajeClienteSchema.
 * @param error - Error devuelto por safeParse, con las rutas inválidas.
 * @returns Mensaje público con reqId únicamente si su formato es válido.
 */
export function crearErrorValidacion(entrada: unknown, error: z.ZodError): MensajeError {
  const objeto = typeof entrada === "object" && entrada !== null ? entrada : {};
  // La estructura mal formada tiene prioridad; una cantidad presente pero inválida
  // recibe el código requerido por T-20, incluso para cadenas como "abc".
  const esCantidad = "type" in objeto && (objeto.type === "apostar" || objeto.type === "fichas.comprar") &&
    "cantidad" in objeto && error.issues.every((problema) => problema.path[0] === "cantidad");
  const codigo = esCantidad ? "CANTIDAD_INVALIDA" : "MENSAJE_INVALIDO";
  const reqId = "reqId" in objeto ? ReqIdSchema.safeParse(objeto.reqId) : null;
  return { type: "error", codigo, mensaje: MENSAJES_ERROR[codigo],
    ...(reqId?.success ? { reqId: reqId.data } : {}) };
}
