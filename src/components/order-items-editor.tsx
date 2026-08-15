"use client";

import { describeOrderTotals, getDefaultSellableVariantId } from "@/lib/products";
import type { ExpectedPaymentMethod, OrderItemInput, ProductFamily } from "@/lib/types";

type OrderItemsEditorProps = {
  items: OrderItemInput[];
  onChange: (items: OrderItemInput[]) => void;
  paymentMethod: ExpectedPaymentMethod;
  products: ProductFamily[];
  removeAction?: "default" | "subtle" | "hidden";
};

function formatCurrency(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function getSellableFamilies(products: ProductFamily[]) {
  return products
    .map((family) => ({
      ...family,
      variants: family.variants.filter((variant) => variant.active && variant.visibility === "sellable")
    }))
    .filter((family) => family.active && family.variants.length > 0);
}

function findFamilyByVariantId(products: ProductFamily[], variantId: string) {
  return products.find((family) => family.variants.some((variant) => variant.id === variantId)) ?? null;
}

function findVariantById(products: ProductFamily[], variantId: string) {
  for (const family of products) {
    const match = family.variants.find((variant) => variant.id === variantId);

    if (match) {
      return match;
    }
  }

  return null;
}

export function OrderItemsEditor({
  items,
  onChange,
  paymentMethod,
  products,
  removeAction = "default"
}: OrderItemsEditorProps) {
  const activeFamilies = getSellableFamilies(products);
  const selectedVariantIds = new Set(items.map((item) => item.productId));

  function updateItem(index: number, nextItem: OrderItemInput) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      return;
    }

    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    for (const family of activeFamilies) {
      const defaultVariantId = getDefaultSellableVariantId(family);

      if (defaultVariantId && !selectedVariantIds.has(defaultVariantId)) {
        onChange([
          ...items,
          {
            productId: defaultVariantId,
            quantity: 1
          }
        ]);
        return;
      }

      const fallbackVariant = family.variants.find((variant) => !selectedVariantIds.has(variant.id));

      if (fallbackVariant) {
        onChange([
          ...items,
          {
            productId: fallbackVariant.id,
            quantity: 1
          }
        ]);
        return;
      }
    }
  }

  const hasAvailableProducts = activeFamilies.some((family) =>
    family.variants.some((variant) => !selectedVariantIds.has(variant.id))
  );

  const totals = items.reduce(
    (sum, item) => {
      const variant = findVariantById(activeFamilies, item.productId);

      if (!variant) {
        return sum;
      }

      return {
        cash: sum.cash + variant.cashPrice * item.quantity,
        transfer: sum.transfer + variant.transferPrice * item.quantity
      };
    },
    { cash: 0, transfer: 0 }
  );
  const summary = describeOrderTotals(totals.cash, totals.transfer, paymentMethod);

  return (
    <div className="grid min-w-0 gap-4 md:col-span-2">
      <div className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">Productos del pedido</p>
          <p className="text-meta text-ink-faint">Eliges producto y presentación, y el sistema precarga la variante por defecto.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!activeFamilies.length || !hasAvailableProducts}
          className="self-start whitespace-nowrap rounded-control border border-info-line bg-info-bg px-4 py-2 text-body text-info-fg transition hover:border-info-line hover:bg-info-bg disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          Agregar línea
        </button>
      </div>

      <div className="grid min-w-0 gap-3">
        {items.map((item, index) => {
          const family = findFamilyByVariantId(activeFamilies, item.productId) ?? activeFamilies[0] ?? null;
          const familyVariants = family?.variants ?? [];
          const variant =
            familyVariants.find((entry) => entry.id === item.productId) ?? familyVariants[0] ?? null;
          const unitPrice = variant
            ? paymentMethod === "cash"
              ? variant.cashPrice
              : variant.transferPrice
            : 0;
          const otherSelectedVariantIds = new Set(
            items.filter((_, itemIndex) => itemIndex !== index).map((entry) => entry.productId)
          );

          return (
            <div
              key={`${item.productId}-${index}`}
              className="grid min-w-0 gap-3 rounded-card border border-line bg-paper-muted p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(5rem,0.7fr)_minmax(0,0.9fr)_auto]"
            >
              <label className="grid min-w-0 gap-2 text-body text-ink-soft">
                Producto
                <select
                  value={family?.id ?? ""}
                  onChange={(event) => {
                    const nextFamily = activeFamilies.find((entry) => entry.id === event.target.value);
                    const nextDefaultVariantId = nextFamily ? getDefaultSellableVariantId(nextFamily) : null;
                    const nextVariantId =
                      nextFamily && nextDefaultVariantId && !otherSelectedVariantIds.has(nextDefaultVariantId)
                        ? nextDefaultVariantId
                        : nextFamily?.variants.find((entry) => !otherSelectedVariantIds.has(entry.id))?.id ?? null;

                    if (!nextVariantId) {
                      return;
                    }

                    updateItem(index, {
                      ...item,
                      productId: nextVariantId
                    });
                  }}
                  className="h-12 w-full rounded-control border border-line bg-paper-muted px-4 text-body text-ink outline-hidden focus:border-accent"
                >
                  {activeFamilies.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid min-w-0 gap-2 text-body text-ink-soft">
                Presentación
                <select
                  value={item.productId}
                  onChange={(event) =>
                    updateItem(index, {
                      ...item,
                      productId: event.target.value
                    })
                  }
                  className="h-12 w-full rounded-control border border-line bg-paper-muted px-4 text-body text-ink outline-hidden focus:border-accent"
                >
                  {familyVariants.map((entry) => (
                    <option
                      key={entry.id}
                      value={entry.id}
                      disabled={otherSelectedVariantIds.has(entry.id)}
                    >
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid min-w-0 gap-2 text-body text-ink-soft">
                Cantidad
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={item.quantity}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) =>
                    updateItem(index, {
                      ...item,
                      quantity: Math.max(1, Number(event.target.value) || 1)
                    })
                  }
                  className="h-12 w-full rounded-control border border-line bg-paper-muted px-4 text-body text-ink outline-hidden focus:border-accent"
                />
              </label>

              <div className="grid min-w-0 gap-2 text-body text-ink-soft">
                <p>Subtotal</p>
                <div className="min-w-0 rounded-control border border-line bg-paper px-4 py-3 text-body text-ink">
                  <p>{formatCurrency(unitPrice * item.quantity)}</p>
                  <p className="mt-1 text-meta text-ink-faint">
                    {variant ? `${variant.label} · ${formatCurrency(unitPrice)}` : "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-end">
                {removeAction === "hidden" ? null : (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className={
                      removeAction === "subtle"
                        ? "h-12 px-2 text-body text-ink-faint transition hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                        : "h-12 rounded-control border border-danger-line bg-danger-bg px-4 text-body text-danger-fg transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-card border border-accent bg-accent-soft p-4 text-body">
        <p className="text-accent">{summary.primaryLabel}</p>
        <p className="mt-2 text-title font-semibold text-ink">
          {formatCurrency(summary.primaryAmount)}
        </p>
        {summary.secondaryText ? (
          <p className="mt-1 text-ink-soft">{summary.secondaryText}</p>
        ) : null}
      </div>

      {paymentMethod === "unknown" ? (
        <p className="text-meta leading-5 text-ink-faint">
          La forma de pago se define al cobrar. Si el cliente paga en efectivo, el sistema aplica el
          descuento automáticamente.
        </p>
      ) : null}
    </div>
  );
}
