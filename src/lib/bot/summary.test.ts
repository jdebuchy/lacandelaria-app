import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS_DRAFT } from "./address";
import type { CatalogVariant } from "./catalog";
import { EMPTY_ORDER_DRAFT, type OrderDraft } from "./order-draft";
import {
  avisoDePedidoCreado,
  mensajeParaRetomar,
  resumenPedido,
  totalDelPedido
} from "./summary";

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
  familyName: "Nueces",
  label: "500g",
  cashPrice: 24000,
  transferPrice: 24000
};

function draft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    ...EMPTY_ORDER_DRAFT,
    metodoPago: "cash",
    direccion: {
      ...EMPTY_ADDRESS_DRAFT,
      etiqueta: "Castex 3342",
      addressLine2: "4B",
      googlePlaceId: "place-1"
    },
    ...overrides
  };
}

describe("resumenPedido", () => {
  it("dice que se lleva, a donde va y cuanto sale", () => {
    const resumen = resumenPedido([{ variante: CAJA, cantidad: 1 }], draft());

    expect(resumen).toBe("Te anoto caja de 4kg a Castex 3342 4B, 25 mil en efectivo. Confirmo así?");
  });

  it("suma el upsell al resumen y al total", () => {
    const resumen = resumenPedido(
      [
        { variante: CAJA, cantidad: 2 },
        { variante: NUECES, cantidad: 1 }
      ],
      draft()
    );

    expect(resumen).toContain("2 x caja de 4kg y 500g de nueces");
    expect(resumen).toContain("74 mil");
  });

  // El precio del resumen tiene que ser el que el cliente va a pagar, no el de
  // lista: le dijimos efectivo y efectivo es lo que espera.
  it("cotiza segun la forma de pago elegida", () => {
    expect(totalDelPedido([{ variante: CAJA, cantidad: 1 }], "cash")).toBe(25000);
    expect(totalDelPedido([{ variante: CAJA, cantidad: 1 }], "transfer")).toBe(30000);
  });

  it("no inventa una direccion que no hay", () => {
    const sinDireccion = resumenPedido(
      [{ variante: CAJA, cantidad: 1 }],
      draft({ direccion: EMPTY_ADDRESS_DRAFT })
    );

    expect(sinDireccion).not.toContain(" a ,");
    expect(sinDireccion).toContain("25 mil en efectivo");
  });
});

describe("avisoDePedidoCreado", () => {
  it("saluda por el nombre y da el numero de pedido", () => {
    expect(avisoDePedidoCreado(124, "Pepe")).toBe(
      "Listo Pepe, te lo anoté (pedido #124). Te avisamos cuando salga el reparto"
    );
  });

  it("funciona igual sin nombre ni numero", () => {
    expect(avisoDePedidoCreado(null, null)).toBe(
      "Listo, te lo anoté. Te avisamos cuando salga el reparto"
    );
  });
});

describe("mensajeParaRetomar", () => {
  const aMedias = draft({ cantidad: 2, nombre: "Pepe" });

  // No es un menu de dos opciones: es una frase que ya empuja para adelante, y
  // si el cliente queria otra cosa lo dice solo.
  it("a las pocas horas retoma y avanza", () => {
    expect(mensajeParaRetomar(aMedias, "dormido")).toBe(
      "Hola Pepe! Te decía, quedamos en 2 cajas para Castex 3342 4B. Seguimos con eso?"
    );
  });

  // Al dia siguiente ya no es un pedido en curso: se ofrece.
  it("al dia siguiente lo ofrece en vez de darlo por hecho", () => {
    expect(mensajeParaRetomar(aMedias, "sugerencia")).toBe(
      "Hola Pepe! La última vez estabas por llevar 2 cajas para Castex 3342 4B. Arrancamos con eso?"
    );
  });

  it("funciona sin nombre y con una sola caja", () => {
    expect(mensajeParaRetomar(draft({ cantidad: 1 }), "dormido")).toBe(
      "Hola! Te decía, quedamos en 1 caja para Castex 3342 4B. Seguimos con eso?"
    );
  });

  it("no inventa un resumen que no tiene", () => {
    const vacio = draft({ direccion: EMPTY_ADDRESS_DRAFT });

    expect(mensajeParaRetomar(vacio, "dormido")).toBe(
      "Hola! Seguimos con el pedido que estábamos armando?"
    );
  });
});
