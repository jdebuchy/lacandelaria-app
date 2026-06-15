import { z } from "zod";
import type {
  ExpectedPaymentMethod,
  ProductFamily,
  ProductVariant,
  ProductVariantComponent
} from "@/lib/types";

type ProductCatalogDbError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

export const PRODUCT_FAMILY_SELECT_COLUMNS =
  "id, name, slug, description, active, display_order, default_variant_id, created_at";

export const PRODUCT_VARIANT_SELECT_COLUMNS =
  "id, product_family_id, label, slug, description, cash_price, transfer_price, active, display_order, visibility, composition_type, created_at";

export const PRODUCT_VARIANT_COMPONENT_SELECT_COLUMNS =
  "bundle_variant_id, component_variant_id, quantity";

export const productVariantVisibilitySchema = z.enum(["sellable", "internal"]);
export const productVariantCompositionTypeSchema = z.enum(["simple", "bundle"]);

export const productFamilyRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  active: z.boolean(),
  display_order: z.number().int(),
  default_variant_id: z.string().uuid().nullable().optional(),
  created_at: z.string().optional()
});

export const productVariantRowSchema = z.object({
  id: z.string().uuid(),
  product_family_id: z.string().uuid(),
  label: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  cash_price: z.coerce.number(),
  transfer_price: z.coerce.number(),
  active: z.boolean(),
  display_order: z.number().int(),
  visibility: productVariantVisibilitySchema,
  composition_type: productVariantCompositionTypeSchema,
  created_at: z.string().optional()
});

export const productVariantComponentRowSchema = z.object({
  bundle_variant_id: z.string().uuid(),
  component_variant_id: z.string().uuid(),
  quantity: z.coerce.number()
});

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(500)
});

export const orderItemsInputSchema = z.array(orderItemInputSchema).min(1, "Agrega al menos un producto.");

export const productVariantComponentMutationSchema = z.object({
  componentVariantId: z.string().uuid(),
  quantity: z.coerce.number().positive("La cantidad del componente debe ser mayor a cero.")
});

export const productVariantMutationSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(2, "Ingresa una presentación valida."),
  slug: z
    .string()
    .min(2, "Ingresa un slug valido.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede tener letras, numeros y guiones."),
  description: z.string().max(300).optional().or(z.literal("")),
  cashPrice: z.coerce.number().positive("Ingresa un precio en efectivo valido."),
  transferPrice: z.coerce.number().positive("Ingresa un precio por transferencia valido."),
  active: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0),
  visibility: productVariantVisibilitySchema.default("sellable"),
  compositionType: productVariantCompositionTypeSchema.default("simple"),
  isDefault: z.boolean().default(false),
  components: z.array(productVariantComponentMutationSchema).default([])
});

export const productFamilyMutationSchema = z
  .object({
    name: z.string().min(2, "Ingresa un nombre valido."),
    slug: z
      .string()
      .min(2, "Ingresa un slug valido.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede tener letras, numeros y guiones."),
    description: z.string().max(300).optional().or(z.literal("")),
    active: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).default(0),
    variants: z.array(productVariantMutationSchema).min(1, "Agrega al menos una variante.")
  })
  .superRefine((data, ctx) => {
    const defaultVariants = data.variants.filter((variant) => variant.isDefault);

    if (defaultVariants.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Solo puede haber una variante por defecto.",
        path: ["variants"]
      });
    }

    const sellableVariants = data.variants.filter((variant) => variant.visibility === "sellable");

    if (!sellableVariants.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Agrega al menos una variante vendible.",
        path: ["variants"]
      });
    }

    data.variants.forEach((variant, index) => {
      if (variant.compositionType === "simple" && variant.components.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Una variante simple no puede tener componentes.",
          path: ["variants", index, "components"]
        });
      }

      if (variant.compositionType === "bundle" && variant.components.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Una variante compuesta debe tener al menos un componente.",
          path: ["variants", index, "components"]
        });
      }
    });
  });

export type ProductFamilyRow = z.infer<typeof productFamilyRowSchema>;
export type ProductVariantRow = z.infer<typeof productVariantRowSchema>;
export type ProductVariantComponentRow = z.infer<typeof productVariantComponentRowSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type ProductFamilyMutation = z.infer<typeof productFamilyMutationSchema>;

export type ProductVariantForOrder = {
  id: string;
  familyId: string;
  familyName: string;
  label: string;
  cashPrice: number;
  transferPrice: number;
  active: boolean;
};

