import { describe, expect, it } from "vitest";
import {
  buildCatalogFamilies,
  buildOrderItems,
  buildPublicOrderRequestItems,
  buildVariantLookup,
  calculateItemsCount,
  calculateOrderTotal,
  consolidateOrderItems,
  flattenCatalogVariants,
  formatItemsSummary,
  getDefaultSellableVariantId,
  getProductCatalogDbErrorMessage,
  getProductUnitPrice,
  productFamilyMutationSchema
} from "@/lib/products";
import type { ProductFamily, ProductVariant } from "@/lib/types";

const familyId = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const secondVariantId = "33333333-3333-4333-8333-333333333333";
const componentVariantId = "44444444-4444-4444-8444-444444444444";

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: variantId,
    familyId,
    familyName: "Paltas",
    familySlug: "paltas",
    label: "Caja 10kg",
    slug: "caja-10kg",
    description: null,
    cashPrice: 10000,
    transferPrice: 9000,
    active: true,
    displayOrder: 1,
    visibility: "sellable",
    compositionType: "simple",
    isDefault: true,
    components: [],
    ...overrides
  };
}

function family(overrides: Partial<ProductFamily> = {}): ProductFamily {
  return {
    id: familyId,
    name: "Paltas",
    slug: "paltas",
    description: null,
    active: true,
    displayOrder: 1,
    defaultVariantId: variantId,
    variants: [variant()],
    ...overrides
  };
}

