/** Catálogo, compras, inventario e historial; no publica ni conoce las mesas. */
import {
  ErrorJuego, MovimientoIdSchema, type Articulo, type ArticuloCatalogo, type BilleteraEstado,
  type InventarioEstado, type Movimiento,
} from "@blackjack/shared";
import type { SQL } from "bun";
import { enTransaccion } from "../db/conexion";
import { bloquearUsuario, consultarEstado, enteroSeguro, registrarMovimiento } from "./consultas";

/** Datos de la compra para responder inventario y publicar billetera al usuario. */
export type CompraArticulo = { inventario: InventarioEstado; billetera: BilleteraEstado };
/** Página por id descendente; antesDe se obtiene del último item recibido. */
export type PaginaMovimientos = { items: Movimiento[]; hayMas: boolean };
type FilaArticulo = { id: string; tipo: Articulo["tipo"]; nombre: string; precio: number };

async function leerInventario(sql: SQL, usuarioId: number): Promise<InventarioEstado> {
  const [usuario] = await sql<{ avatar: string | null; reverso: string | null; tema: string | null }[]>`
    SELECT avatar_id AS avatar, reverso_id AS reverso, tema_id AS tema
    FROM usuarios WHERE id = ${usuarioId}
  `;
  if (!usuario) throw new ErrorJuego("NO_AUTENTICADO");
  // Registro debe entregar y equipar los tres básicos en su propia transacción.
  if (!usuario.avatar || !usuario.reverso || !usuario.tema) throw new ErrorJuego("ERROR_INTERNO");
  const articulos = await sql<FilaArticulo[]>`
    SELECT a.id, a.tipo, a.nombre, a.precio FROM inventario i
    JOIN articulos a ON a.id = i.articulo_id WHERE i.usuario_id = ${usuarioId}
    ORDER BY a.tipo, a.precio, a.id
  `;
  return { articulos: [...articulos], equipado: { avatar: usuario.avatar, reverso: usuario.reverso, tema: usuario.tema } };
}

/** Servicio transaccional listo para los handlers WebSocket de Hector. */
export class Tienda {
  /**
   * Recibe la conexión administrada por el servidor.
   * @param conexion - Pool PostgreSQL con schema y seed aplicados.
   */
  constructor(private readonly conexion: SQL) {}

  /**
   * Lista artículos activos y su posesión para este usuario.
   * @param usuarioId - Usuario autenticado.
   * @returns Catálogo ordenado por tipo, precio e id.
   * @throws ErrorJuego NO_AUTENTICADO | ERROR_INTERNO.
   */
  async catalogo(usuarioId: number): Promise<ArticuloCatalogo[]> {
    return enTransaccion(this.conexion, async (sql) => {
      await bloquearUsuario(sql, usuarioId);
      const filas = await sql<ArticuloCatalogo[]>`
        SELECT a.id, a.tipo, a.nombre, a.precio,
          EXISTS (SELECT 1 FROM inventario i WHERE i.usuario_id = ${usuarioId}
            AND i.articulo_id = a.id) AS poseido
        FROM articulos a WHERE a.activo ORDER BY a.tipo, a.precio, a.id
      `;
      return [...filas];
    });
  }