export type OrderItemInsert = {
  product_id: string;
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PublicOrderRequestItemInsert = {
  product_id: string;
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number;
  unit_price_snapshot: number | null;
};

export type ItemSummary = {
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number;
};

export function getProductCatalogDbErrorMessage(
  error: ProductCatalogDbError | null | undefined,
  action: "load" | "create" | "update"
) {
  const fallbackByAction = {
    load: "No se pudo cargar el catalogo.",
    create: "No se pudo crear el producto.",
    update: "No se pudo actualizar el producto."
  } satisfies Record<typeof action, string>;

  if (!error) {
    return fallbackByAction[action];
  }

  const raw = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (error.code === "23505" && raw.includes("slug")) {
    return "Ya existe un producto o variante con ese slug.";
  }

  if (
    raw.includes("product_families") ||
    raw.includes("product_variants") ||
    raw.includes("product_variant_components") ||
    raw.includes("default_variant_id") ||
    raw.includes("visibility") ||
    raw.includes("composition_type") ||
    raw.includes("schema cache") ||
    raw.includes("could not find the") ||
    raw.includes("column")
  ) {
    return "El esquema del catalogo no coincide con la version esperada. Ejecuta la migracion de catalogo antes de usar este modulo.";
  }

  return fallbackByAction[action];
}

export function mapVariantRowToOrder(row: ProductVariantRow, family: ProductFamilyRow): ProductVariantForOrder {
  return {
    id: row.id,
    familyId: family.id,
    familyName: family.name,
    label: row.label,
    cashPrice: Number(row.cash_price),
    transferPrice: Number(row.transfer_price),
    active: row.active
  };
}

export function buildCatalogFamilies(
  familyRows: ProductFamilyRow[],
  variantRows: ProductVariantRow[],
  componentRows: ProductVariantComponentRow[]
) {
  const familyById = new Map(familyRows.map((family) => [family.id, family]));
  const variantRowsByFamily = new Map<string, ProductVariantRow[]>();

  for (const row of variantRows) {
    const list = variantRowsByFamily.get(row.product_family_id) ?? [];
    list.push(row);
    variantRowsByFamily.set(row.product_family_id, list);
  }

  const componentRowsByBundle = new Map<string, ProductVariantComponentRow[]>();

  for (const row of componentRows) {
    const list = componentRowsByBundle.get(row.bundle_variant_id) ?? [];
    list.push(row);
    componentRowsByBundle.set(row.bundle_variant_id, list);
  }

  const variantLookup = new Map(
    variantRows.map((variant) => {
      const family = familyById.get(variant.product_family_id);
      return [
        variant.id,
        {
          variant,
          family
        }
      ] as const;
    })
  );

  return familyRows
    .slice()
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "es"))
    .map((family) => {
      const variants = (variantRowsByFamily.get(family.id) ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order || a.label.localeCompare(b.label, "es"))
        .map((variant): ProductVariant => {
          const components: ProductVariantComponent[] = (componentRowsByBundle.get(variant.id) ?? []).map(
            (component) => {
              const related = variantLookup.get(component.component_variant_id);

              return {
                componentVariantId: component.component_variant_id,
                componentFamilyName: related?.family?.name ?? "Variante",
                componentLabel: related?.variant?.label ?? component.component_variant_id,
                quantity: Number(component.quantity)
              };
            }
          );

          return {
            id: variant.id,
            familyId: family.id,
            familyName: family.name,
            familySlug: family.slug,
            label: variant.label,
            slug: variant.slug,
            description: variant.description ?? null,
            cashPrice: Number(variant.cash_price),
            transferPrice: Number(variant.transfer_price),
            active: variant.active,
            displayOrder: variant.display_order,
            visibility: variant.visibility,
            compositionType: variant.composition_type,
            isDefault: family.default_variant_id === variant.id,
            components
          };
        });

      return {
        id: family.id,
        name: family.name,
        slug: family.slug,
        description: family.description ?? null,
        active: family.active,
        displayOrder: family.display_order,
        defaultVariantId: family.default_variant_id ?? null,
        variants
      } satisfies ProductFamily;
    });
}

