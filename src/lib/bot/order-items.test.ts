import { describe, expect, it } from "vitest";
import { precioEnChat, type CatalogVariant } from "./catalog";
import { buildVariantQuestion, resolveVariant } from "./order-items";

const CAJA_GRANDE: CatalogVariant = {
  id: "caja-4kg",
  familyId: "paltas",
  familyName: "Paltas",
  label: "Caja de 4kg",
  cashPrice: 25000,
  transferPrice: 30000
};

const CAJA_CHICA: CatalogVariant = {
  id: "caja-4kg-chica",
  familyId: "paltas",
  familyName: "Paltas",
  label: "Caja de 4kg chica",
  cashPrice: 20000,
  transferPrice: 25000
};

const NUECES_500: CatalogVariant = {
  id: "nueces-500",
  familyId: "nueces",
  familyName: "Nueces Mariposa Extra Light",
  label: "500g",
  cashPrice: 24000,
  transferPrice: 24000
};

const CATALOGO = [CAJA_GRANDE, CAJA_CHICA, NUECES_500];

describe("resolveVariant", () => {
  it("toma la presentacion cuando el cliente la nombra", () => {
    expect(resolveVariant("Paltas Caja de 4kg", CATALOGO)).toEqual({
      tipo: "unica",
      variante: CAJA_GRANDE
    });
  });

  // El error que cobra de mas: "caja de 4kg chica" contiene "caja de 4kg".
  it("prefiere el label mas especifico", () => {
    expect(resolveVariant("una caja de 4kg chica", CATALOGO)).toEqual({
      tipo: "unica",
      variante: CAJA_CHICA
    });
  });

  it("con una sola presentacion en la familia no pregunta", () => {
    expect(resolveVariant("nueces", CATALOGO)).toEqual({ tipo: "unica", variante: NUECES_500 });
  });

  it("si la familia tiene varias y no hay default, pregunta", () => {
    expect(resolveVariant("paltas", CATALOGO)).toEqual({
      tipo: "ambigua",
      opciones: [CAJA_GRANDE, CAJA_CHICA]
    });
  });

  it("usa la variante por defecto del catalogo cuando la hay", () => {
    expect(resolveVariant("paltas", CATALOGO, "caja-4kg")).toEqual({
      tipo: "unica",
      variante: CAJA_GRANDE
    });
  });

  // Sin texto el pedido es del producto principal, no de cualquier cosa.
  it("sin texto usa el producto principal", () => {
    expect(resolveVariant(null, CATALOGO, "caja-4kg")).toEqual({
      tipo: "unica",
      variante: CAJA_GRANDE
    });
    expect(resolveVariant(null, CATALOGO)).toEqual({ tipo: "ninguna" });
  });

  it("no inventa un producto que no esta en el catalogo", () => {
    expect(resolveVariant("bananas", CATALOGO)).toEqual({ tipo: "ninguna" });
    expect(resolveVariant("paltas", [])).toEqual({ tipo: "ninguna" });
  });

  // "la chica" es como lo dice la gente. Sin esto caia en la caja grande, que
  // sale 5 mil mas.
  it("entiende la palabra que distingue una variante de la otra", () => {
    expect(resolveVariant("la chica", CATALOGO, "caja-4kg")).toEqual({
      tipo: "unica",
      variante: CAJA_CHICA
    });
    expect(resolveVariant("una caja chica", CATALOGO, "caja-4kg")).toEqual({
      tipo: "unica",
      variante: CAJA_CHICA
    });
  });

  it("tolera el singular y los acentos", () => {
    expect(resolveVariant("una palta", CATALOGO).tipo).toBe("ambigua");
    expect(resolveVariant("castañas", CATALOGO)).toEqual({ tipo: "ninguna" });
  });
});

describe("buildVariantQuestion", () => {
  it("numera las opciones para que el cliente elija", () => {
    expect(buildVariantQuestion([CAJA_GRANDE, CAJA_CHICA])).toBe(
      "Cuál querés?\n1. Caja de 4kg\n2. Caja de 4kg chica"
    );
  });
});

describe("precioEnChat", () => {
  // El equipo escribe "25 mil", nunca "$25.000,00".
  it("escribe los precios como los escribe el equipo", () => {
    expect(precioEnChat(25000)).toBe("25 mil");
    expect(precioEnChat(30000)).toBe("30 mil");
    expect(precioEnChat(27600)).toBe("$27.600");
    expect(precioEnChat(500)).toBe("$500");
  });
});
