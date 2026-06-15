"use client";

import { getDefaultSellableVariantId } from "@/lib/products";
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
  const total = paymentMethod === "cash" ? totals.cash : totals.transfer;

  return (
    <div className="grid min-w-0 gap-4 md:col-span-2">
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold text-stone-100">Productos del pedido</p>
          <p className="text-xs text-stone-500">Eliges producto y presentación, y el sistema precarga la variante por defecto.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!activeFamilies.length || !hasAvailableProducts}
          className="self-start whitespace-nowrap rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
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
              className="grid min-w-0 gap-3 rounded-2xl border border-stone-800 bg-stone-950/80 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(5rem,0.7fr)_minmax(0,0.9fr)_auto]"
            >
              <label className="grid min-w-0 gap-2 text-sm text-stone-300">
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
                  className="h-12 w-full rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                >
                  {activeFamilies.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid min-w-0 gap-2 text-sm text-stone-300">
                Presentación
                <select
                  value={item.productId}
                  onChange={(event) =>
                    updateItem(index, {
                      ...item,
                      productId: event.target.value
                    })
                  }
                  className="h-12 w-full rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
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

              <label className="grid min-w-0 gap-2 text-sm text-stone-300">
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
                  className="h-12 w-full rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                />
              </label>

              <div className="grid min-w-0 gap-2 text-sm text-stone-300">
                <p>Subtotal</p>
                <div className="min-w-0 rounded-xl border border-stone-800 bg-stone-900/80 px-4 py-3 text-base text-stone-100">
                  <p>{formatCurrency(unitPrice * item.quantity)}</p>
                  <p className="mt-1 text-xs text-stone-500">
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
                        ? "h-12 px-2 text-sm text-stone-500 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                        : "h-12 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm">
        <p className="text-emerald-200">{paymentMethod === "unknown" ? "Total base" : "Total estimado"}</p>
        <p className="mt-2 text-2xl font-semibold text-stone-50">{formatCurrency(total)}</p>
        {paymentMethod === "unknown" ? (
          <p className="mt-1 text-stone-300">
            Transferencia {formatCurrency(totals.transfer)} · Efectivo {formatCurrency(totals.cash)}
          </p>
        ) : (
          <p className="mt-1 text-stone-300">
            Calculado con precios por {paymentMethod === "cash" ? "efectivo" : "transferencia"}.
          </p>
        )}
      </div>
    </div>
  );
}