export async function loadCatalog(
  supabase: {
    from: (table: string) => {
      select: (columns: string, options?: { count?: string; head?: boolean }) => any;
    };
  },
  options?: {
    onlyActiveFamilies?: boolean;
    onlySellableVariants?: boolean;
    onlyActiveVariants?: boolean;
  }
) {
  const { onlyActiveFamilies = false, onlySellableVariants = false, onlyActiveVariants = false } = options ?? {};

  let familyQuery = supabase.from("product_families").select(PRODUCT_FAMILY_SELECT_COLUMNS);
  let variantQuery = supabase.from("product_variants").select(PRODUCT_VARIANT_SELECT_COLUMNS);
  const componentQuery = supabase
    .from("product_variant_components")
    .select(PRODUCT_VARIANT_COMPONENT_SELECT_COLUMNS);

  if (onlyActiveFamilies) {
    familyQuery = familyQuery.eq("active", true);
  }

  if (onlySellableVariants) {
    variantQuery = variantQuery.eq("visibility", "sellable");
  }

  if (onlyActiveVariants) {
    variantQuery = variantQuery.eq("active", true);
  }

  const [{ data: families, error: familiesError }, { data: variants, error: variantsError }, { data: components, error: componentsError }] =
    await Promise.all([familyQuery, variantQuery, componentQuery]);

  const error = familiesError || variantsError || componentsError;

  if (error) {
    return { data: null, error };
  }

  const parsedFamilies = (families ?? []).map((row: Record<string, unknown>) => productFamilyRowSchema.parse(row));
  const parsedVariants = (variants ?? []).map((row: Record<string, unknown>) => productVariantRowSchema.parse(row));
  const parsedComponents = (components ?? []).map((row: Record<string, unknown>) =>
    productVariantComponentRowSchema.parse(row)
  );

  const catalog = buildCatalogFamilies(parsedFamilies, parsedVariants, parsedComponents);
  const visibleFamilyIds = new Set(catalog.map((family) => family.id));

  return {
    data: catalog.filter((family) => {
      if (!visibleFamilyIds.has(family.id)) {
        return false;
      }

      if (!onlySellableVariants && !onlyActiveVariants) {
        return true;
      }

      return family.variants.length > 0;
    }),
    error: null
  };
}

export async function syncCatalogFamily(
  supabase: {
    from: (table: string) => any;
  },
  payload: ProductFamilyMutation,
  existingFamilyId?: string
) {
  let familyId = existingFamilyId ?? null;

  if (familyId) {
    const { error } = await supabase
      .from("product_families")
      .update({
        name: payload.name.trim(),
        slug: payload.slug.trim(),
        description: payload.description?.trim() || null,
        active: payload.active,
        display_order: payload.displayOrder,
        default_variant_id: null
      })
      .eq("id", familyId);

    if (error) {
      return { familyId: null, error };
    }
  } else {
    const { data, error } = await supabase
      .from("product_families")
      .insert({
        name: payload.name.trim(),
        slug: payload.slug.trim(),
        description: payload.description?.trim() || null,
        active: payload.active,
        display_order: payload.displayOrder
      })
      .select("id")
      .single();

    if (error || !data) {
      return { familyId: null, error };
    }

    familyId = data.id;
  }

  const persistedVariants: Array<{ id: string; isDefault: boolean; visibility: "sellable" | "internal" }> = [];

  for (const variant of payload.variants) {
    const variantPayload = {
      product_family_id: familyId,
      label: variant.label.trim(),
      slug: variant.slug.trim(),
      description: variant.description?.trim() || null,
      cash_price: variant.cashPrice,
      transfer_price: variant.transferPrice,
      active: variant.active,
      display_order: variant.displayOrder,
      visibility: variant.visibility,
      composition_type: variant.compositionType
    };

    if (variant.id) {
      const { error } = await supabase.from("product_variants").update(variantPayload).eq("id", variant.id);

      if (error) {
        return { familyId: null, error };
      }

      persistedVariants.push({
        id: variant.id,
        isDefault: variant.isDefault,
        visibility: variant.visibility
      });
      continue;
    }

    const { data, error } = await supabase.from("product_variants").insert(variantPayload).select("id").single();

    if (error || !data) {
      return { familyId: null, error };
    }

    persistedVariants.push({
      id: data.id,
      isDefault: variant.isDefault,
      visibility: variant.visibility
    });
  }

  const persistedVariantIds = persistedVariants.map((variant) => variant.id);

  if (existingFamilyId) {
    const { data: existingVariants, error } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_family_id", familyId);

    if (error) {
      return { familyId: null, error };
    }

    const variantIdsToDelete = ((existingVariants ?? []) as Array<{ id: string }>)
      .map((variant) => variant.id)
      .filter((id) => !persistedVariantIds.includes(id));

    if (variantIdsToDelete.length) {
      const { error: deleteError } = await supabase.from("product_variants").delete().in("id", variantIdsToDelete);

      if (deleteError) {
        return { familyId: null, error: deleteError };
      }
    }
  }

  for (let index = 0; index < payload.variants.length; index += 1) {
    const variant = payload.variants[index];
    const persisted = persistedVariants[index];

    if (!persisted) {
      continue;
    }

    const { error: deleteComponentsError } = await supabase
      .from("product_variant_components")
      .delete()
      .eq("bundle_variant_id", persisted.id);

    if (deleteComponentsError) {
      return { familyId: null, error: deleteComponentsError };
    }

    if (variant.compositionType !== "bundle" || !variant.components.length) {
      continue;
    }

    const { error: insertComponentsError } = await supabase.from("product_variant_components").insert(
      variant.components.map((component) => ({
        bundle_variant_id: persisted.id,
        component_variant_id: component.componentVariantId,
        quantity: component.quantity
      }))
    );

    if (insertComponentsError) {
      return { familyId: null, error: insertComponentsError };
    }
  }

  const defaultVariantId =
    persistedVariants.find((variant) => variant.isDefault && variant.visibility === "sellable")?.id ??
    persistedVariants.find((variant) => variant.visibility === "sellable")?.id ??
    null;

  const { error: defaultError } = await supabase
    .from("product_families")
    .update({ default_variant_id: defaultVariantId })
    .eq("id", familyId);

  if (defaultError) {
    return { familyId: null, error: defaultError };
  }

  return {
    familyId,
    error: null
  };
}

