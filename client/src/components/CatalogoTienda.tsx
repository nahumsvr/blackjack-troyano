/**
 * Catálogo de la tienda (solo lectura) dentro del menú lateral: avatares, reversos y temas
 * con su precio en fichas y cuáles ya posee el usuario. Se recarga al montarse (al abrir la
 * pestaña), igual que el historial. El alcance de entrega está en documentation/PLAN.md §10.
 */
import type { ArticuloCatalogo } from "@blackjack/shared";
import { useEffect, type ReactNode } from "react";
import { useJuego } from "../state/store";

/** Título de cada grupo, en el orden en que se muestran. */
const TITULO_TIPO: Record<ArticuloCatalogo["tipo"], string> = { avatar: "Avatares", reverso: "Reversos", tema: "Temas" };

/**
 * Formatea el precio de un artículo.
 * @param precio - Precio entero en fichas.
 * @returns «Gratis» o el precio con separador de miles.
 */
function textoPrecio(precio: number): string {
  return precio === 0 ? "Gratis" : `${precio.toLocaleString("es-MX")} fichas`;
}

/**
 * Lista del catálogo agrupada por tipo.
 * @returns Catálogo de la tienda.
 */
export function CatalogoTienda(): ReactNode {
  const { estado, acciones } = useJuego();
  const conectado = estado.conexion === "conectado";

  useEffect(() => {
    if (conectado) void acciones.cargarCatalogo();
  }, [acciones, conectado]);

  if (estado.catalogo === null) return <p className="text-emerald-300">Cargando…</p>;
  const catalogo = estado.catalogo;

  return (
    <div className="flex flex-col gap-4">
      {(Object.keys(TITULO_TIPO) as ArticuloCatalogo["tipo"][]).map((tipo) => {
        const articulos = catalogo.filter((articulo) => articulo.tipo === tipo);
        if (articulos.length === 0) return null;
        return (
          <section key={tipo}>
            <h3 className="mb-1 text-sm font-semibold text-amber-300">{TITULO_TIPO[tipo]}</h3>
            <ul className="flex flex-col divide-y divide-emerald-800">
              {articulos.map((articulo) => (
                <li key={articulo.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{articulo.nombre}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className="text-emerald-300">{textoPrecio(articulo.precio)}</span>
                    {articulo.poseido && <span className="rounded bg-amber-400 px-1.5 text-xs font-semibold text-emerald-950">Poseído</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-emerald-300">La compra llega en una versión posterior.</p>
    </div>
  );
}