  /**
   * Compra un artículo una vez y registra el débito en el mismo commit.
   * @param usuarioId - Comprador autenticado.
   * @param articuloId - Artículo activo del catálogo.
   * @returns Inventario y billetera consistentes tras la compra.
   * @throws ErrorJuego ARTICULO_NO_EXISTE | YA_POSEIDO | FICHAS_INSUFICIENTES | NO_AUTENTICADO | ERROR_INTERNO.
   */
  async comprar(usuarioId: number, articuloId: string): Promise<CompraArticulo> {
    return enTransaccion(this.conexion, async (sql) => {
      const saldos = await bloquearUsuario(sql, usuarioId);
      const [articulo] = await sql<FilaArticulo[]>`
        SELECT id, tipo, nombre, precio FROM articulos WHERE id = ${articuloId} AND activo
      `;
      if (!articulo) throw new ErrorJuego("ARTICULO_NO_EXISTE");
      const [poseido] = await sql<{ articulo_id: string }[]>`
        SELECT articulo_id FROM inventario WHERE usuario_id = ${usuarioId} AND articulo_id = ${articuloId}
      `;
      if (poseido) throw new ErrorJuego("YA_POSEIDO");
      if (saldos.fichas < articulo.precio) throw new ErrorJuego("FICHAS_INSUFICIENTES");
      await sql`INSERT INTO inventario (usuario_id, articulo_id) VALUES (${usuarioId}, ${articuloId})`;
      // Los gratuitos no producen movimientos de importe cero.
      if (articulo.precio > 0) {
        saldos.fichas -= articulo.precio;
        await registrarMovimiento(sql, usuarioId, "compra_articulo", saldos, 0,
          -articulo.precio, `articulo:${articuloId}`);
      }
      return { inventario: await leerInventario(sql, usuarioId), billetera: await consultarEstado(sql, usuarioId) };
    });
  }

  /**
   * Lee los artículos poseídos y los tres equipados en un snapshot consistente.
   * @param usuarioId - Usuario autenticado.
   * @returns Inventario; incluye artículos poseídos que ya no estén a la venta.
   * @throws ErrorJuego NO_AUTENTICADO | ERROR_INTERNO si el registro no equipó los básicos.
   */
  async inventario(usuarioId: number): Promise<InventarioEstado> {
    return enTransaccion(this.conexion, async (sql) => {
      await bloquearUsuario(sql, usuarioId);
      return leerInventario(sql, usuarioId);
    });
  }

  /**
   * Pagina exclusivamente movimientos del usuario por id descendente.
   * Usa una fila adicional para hayMas; conserva bigserial como texto.
   * @param usuarioId - Usuario autenticado.
   * @param limite - Filas visibles entre 1 y 100; por defecto 50.
   * @param antesDe - Id exclusivo de la última fila de la página anterior.
   * @returns Página con referencias y fechas ISO, sin clave de idempotencia.
   * @throws ErrorJuego MENSAJE_INVALIDO | NO_AUTENTICADO | ERROR_INTERNO.
   */
  async listarMovimientos(usuarioId: number, limite = 50, antesDe?: string): Promise<PaginaMovimientos> {
    if (!Number.isInteger(limite) || limite < 1 || limite > 100
      || (antesDe !== undefined && !MovimientoIdSchema.safeParse(antesDe).success)) {
      throw new ErrorJuego("MENSAJE_INVALIDO");
    }
    return enTransaccion(this.conexion, async (sql) => {
      await bloquearUsuario(sql, usuarioId);
      const filas = await sql<{
        id: string; tipo: Movimiento["tipo"]; delta_dinero: string; delta_fichas: string;
        dinero_despues: string; fichas_despues: string; referencia: string | null; creado_en: Date;
      }[]>`
        SELECT id::text, tipo, delta_dinero::text, delta_fichas::text,
          dinero_despues::text, fichas_despues::text, referencia, creado_en
        FROM movimientos WHERE usuario_id = ${usuarioId}
          AND (${antesDe ?? null}::bigint IS NULL OR id < ${antesDe ?? null}::bigint)
        ORDER BY id DESC LIMIT ${limite + 1}
      `;
      return {
        items: filas.slice(0, limite).map((fila) => ({
          id: fila.id, tipo: fila.tipo, deltaDinero: enteroSeguro(fila.delta_dinero),
          deltaFichas: enteroSeguro(fila.delta_fichas), dineroDespues: enteroSeguro(fila.dinero_despues),
          fichasDespues: enteroSeguro(fila.fichas_despues), referencia: fila.referencia,
          creadoEn: fila.creado_en.toISOString(),
        })),
        hayMas: filas.length > limite,
      };
    });
  }
}