describe("products", () => {
  describe("productFamilyMutationSchema", () => {
    const validPayload = {
      name: "Paltas",
      slug: "paltas",
      active: true,
      displayOrder: 1,
      variants: [
        {
          label: "Caja 10kg",
          slug: "caja-10kg",
          cashPrice: 10000,
          transferPrice: 9000,
          active: true,
          displayOrder: 1,
          visibility: "sellable",
          compositionType: "simple",
          isDefault: true,
          components: []
        }
      ]
    };

    it("accepts a valid family mutation", () => {
      expect(productFamilyMutationSchema.safeParse(validPayload).success).toBe(true);
    });

    it("rejects more than one default variant", () => {
      const parsed = productFamilyMutationSchema.safeParse({
        ...validPayload,
        variants: [...validPayload.variants, { ...validPayload.variants[0], slug: "caja-5kg" }]
      });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe("Solo puede haber una variante por defecto.");
    });

    it("rejects families without sellable variants", () => {
      const parsed = productFamilyMutationSchema.safeParse({
        ...validPayload,
        variants: [{ ...validPayload.variants[0], visibility: "internal" }]
      });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.some((issue) => issue.message === "Agrega al menos una variante vendible.")).toBe(
        true
      );
    });

    it("rejects invalid component rules", () => {
      const simpleWithComponents = productFamilyMutationSchema.safeParse({
        ...validPayload,
        variants: [
          {
            ...validPayload.variants[0],
            components: [{ componentVariantId, quantity: 1 }]
          }
        ]
      });
      const bundleWithoutComponents = productFamilyMutationSchema.safeParse({
        ...validPayload,
        variants: [
          {
            ...validPayload.variants[0],
            compositionType: "bundle",
            components: []
          }
        ]
      });

      expect(simpleWithComponents.success).toBe(false);
      expect(bundleWithoutComponents.success).toBe(false);
    });
  });

  it("builds and sorts catalog families with component labels", () => {
    const catalog = buildCatalogFamilies(
      [
        {
          id: familyId,
          name: "Paltas",
          slug: "paltas",
          description: null,
          active: true,
          display_order: 2,
          default_variant_id: secondVariantId
        }
      ],
      [
        {
          id: componentVariantId,
          product_family_id: familyId,
          label: "Unidad",
          slug: "unidad",
          description: null,
          cash_price: 1000,
          transfer_price: 900,
          active: true,
          display_order: 1,
          visibility: "internal",
          composition_type: "simple"
        },
        {
          id: secondVariantId,
          product_family_id: familyId,
          label: "Combo",
          slug: "combo",
          description: null,
          cash_price: 5000,
          transfer_price: 4500,
          active: true,
          display_order: 2,
          visibility: "sellable",
          composition_type: "bundle"
        }
      ],
      [
        {
          bundle_variant_id: secondVariantId,
          component_variant_id: componentVariantId,
          quantity: 5
        }
      ]
    );

    expect(catalog[0]?.variants.map((item) => item.label)).toEqual(["Unidad", "Combo"]);
    expect(catalog[0]?.variants[1]?.isDefault).toBe(true);
    expect(catalog[0]?.variants[1]?.components).toEqual([
      {
        componentVariantId,
        componentFamilyName: "Paltas",
        componentLabel: "Unidad",
        quantity: 5
      }
    ]);
  });

  it("flattens variants and resolves default sellable variants", () => {
    const inactiveDefault = variant({ active: false, id: variantId, isDefault: true });
    const activeSellable = variant({ id: secondVariantId, isDefault: false, label: "Caja 5kg" });

    expect(flattenCatalogVariants([family({ variants: [inactiveDefault, activeSellable] })])).toHaveLength(2);
    expect(getDefaultSellableVariantId(family({ variants: [inactiveDefault, activeSellable] }))).toBe(
      secondVariantId
    );
    expect(getDefaultSellableVariantId(family({ variants: [variant({ active: false })] }))).toBeNull();
  });

  it("builds variant lookups and chooses unit prices by payment method", () => {
    const lookup = buildVariantLookup([family()]);
    const product = lookup.get(variantId);

    expect(product).toMatchObject({
      id: variantId,
      familyName: "Paltas",
      label: "Caja 10kg"
    });
    expect(getProductUnitPrice(product!, "cash")).toBe(10000);
    expect(getProductUnitPrice(product!, "transfer")).toBe(9000);
    expect(getProductUnitPrice(product!, "unknown")).toBe(9000);
  });

  it("consolidates order items by product id", () => {
    expect(
      consolidateOrderItems([
        { productId: variantId, quantity: 1 },
        { productId: secondVariantId, quantity: 2 },
        { productId: variantId, quantity: 3 }
      ])
    ).toEqual([
      { productId: variantId, quantity: 4 },
      { productId: secondVariantId, quantity: 2 }
    ]);
  });

  it("builds order items with snapshots and totals", () => {
    const items = buildOrderItems(buildVariantLookup([family()]), [{ productId: variantId, quantity: 2 }], "cash");

    expect(items).toEqual([
      {
        product_id: variantId,
        product_name_snapshot: "Paltas",
        sales_unit_label_snapshot: "Caja 10kg",
        quantity: 2,
        unit_price: 10000,
        line_total: 20000
      }
    ]);
  });

  it("builds public order request items with price snapshots", () => {
    const items = buildPublicOrderRequestItems(
      buildVariantLookup([family()]),
      [{ productId: variantId, quantity: 2 }],
      "transfer"
    );

    expect(items).toEqual([
      {
        product_id: variantId,
        product_name_snapshot: "Paltas",
        sales_unit_label_snapshot: "Caja 10kg",
        quantity: 2,
        unit_price_snapshot: 9000
      }
    ]);
  });

  it("rejects missing or inactive products when building order items", () => {
    expect(() => buildOrderItems(new Map(), [{ productId: variantId, quantity: 1 }], "cash")).toThrow(
      "Producto invalido o inactivo."
    );
    expect(() =>
      buildPublicOrderRequestItems(
        buildVariantLookup([family({ variants: [variant({ active: false })] })]),
        [{ productId: variantId, quantity: 1 }],
        "cash"
      )
    ).toThrow("Producto invalido o inactivo.");
  });

  it("calculates item counts, order totals and item summaries", () => {
    expect(calculateItemsCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
    expect(calculateOrderTotal([{ line_total: 1000 }, { line_total: 2500 }])).toBe(3500);
    expect(
      formatItemsSummary([
        { product_name_snapshot: "Paltas", sales_unit_label_snapshot: "Caja 10kg", quantity: 1 },
        { product_name_snapshot: "Naranjas", sales_unit_label_snapshot: "Bolsa", quantity: 2 },
        { product_name_snapshot: "Miel", sales_unit_label_snapshot: "Frasco", quantity: 3 }
      ])
    ).toBe("1 x Paltas Caja 10kg, 2 x Naranjas Bolsa +1");
    expect(formatItemsSummary([])).toBe("-");
  });

  it("returns catalog database error messages by code and context", () => {
    expect(getProductCatalogDbErrorMessage({ code: "23505", message: "duplicate slug" }, "create")).toBe(
      "Ya existe un producto o variante con ese slug."
    );
    expect(getProductCatalogDbErrorMessage({ message: "column missing from product_families" }, "load")).toBe(
      "El esquema del catalogo no coincide con la version esperada. Ejecuta la migracion de catalogo antes de usar este modulo."
    );
    expect(getProductCatalogDbErrorMessage(null, "update")).toBe("No se pudo actualizar el producto.");
  });
});
