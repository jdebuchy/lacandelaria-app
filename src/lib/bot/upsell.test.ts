import { describe, expect, it } from "vitest";
import type { CatalogVariant } from "./catalog";
import { EMPTY_ORDER_DRAFT, type OrderDraft } from "./order-draft";
import { UPSELL_DEFAULT, parseUpsellRules, selectUpsell, type UpsellRules } from "./upsell";

const CAJA: CatalogVariant = {
  id: "caja-4kg",
  familyId: "paltas",
  familyName: "Paltas",
  label: "Caja de 4kg",
  cashPrice: 25000,
  transferPrice: 30000
};

const NUECES: CatalogVariant = {
  id: "nueces-500",
  familyId: "nueces",
  familyName: "Nueces Mariposa Extra Light",
  label: "500g",
  cashPrice: 24000,
  transferPrice: 24000
};

const CATALOGO = [CAJA, NUECES];

const REGLAS: UpsellRules = {
  activo: true,
  mensaje: "aprovechas y sumas {etiqueta} de {presentacion} a {precio}?",
  sugerencias: [{ producto: "Nueces Mariposa Extra Light", presentacion: "500g", etiqueta: "nueces" }]
};

function draft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return { ...EMPTY_ORDER_DRAFT, cantidad: 1, metodoPago: "cash", ...overrides };
}

describe("selectUpsell", () => {
  it("arma el mensaje con el precio del catalogo", () => {
    const elegido = selectUpsell(REGLAS, draft(), CATALOGO, [CAJA.id]);

    expect(elegido?.variante).toEqual(NUECES);
    expect(elegido?.mensaje).toBe("aprovechas y sumas nueces de 500g a 24 mil?");
  });

  // Se ofrece una sola vez: insistir con algo que ya rechazaron molesta.
  it("no vuelve a ofrecer si ya se ofrecio", () => {
    expect(selectUpsell(REGLAS, draft({ upsellOfrecido: true }), CATALOGO, [])).toBeNull();
  });

  it("no ofrece lo que el cliente ya esta llevando", () => {
    expect(selectUpsell(REGLAS, draft(), CATALOGO, [NUECES.id])).toBeNull();
  });

  it("se puede apagar sin tocar codigo", () => {
    expect(selectUpsell({ ...REGLAS, activo: false }, draft(), CATALOGO, [])).toBeNull();
  });

  it("saltea una sugerencia que no esta en el catalogo", () => {
    const conFantasma: UpsellRules = {
      ...REGLAS,
      sugerencias: [{ producto: "Mangos" }, ...REGLAS.sugerencias]
    };

    expect(selectUpsell(conFantasma, draft(), CATALOGO, [])?.variante).toEqual(NUECES);
  });

  it("usa el precio de la forma de pago que eligio el cliente", () => {
    const conCaja: UpsellRules = {
      ...REGLAS,
      sugerencias: [{ producto: "Paltas", presentacion: "Caja de 4kg", etiqueta: "otra caja" }]
    };

    expect(selectUpsell(conCaja, draft({ metodoPago: "cash" }), CATALOGO, [])?.mensaje).toContain(
      "25 mil"
    );
    expect(selectUpsell(conCaja, draft({ metodoPago: "transfer" }), CATALOGO, [])?.mensaje).toContain(
      "30 mil"
    );
  });
});

describe("parseUpsellRules", () => {
  it("usa el default cuando no hay nada cargado", () => {
    expect(parseUpsellRules(null)).toEqual(UPSELL_DEFAULT);
    expect(parseUpsellRules({ cualquier: "cosa" })).toEqual(UPSELL_DEFAULT);
  });

  it("toma lo que hay cargado en commercial_settings", () => {
    const cargado = parseUpsellRules({
      activo: false,
      mensaje: "sumas {etiqueta}?",
      sugerencias: [{ producto: "Mani Tostado" }]
    });

    expect(cargado.activo).toBe(false);
    expect(cargado.sugerencias).toEqual([{ producto: "Mani Tostado" }]);
  });
});
