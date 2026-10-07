/** Datos públicos de juego y economía; los tipos se infieren de esquemas Zod. */
import { z } from "zod";

/** Enteros representables exactamente en JSON; convertir bigint con comprobación. */
export const EnteroNoNegativoSchema = z.number().int().min(0);
/** Id numérico de `usuarios.id`. */
export const UsuarioIdSchema = z.number().int().positive();
/** Nombre de usuario: 3–20 caracteres, solo letras ASCII, dígitos y guion bajo. */
export const UsuarioNombreSchema = z.string().min(3).max(20).regex(/^[A-Za-z0-9_]+$/);
/** Id estable de `articulos.id` (por ejemplo `avatar_robot`). */
export const ArticuloIdSchema = z.string().min(1).max(40);
/** bigserial viaja como texto para no perder precisión en filas o cursores. */
export const MovimientoIdSchema = z.string().max(19).regex(/^[1-9][0-9]*$/)
  .refine((id) => id.length < 19 || id <= "9223372036854775807", {
    message: "El id debe caber en un bigint positivo de PostgreSQL",
  });
/** Id de mesa definido en `config.ts` (por ejemplo `mesa-1`). */
export const MesaIdSchema = z.string().min(1).max(20);
/** Fecha ISO 8601 con zona horaria explícita. */
export const FechaISOSchema = z.iso.datetime({ offset: true });
/** Fases de la máquina de estados de la mesa (PLAN §6), en orden de una ronda. */
export const FaseMesaSchema = z.enum(["ESPERANDO", "APUESTAS", "REPARTO", "TURNOS", "DEALER", "PAGOS"]);
/** Estado de un asiento dentro de la ronda actual. */
export const EstadoJugadorSchema = z.enum([
  "ESPERANDO_RONDA", "SIN_APUESTA", "APOSTADO", "JUGANDO", "PLANTADO", "PASADO", "BLACKJACK",
]);
/** Resultado de un jugador frente al dealer al liquidar la ronda. */
export const ResultadoSchema = z.enum(["blackjack", "gana", "empate", "pierde", "pasado"]);
/** Carta descubierta: palo y rango. */
export const CartaVisibleSchema = z.strictObject({
  palo: z.enum(["♠", "♥", "♦", "♣"]),
  rango: z.enum(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]),
});
/** strictObject impide enviar palo/rango junto a oculta:true. */
export const CartaVistaSchema = z.union([CartaVisibleSchema, z.strictObject({ oculta: z.literal(true) })]);
/** Artículos cosméticos equipados, uno por tipo. */
export const EquipadoSchema = z.strictObject({
  avatar: ArticuloIdSchema, reverso: ArticuloIdSchema, tema: ArticuloIdSchema,
});
/** Datos públicos del usuario autenticado. */
export const UsuarioVistaSchema = z.strictObject({ id: UsuarioIdSchema, usuario: UsuarioNombreSchema });
/** Saldos del usuario y límite diario de compra de fichas; `reinicioEn` es la próxima medianoche CDMX. */
export const BilleteraEstadoSchema = z.strictObject({
  dinero: EnteroNoNegativoSchema, fichas: EnteroNoNegativoSchema,
  compradoHoy: EnteroNoNegativoSchema, disponibleHoy: EnteroNoNegativoSchema,
  limiteDiario: EnteroNoNegativoSchema, reinicioEn: FechaISOSchema,
}).refine((estado) => estado.disponibleHoy === Math.max(0, estado.limiteDiario - estado.compradoHoy), {
  message: "El disponible diario debe coincidir con el límite menos lo comprado",
});
/** Artículo del catálogo de la tienda; el precio está en fichas. */
export const ArticuloSchema = z.strictObject({
  id: ArticuloIdSchema, tipo: z.enum(["avatar", "reverso", "tema"]),
  nombre: z.string().min(1).max(60), precio: EnteroNoNegativoSchema,
});
/** Artículo del catálogo con la marca de si el usuario ya lo posee. */
export const ArticuloCatalogoSchema = ArticuloSchema.extend({ poseido: z.boolean() });
/** Artículos poseídos y los equipados actualmente. */
export const InventarioEstadoSchema = z.strictObject({ articulos: z.array(ArticuloSchema), equipado: EquipadoSchema });
/** Fila del libro contable `movimientos`, con los saldos resultantes después de aplicarla. */
export const MovimientoSchema = z.strictObject({
  id: MovimientoIdSchema,
  tipo: z.enum(["registro", "compra_fichas", "apuesta", "pago", "compra_articulo"]),
  deltaDinero: z.number().int(), deltaFichas: z.number().int(),
  dineroDespues: EnteroNoNegativoSchema, fichasDespues: EnteroNoNegativoSchema,
  referencia: z.string().max(80).nullable(), creadoEn: FechaISOSchema,
}).refine((movimiento) => movimiento.deltaDinero !== 0 || movimiento.deltaFichas !== 0, {
  message: "Un movimiento debe cambiar al menos un saldo",
});
/** Jugador sentado en una mesa, tal como lo ven los demás. */
export const AsientoSchema = z.strictObject({
  indice: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  usuarioId: UsuarioIdSchema, usuario: UsuarioNombreSchema,
  avatar: ArticuloIdSchema, reverso: ArticuloIdSchema, conectado: z.boolean(),
  apuesta: EnteroNoNegativoSchema, cartas: z.array(CartaVisibleSchema),
  total: EnteroNoNegativoSchema, estado: EstadoJugadorSchema,
});
/** Mano del dealer como se publica; `total` es null mientras haya una carta oculta. */
export const DealerVistaSchema = z.strictObject({
  cartas: z.array(CartaVistaSchema), total: EnteroNoNegativoSchema.nullable(),
}).refine((dealer) => !dealer.cartas.some((carta) => "oculta" in carta) || dealer.total === null, {
  message: "El total del dealer debe ser null mientras haya una carta oculta",
});
/** Resumen de una mesa para el lobby. */
export const MesaResumenSchema = z.strictObject({
  id: MesaIdSchema, nombre: z.string().min(1), ocupados: z.number().int().min(0).max(5),
  capacidad: z.literal(5), fase: FaseMesaSchema,
});
/** Snapshot completo de una mesa. Rechaza snapshots que revelen la carta oculta antes de `DEALER`. */
export const MesaEstadoSchema = z.strictObject({
  id: MesaIdSchema, nombre: z.string().min(1), fase: FaseMesaSchema,
  finEn: EnteroNoNegativoSchema.nullable(), turnoDe: UsuarioIdSchema.nullable(),
  dealer: DealerVistaSchema, asientos: z.array(AsientoSchema.nullable()).length(5),
}).superRefine((mesa, contexto) => {
  for (const [indice, asiento] of mesa.asientos.entries()) {
    if (asiento !== null && asiento.indice !== indice) {
      contexto.addIssue({ code: "custom", path: ["asientos", indice, "indice"], message: "El índice debe coincidir con la posición del asiento" });
    }
  }
  const revelado = mesa.fase === "DEALER" || mesa.fase === "PAGOS";
  if (!revelado && mesa.dealer.cartas.filter((carta) => !("oculta" in carta)).length > 1) {
    contexto.addIssue({ code: "custom", path: ["dealer", "cartas"], message: "La segunda carta del dealer debe permanecer oculta antes de DEALER" });
  }
  if (revelado && mesa.dealer.cartas.some((carta) => "oculta" in carta)) {
    contexto.addIssue({ code: "custom", path: ["dealer", "cartas"], message: "En DEALER y PAGOS todas las cartas deben estar reveladas" });
  }
});
/** Resultado y pago de un jugador en `ronda.resultado`. */
export const ResultadoJugadorSchema = z.strictObject({
  usuarioId: UsuarioIdSchema, resultado: ResultadoSchema,
  apuesta: z.number().int().positive(), pago: EnteroNoNegativoSchema,
});

