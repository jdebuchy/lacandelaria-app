"use client";

import { FormEvent, useState, useTransition } from "react";
import type { Product } from "@/lib/types";

type ProductCatalogManagerProps = {
  initialProducts: Product[];
  initialMessage?: string;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  salesUnitLabel: string;
  cashPrice: string;
  transferPrice: string;
  active: boolean;
  displayOrder: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  salesUnitLabel: "",
  cashPrice: "",
  transferPrice: "",
  active: true,
  displayOrder: "0"
};

function toPayload(form: FormState) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description,
    salesUnitLabel: form.salesUnitLabel,
    cashPrice: Number(form.cashPrice),
    transferPrice: Number(form.transferPrice),
    active: form.active,
    displayOrder: Number(form.displayOrder)
  };
}

export function ProductCatalogManager({
  initialProducts,
  initialMessage = ""
}: ProductCatalogManagerProps) {
  const [products, setProducts] = useState(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState(initialMessage);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function applyProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      salesUnitLabel: product.salesUnitLabel,
      cashPrice: String(product.cashPrice),
      transferPrice: String(product.transferPrice),
      active: product.active,
      displayOrder: String(product.displayOrder ?? 0)
    });
    setMessage("");
  }

  async function refreshProducts() {
    const response = await fetch("/api/panel/products");
    const result = (await response.json()) as { products?: Product[]; message?: string };

    if (response.ok && result.products) {
      setProducts(
        result.products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? null,
          salesUnitLabel: product.salesUnitLabel,
          cashPrice: Number(product.cashPrice),
          transferPrice: Number(product.transferPrice),
          active: product.active,
          displayOrder: product.displayOrder ?? 0
        }))
      );
      setMessage("");
    } else if (result.message) {
      setMessage(result.message);
    } else {
      setMessage("No se pudo refrescar el catalogo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const url = editingId ? `/api/panel/products/${editingId}` : "/api/panel/products";
    const method = editingId ? "PATCH" : "POST";

    async function submitProduct() {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(toPayload(form))
      });

      const result = (await response.json()) as { success: boolean; message: string };
      setMessage(result.message);

      if (response.ok) {
        await refreshProducts();
        resetForm();
      }
    }

    startTransition(() => {
      void submitProduct();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-50">
              {editingId ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Precio por medio de pago y unidad comercial por producto.
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
            >
              Cancelar
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-stone-300">
            Nombre
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>
          <label className="grid gap-2 text-sm text-stone-300">
            Slug
            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>
          <label className="grid gap-2 text-sm text-stone-300">
            Descripción
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>
          <label className="grid gap-2 text-sm text-stone-300">
            Unidad comercial
            <input
              value={form.salesUnitLabel}
              onChange={(event) => setForm({ ...form, salesUnitLabel: event.target.value })}
              placeholder="Caja de 4 kg"
              className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-stone-300">
              Precio efectivo
              <input
                type="number"
                min="1"
                value={form.cashPrice}
                onChange={(event) => setForm({ ...form, cashPrice: event.target.value })}
                className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="grid gap-2 text-sm text-stone-300">
              Precio transferencia
              <input
                type="number"
                min="1"
                value={form.transferPrice}
                onChange={(event) => setForm({ ...form, transferPrice: event.target.value })}
                className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-stone-300">
              Orden
              <input
                type="number"
                min="0"
                value={form.displayOrder}
                onChange={(event) => setForm({ ...form, displayOrder: event.target.value })}
                className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-950/70 px-4 py-3 text-sm text-stone-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Producto activo
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-base font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear producto"}
          </button>
          {message ? <p className="text-sm text-stone-300">{message}</p> : null}
        </div>
      </form>

      <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
        <div>
          <h2 className="text-xl font-semibold text-stone-50">Catálogo actual</h2>
          <p className="mt-1 text-sm text-stone-400">
            Los vendedores usan solo productos activos al cargar pedidos.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => applyProduct(product)}
              className="rounded-2xl border border-stone-800 bg-stone-950/80 p-4 text-left transition hover:border-stone-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-stone-50">{product.name}</p>
                  <p className="mt-1 text-sm text-stone-400">{product.salesUnitLabel}</p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    product.active
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                      : "border-stone-700 bg-stone-900 text-stone-400"
                  }`}
                >
                  {product.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-2xl bg-stone-900/80 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Slug</p>
                  <p className="mt-1 text-stone-200">{product.slug}</p>
                </div>
                <div className="rounded-2xl bg-stone-900/80 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Efectivo</p>
                  <p className="mt-1 text-stone-200">${product.cashPrice.toLocaleString("es-AR")}</p>
                </div>
                <div className="rounded-2xl bg-stone-900/80 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Transferencia</p>
                  <p className="mt-1 text-stone-200">
                    ${product.transferPrice.toLocaleString("es-AR")}
                  </p>
                </div>
              </div>
              {product.description ? (
                <p className="mt-3 text-sm text-stone-300">{product.description}</p>
              ) : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
