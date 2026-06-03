import { z } from "zod";
import type { PaymentMethod } from "@/lib/types";

export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  sales_unit_label: z.string(),
  cash_price: z.coerce.number(),
  transfer_price: z.coerce.number(),
  active: z.boolean(),
  display_order: z.number().int()
});

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(500)
});

export const orderItemsInputSchema = z.array(orderItemInputSchema).min(1, "Agrega al menos un producto.");

export const productMutationSchema = z.object({
  name: z.string().min(2, "Ingresa un nombre valido."),
  slug: z
    .string()
    .min(2, "Ingresa un slug valido.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede tener letras, numeros y guiones."),
  description: z.string().max(300).optional().or(z.literal("")),
  salesUnitLabel: z.string().min(2, "Ingresa una unidad comercial."),
  cashPrice: z.coerce.number().positive("Ingresa un precio en efectivo valido."),
  transferPrice: z.coerce.number().positive("Ingresa un precio por transferencia valido."),
  active: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0)
});

export type ProductRow = z.infer<typeof productSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export type ProductForForm = {
  id: string;
  name: string;
  salesUnitLabel: string;
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

export function mapProductRow(row: ProductRow): ProductForForm {
  return {
    id: row.id,
    name: row.name,
    salesUnitLabel: row.sales_unit_label,
    cashPrice: Number(row.cash_price),
    transferPrice: Number(row.transfer_price),
    active: row.active
  };
}

export function getProductUnitPrice(product: ProductForForm, paymentMethod: PaymentMethod) {
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
  productsById: Map<string, ProductForForm>,
  items: OrderItemInput[],
  paymentMethod: PaymentMethod
) {
  return consolidateOrderItems(items).map((item) => {
    const product = productsById.get(item.productId);

    if (!product || !product.active) {
      throw new Error("Producto invalido o inactivo.");
    }

    const unitPrice = getProductUnitPrice(product, paymentMethod);

    return {
      product_id: product.id,
      product_name_snapshot: product.name,
      sales_unit_label_snapshot: product.salesUnitLabel,
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: unitPrice * item.quantity
    } satisfies OrderItemInsert;
  });
}

export function buildPublicOrderRequestItems(
  productsById: Map<string, ProductForForm>,
  items: OrderItemInput[],
  paymentMethod: PaymentMethod
) {
  return consolidateOrderItems(items).map((item) => {
    const product = productsById.get(item.productId);

    if (!product || !product.active) {
      throw new Error("Producto invalido o inactivo.");
    }

    return {
      product_id: product.id,
      product_name_snapshot: product.name,
      sales_unit_label_snapshot: product.salesUnitLabel,
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
    .map((item) => `${item.quantity} x ${item.product_name_snapshot}`);
  const remaining = items.length - maxItems;

  return remaining > 0 ? `${parts.join(", ")} +${remaining}` : parts.join(", ");
}