/** Tipos TypeScript inferidos de los esquemas anteriores; no se declaran a mano. */
export type FaseMesa = z.infer<typeof FaseMesaSchema>;
export type EstadoJugador = z.infer<typeof EstadoJugadorSchema>;
export type Resultado = z.infer<typeof ResultadoSchema>;
export type CartaVisible = z.infer<typeof CartaVisibleSchema>;
export type CartaVista = z.infer<typeof CartaVistaSchema>;
export type Equipado = z.infer<typeof EquipadoSchema>;
export type UsuarioVista = z.infer<typeof UsuarioVistaSchema>;
export type BilleteraEstado = z.infer<typeof BilleteraEstadoSchema>;
export type Articulo = z.infer<typeof ArticuloSchema>;
export type ArticuloCatalogo = z.infer<typeof ArticuloCatalogoSchema>;
export type InventarioEstado = z.infer<typeof InventarioEstadoSchema>;
export type Movimiento = z.infer<typeof MovimientoSchema>;
export type Asiento = z.infer<typeof AsientoSchema>;
export type DealerVista = z.infer<typeof DealerVistaSchema>;
export type MesaResumen = z.infer<typeof MesaResumenSchema>;
export type MesaEstado = z.infer<typeof MesaEstadoSchema>;
export type ResultadoJugador = z.infer<typeof ResultadoJugadorSchema>;