export function flattenCatalogVariants(families: ProductFamily[]) {
  return families.flatMap((family) =>
    family.variants.map((variant) => ({
      ...variant,
      familyName: family.name
    }))
  );
}

export function getDefaultSellableVariantId(family: ProductFamily) {
  const sellableVariants = family.variants.filter((variant) => variant.visibility === "sellable" && variant.active);
  const defaultVariant = sellableVariants.find((variant) => variant.id === family.defaultVariantId);

  if (!sellableVariants.length) {
    return null;
  }

  return (
    sellableVariants.find((variant) => variant.isDefault)?.id ??
    defaultVariant?.id ??
    sellableVariants[0]?.id ??
    null
  );
}

export function buildVariantLookup(families: ProductFamily[]) {
  const lookup = new Map<string, ProductVariantForOrder>();

  for (const family of families) {
    for (const variant of family.variants) {
      lookup.set(variant.id, {
        id: variant.id,
        familyId: family.id,
        familyName: family.name,
        label: variant.label,
        cashPrice: variant.cashPrice,
        transferPrice: variant.transferPrice,
        active: variant.active
      });
    }
  }

  return lookup;
}

export function getProductUnitPrice(product: ProductVariantForOrder, paymentMethod: ExpectedPaymentMethod) {
  return paymentMethod === "cash" ? product.cashPrice : product.transferPrice;
}

export function consolidateOrderItems(items: OrderItemInput[]) {
  const byProduct = new Map<string, number>();

  for (const item of items) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }

  return Array.from(byProduct.entries()).map(([productId, quantity]) => ({
    productId,
    quantity
  }));
}

export function buildOrderItems(
  productsById: Map<string, ProductVariantForOrder>,
  items: OrderItemInput[],
  paymentMethod: ExpectedPaymentMethod
) {
  return consolidateOrderItems(items).map((item) => {
    const product = productsById.get(item.productId);

    if (!product || !product.active) {
      throw new Error("Producto invalido o inactivo.");
    }

    const unitPrice = getProductUnitPrice(product, paymentMethod);

    return {
      product_id: product.id,
      product_name_snapshot: product.familyName,
      sales_unit_label_snapshot: product.label,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: unitPrice * item.quantity
    } satisfies OrderItemInsert;
  });
}

export function buildPublicOrderRequestItems(
  productsById: Map<string, ProductVariantForOrder>,
  items: OrderItemInput[],
  paymentMethod: ExpectedPaymentMethod
) {
  return consolidateOrderItems(items).map((item) => {
    const product = productsById.get(item.productId);

    if (!product || !product.active) {
      throw new Error("Producto invalido o inactivo.");
    }

    return {
      product_id: product.id,
      product_name_snapshot: product.familyName,
      sales_unit_label_snapshot: product.label,
      quantity: item.quantity,
      unit_price_snapshot: getProductUnitPrice(product, paymentMethod)
    } satisfies PublicOrderRequestItemInsert;
  });
}

export function calculateItemsCount(items: Array<{ quantity: number }>) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateOrderTotal(items: Array<{ line_total: number }>) {
  return items.reduce((sum, item) => sum + item.line_total, 0);
}

export function formatItemsSummary(items: ItemSummary[], maxItems = 2) {
  if (!items.length) {
    return "-";
  }

  const parts = items
    .slice(0, maxItems)
    .map((item) => `${item.quantity} x ${item.product_name_snapshot} ${item.sales_unit_label_snapshot}`);
  const remaining = items.length - maxItems;

  return remaining > 0 ? `${parts.join(", ")} +${remaining}` : parts.join(", ");
}
