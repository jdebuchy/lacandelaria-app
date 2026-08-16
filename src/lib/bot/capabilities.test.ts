import { describe, expect, it } from "vitest";
import { canHandleIntent, deriveCapabilities, NO_CAPABILITIES } from "./capabilities";

const CONTEXTO_COMPLETO = {
  can_answer: { delivery_zones: true, prices: true, products: true },
  delivery_zones: ["Capital Federal (CABA)", "Gran Buenos Aires (GBA)"],
  products: [{ producto: "Paltas", presentacion: "Caja de 4kg", precio_efectivo: 25000 }]
};

describe("deriveCapabilities", () => {
  it("habilita todo con el contexto completo", () => {
    expect(deriveCapabilities(CONTEXTO_COMPLETO)).toEqual({
      deliveryZones: true,
      prices: true,
      products: true
    });
  });

  // El contexto que venia por defecto tenia delivery_zones vacio: el bot derivaba
  // toda pregunta de entrega a humano y el cliente quedaba esperando.
  it("no habilita zonas si la lista esta vacia", () => {
    const capacidades = deriveCapabilities({ ...CONTEXTO_COMPLETO, delivery_zones: [] });
    expect(capacidades.deliveryZones).toBe(false);
  });

  it("no habilita precios sin productos cargados", () => {
    const capacidades = deriveCapabilities({ ...CONTEXTO_COMPLETO, products: [] });
    expect(capacidades.prices).toBe(false);
    expect(capacidades.products).toBe(false);
  });

  // El doble candado: aunque haya datos, si la bandera no esta puesta no contesta.
  it("respeta la bandera aunque haya datos", () => {
    const capacidades = deriveCapabilities({ ...CONTEXTO_COMPLETO, can_answer: {} });
    expect(capacidades).toEqual(NO_CAPABILITIES);
  });

  it("un contexto vacio no habilita nada", () => {
    expect(deriveCapabilities({})).toEqual(NO_CAPABILITIES);
  });

  it("no se rompe con un contexto con formas raras", () => {
    expect(deriveCapabilities({ delivery_zones: "CABA", products: null, can_answer: true })).toEqual(
      NO_CAPABILITIES
    );
  });
});

describe("canHandleIntent", () => {
  it("ata cada pregunta al dato que necesita", () => {
    const soloZonas = { deliveryZones: true, prices: false, products: false };
    expect(canHandleIntent("ask_delivery", soloZonas)).toBe(true);
    expect(canHandleIntent("ask_price", soloZonas)).toBe(false);
    expect(canHandleIntent("ask_products", soloZonas)).toBe(false);
  });

  // Los intents que no dependen del catalogo siguen su curso normal.
  it("no bloquea los intents que no dependen del contexto", () => {
    for (const intent of ["buy", "confirm_order", "satisfied", "opt_out"] as const) {
      expect(canHandleIntent(intent, NO_CAPABILITIES)).toBe(true);
    }
  });
});
