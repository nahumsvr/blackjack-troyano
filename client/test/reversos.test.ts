/** Pruebas de los diseños del reverso de las cartas. */
import { describe, expect, test } from "bun:test";
import { DISENO_REVERSO, REVERSO_PREDETERMINADO, disenoReverso } from "../src/components/reversos";
import { EQUIPADO_INICIAL, catalogoDemo } from "../src/mock/fixtures";

const REVERSOS_CATALOGO = catalogoDemo().filter((articulo) => articulo.tipo === "reverso").map((articulo) => articulo.id);

describe("disenoReverso", () => {
  test("cada reverso del catálogo tiene un diseño propio", () => {
    expect(REVERSOS_CATALOGO).toHaveLength(5);
    for (const id of REVERSOS_CATALOGO) expect(DISENO_REVERSO[id]).toBeDefined();
  });

  test("los 5 diseños se ven distintos", () => {
    const firmas = REVERSOS_CATALOGO.map((id) => JSON.stringify(disenoReverso(id)));
    expect(new Set(firmas).size).toBe(REVERSOS_CATALOGO.length);
  });

  test("sin id o con un id desconocido se usa el clásico", () => {
    const clasico = disenoReverso(REVERSO_PREDETERMINADO);
    expect(disenoReverso()).toEqual(clasico);
    expect(disenoReverso("reverso_inexistente")).toEqual(clasico);
  });

  test("el predeterminado es el que trae equipado un usuario nuevo", () => {
    expect(REVERSO_PREDETERMINADO).toBe(EQUIPADO_INICIAL.reverso);
  });
});
