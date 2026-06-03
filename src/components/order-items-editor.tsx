"use client";

import type { OrderItemInput, Product } from "@/lib/types";

type OrderItemsEditorProps = {
  items: OrderItemInput[];
  onChange: (items: OrderItemInput[]) => void;
  paymentMethod: "cash" | "transfer";
  products: Product[];
};

function formatCurrency(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

export function OrderItemsEditor({
  items,
  onChange,
  paymentMethod,
  products
}: OrderItemsEditorProps) {
  const activeProducts = products.filter((product) => product.active);

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
    const fallbackProduct = activeProducts[0];

    if (!fallbackProduct) {
      return;
    }

    onChange([
      ...items,
      {
        productId: fallbackProduct.id,
        quantity: 1
      }
    ]);
  }

  const total = items.reduce((sum, item) => {
    const product = activeProducts.find((entry) => entry.id === item.productId);

    if (!product) {
      return sum;
    }

    const unitPrice = paymentMethod === "cash" ? product.cashPrice : product.transferPrice;
    return sum + unitPrice * item.quantity;
  }, 0);

  return (
    <div className="grid gap-4 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-300">Productos del pedido</p>
          <p className="text-xs text-stone-500">Cada línea define producto, unidad y cantidad.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!activeProducts.length}
          className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar línea
        </button>
      </div>

      <div className="grid gap-3">
        {items.map((item, index) => {
          const product = activeProducts.find((entry) => entry.id === item.productId) ?? activeProducts[0];
          const unitPrice = product
            ? paymentMethod === "cash"
              ? product.cashPrice
              : product.transferPrice
            : 0;

          return (
            <div
              key={`${item.productId}-${index}`}
              className="grid gap-3 rounded-2xl border border-stone-800 bg-stone-950/80 p-4 md:grid-cols-[1.6fr_0.8fr_0.8fr_auto]"
            >
              <label className="grid gap-2 text-sm text-stone-300">
                Producto
                <select
                  value={item.productId}
                  onChange={(event) =>
                    updateItem(index, {
                      ...item,
                      productId: event.target.value
                    })
                  }
                  className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                >
                  {activeProducts.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-stone-300">
                Cantidad
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, {
                      ...item,
                      quantity: Math.max(1, Number(event.target.value) || 1)
                    })
                  }
                  className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                />
              </label>

              <div className="grid gap-2 text-sm text-stone-300">
                <p>Subtotal</p>
                <div className="rounded-xl border border-stone-800 bg-stone-900/80 px-4 py-3 text-base text-stone-100">
                  <p>{formatCurrency(unitPrice * item.quantity)}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {product ? `${product.salesUnitLabel} · ${formatCurrency(unitPrice)}` : "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="h-12 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm">
        <p className="text-emerald-200">Total estimado</p>
        <p className="mt-2 text-2xl font-semibold text-stone-50">{formatCurrency(total)}</p>
        <p className="mt-1 text-stone-300">
          Calculado con precios por {paymentMethod === "cash" ? "efectivo" : "transferencia"}.
        </p>
      </div>
    </div>
  );
}
