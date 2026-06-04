"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductFamily } from "@/lib/types";

type ProductCatalogManagerProps = {
  initialProducts: ProductFamily[];
  initialEditingProduct?: ProductFamily | null;
  initialMessage?: string;
  mode?: "split" | "form-only";
};

type FormComponent = {
  componentVariantId: string;
  quantity: string;
};

type FormVariant = {
  id?: string;
  label: string;
  slug: string;
  description: string;
  cashPrice: string;
  transferPrice: string;
  active: boolean;
  displayOrder: string;
  visibility: "sellable" | "internal";
  compositionType: "simple" | "bundle";
  isDefault: boolean;
  components: FormComponent[];
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  active: boolean;
  displayOrder: string;
  variants: FormVariant[];
};

const emptyVariant = (): FormVariant => ({
  label: "",
  slug: "",
  description: "",
  cashPrice: "",
  transferPrice: "",
  active: true,
  displayOrder: "0",
  visibility: "sellable",
  compositionType: "simple",
  isDefault: true,
  components: []
});

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  description: "",
  active: true,
  displayOrder: "0",
  variants: [emptyVariant()]
});

function mapFamilyToForm(product: ProductFamily): FormState {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    active: product.active,
    displayOrder: String(product.displayOrder ?? 0),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      slug: variant.slug,
      description: variant.description ?? "",
      cashPrice: String(variant.cashPrice),
      transferPrice: String(variant.transferPrice),
      active: variant.active,
      displayOrder: String(variant.displayOrder),
      visibility: variant.visibility,
      compositionType: variant.compositionType,
      isDefault: variant.isDefault,
      components: variant.components.map((component) => ({
        componentVariantId: component.componentVariantId,
        quantity: String(component.quantity)
      }))
    }))
  };
}

function toPayload(form: FormState) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description,
    active: form.active,
    displayOrder: Number(form.displayOrder),
    variants: form.variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      label: variant.label,
      slug: variant.slug,
      description: variant.description,
      cashPrice: Number(variant.cashPrice),
      transferPrice: Number(variant.transferPrice),
      active: variant.active,
      displayOrder: Number(variant.displayOrder),
      visibility: variant.visibility,
      compositionType: variant.compositionType,
      isDefault: variant.isDefault,
      components:
        variant.compositionType === "bundle"
          ? variant.components
              .filter((component) => component.componentVariantId)
              .map((component) => ({
                componentVariantId: component.componentVariantId,
                quantity: Number(component.quantity)
              }))
          : []
    }))
  };
}

export function ProductCatalogManager({
  initialProducts,
  initialMessage = "",
  initialEditingProduct = null,
  mode = "split"
}: ProductCatalogManagerProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(initialEditingProduct?.id ?? null);
  const [form, setForm] = useState<FormState>(
    initialEditingProduct ? mapFamilyToForm(initialEditingProduct) : emptyForm()
  );
  const [message, setMessage] = useState(initialMessage);
  const [isPending, startTransition] = useTransition();
  const showCatalogList = mode === "split";

  const componentOptions = useMemo(
    () =>
      products.flatMap((family) =>
        family.variants
          .filter((variant) => variant.compositionType === "simple")
          .map((variant) => ({
            id: variant.id,
            label: `${family.name} · ${variant.label}`
          }))
      ),
    [products]
  );

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (initialEditingProduct) {
      setEditingId(initialEditingProduct.id);
      setForm(mapFamilyToForm(initialEditingProduct));
      setMessage(initialMessage);
      return;
    }

    if (mode === "form-only") {
      resetForm();
      setMessage(initialMessage);
    }
  }, [initialEditingProduct, initialMessage, mode]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function applyProduct(product: ProductFamily) {
    setEditingId(product.id);
    setForm(mapFamilyToForm(product));
    setMessage("");
  }

  async function refreshProducts() {
    const response = await fetch("/api/panel/products");
    const result = (await response.json()) as { products?: ProductFamily[]; message?: string };

    if (response.ok && result.products) {
      setProducts(result.products);
      setMessage("");
      return result.products;
    } else if (result.message) {
      setMessage(result.message);
    } else {
      setMessage("No se pudo refrescar el catalogo.");
    }

    return null;
  }

  function setVariantField(index: number, patch: Partial<FormVariant>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant
      )
    }));
  }

  function setDefaultVariant(index: number) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => ({
        ...variant,
        isDefault: variantIndex === index
      }))
    }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, { ...emptyVariant(), isDefault: false }]
    }));
  }

  function removeVariant(index: number) {
    if (form.variants.length === 1) {
      return;
    }

    setForm((current) => {
      const nextVariants = current.variants.filter((_, variantIndex) => variantIndex !== index);

      if (!nextVariants.some((variant) => variant.isDefault)) {
        nextVariants[0] = { ...nextVariants[0], isDefault: true };
      }

      return {
        ...current,
        variants: nextVariants
      };
    });
  }

  function addComponent(variantIndex: number) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              components: [...variant.components, { componentVariantId: "", quantity: "1" }]
            }
          : variant
      )
    }));
  }

  function updateComponent(
    variantIndex: number,
    componentIndex: number,
    patch: Partial<FormComponent>
  ) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              components: variant.components.map((component, innerIndex) =>
                innerIndex === componentIndex ? { ...component, ...patch } : component
              )
            }
          : variant
      )
    }));
  }

  function removeComponent(variantIndex: number, componentIndex: number) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              components: variant.components.filter((_, innerIndex) => innerIndex !== componentIndex)
            }
          : variant
      )
    }));
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

      const result = (await response.json()) as {
        success: boolean;
        message: string;
        productId?: string;
      };
      setMessage(result.message);

      if (response.ok) {
        const refreshed = await refreshProducts();

        if (!editingId && result.productId && mode === "form-only") {
          router.push(`/panel/products/${result.productId}/edit`);
          return;
        }

        if (editingId && mode === "form-only") {
          const updated = refreshed?.find((product) => product.id === editingId);

          if (updated) {
            applyProduct(updated);
          }

          return;
        }

        resetForm();
      }
    }

    startTransition(() => {
      void submitProduct();
    });
  }

  async function handleDelete() {
    if (!editingId) {
      return;
    }

    const confirmed = window.confirm(
      "Vas a borrar este producto base y sus variantes. Esta acción no se puede deshacer."
    );

    if (!confirmed) {
      return;
    }

    setMessage("");

    async function deleteProduct() {
      const response = await fetch(`/api/panel/products/${editingId}`, {
        method: "DELETE"
      });

      const result = (await response.json()) as { success: boolean; message: string };
      setMessage(result.message);

      if (response.ok) {
        if (mode === "form-only") {
          router.push("/panel/products");
          return;
        }

        await refreshProducts();
        resetForm();
      }
    }

    startTransition(() => {
      void deleteProduct();
    });
  }

  return (
    <div className={showCatalogList ? "grid gap-6 lg:grid-cols-[1fr_1fr]" : "grid gap-6"}>
      <form
        id="product-editor"
        onSubmit={handleSubmit}
        className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-50">
              {editingId ? "Editar producto base" : "Nuevo producto base"}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Definís el producto comercial, sus variantes y la composición de bundles.
            </p>
          </div>
          {editingId && mode !== "form-only" ? (
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
              Producto base activo
            </label>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-stone-100">Variantes</h3>
              <p className="text-sm text-stone-400">Cada variante puede ser vendible o solo interna, simple o compuesta.</p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20"
            >
              Agregar variante
            </button>
          </div>

          {form.variants.map((variant, index) => (
            <div key={variant.id ?? `variant-${index}`} className="rounded-2xl border border-stone-800 bg-stone-950/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-stone-50">Variante {index + 1}</p>
                  <p className="text-sm text-stone-500">Presentación, precio y composición interna.</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  disabled={form.variants.length === 1}
                  className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-stone-300">
                  Presentación
                  <input
                    value={variant.label}
                    onChange={(event) => setVariantField(index, { label: event.target.value })}
                    placeholder="500 g"
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Slug
                  <input
                    value={variant.slug}
                    onChange={(event) => setVariantField(index, { slug: event.target.value })}
                    placeholder="avellanas-500g"
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
                  Descripción
                  <textarea
                    rows={2}
                    value={variant.description}
                    onChange={(event) => setVariantField(index, { description: event.target.value })}
                    className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Efectivo
                  <input
                    type="number"
                    min="1"
                    value={variant.cashPrice}
                    onChange={(event) => setVariantField(index, { cashPrice: event.target.value })}
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Transferencia
                  <input
                    type="number"
                    min="1"
                    value={variant.transferPrice}
                    onChange={(event) => setVariantField(index, { transferPrice: event.target.value })}
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Visibilidad
                  <select
                    value={variant.visibility}
                    onChange={(event) =>
                      setVariantField(index, {
                        visibility: event.target.value as "sellable" | "internal",
                        isDefault:
                          event.target.value === "internal" && variant.isDefault ? false : variant.isDefault
                      })
                    }
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  >
                    <option value="sellable">Vendible</option>
                    <option value="internal">Solo interna</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Tipo
                  <select
                    value={variant.compositionType}
                    onChange={(event) =>
                      setVariantField(index, {
                        compositionType: event.target.value as "simple" | "bundle",
                        components: event.target.value === "bundle" ? variant.components : []
                      })
                    }
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  >
                    <option value="simple">Simple</option>
                    <option value="bundle">Compuesta</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-stone-300">
                  Orden
                  <input
                    type="number"
                    min="0"
                    value={variant.displayOrder}
                    onChange={(event) => setVariantField(index, { displayOrder: event.target.value })}
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/70 px-4 py-3 text-sm text-stone-300">
                  <input
                    type="checkbox"
                    checked={variant.active}
                    onChange={(event) => setVariantField(index, { active: event.target.checked })}
                  />
                  Variante activa
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/70 px-4 py-3 text-sm text-stone-300 md:col-span-2">
                  <input
                    type="radio"
                    name="defaultVariant"
                    checked={variant.isDefault}
                    disabled={variant.visibility !== "sellable"}
                    onChange={() => setDefaultVariant(index)}
                  />
                  Variante vendible por defecto
                </label>
              </div>

              {variant.compositionType === "bundle" ? (
                <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-100">Componentes del bundle</p>
                      <p className="text-xs text-stone-500">El cliente compra una variante; internamente esta se compone de otras variantes simples.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addComponent(index)}
                      className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                    >
                      Agregar componente
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {variant.components.length ? (
                      variant.components.map((component, componentIndex) => (
                        <div
                          key={`${variant.id ?? index}-component-${componentIndex}`}
                          className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]"
                        >
                          <select
                            value={component.componentVariantId}
                            onChange={(event) =>
                              updateComponent(index, componentIndex, {
                                componentVariantId: event.target.value
                              })
                            }
                            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                          >
                            <option value="">Elegir variante simple</option>
                            {componentOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={component.quantity}
                            onChange={(event) =>
                              updateComponent(index, componentIndex, {
                                quantity: event.target.value
                              })
                            }
                            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                          />

                          <button
                            type="button"
                            onClick={() => removeComponent(index, componentIndex)}
                            className="h-11 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm text-rose-200 transition hover:bg-rose-500/20"
                          >
                            Quitar
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-stone-500">
                        Aún no definiste componentes para esta variante compuesta.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-base font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear producto"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 px-5 text-base text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Borrar producto
            </button>
          ) : null}
          {message ? <p className="text-sm text-stone-300">{message}</p> : null}
        </div>
      </form>

      {showCatalogList ? (
        <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
          <div>
            <h2 className="text-xl font-semibold text-stone-50">Catálogo actual</h2>
            <p className="mt-1 text-sm text-stone-400">
              Productos base con variantes vendibles, internas y bundles configurables.
            </p>
          </div>

          <div className="mt-6 grid gap-4">
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
                    <p className="mt-1 text-sm text-stone-400">
                      {product.variants.length} variante{product.variants.length === 1 ? "" : "s"}
                    </p>
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

                <div className="mt-4 space-y-2">
                  {product.variants.map((variant) => (
                    <div key={variant.id} className="rounded-2xl bg-stone-900/80 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-stone-200">
                          {variant.label}
                          {variant.isDefault ? " · default" : ""}
                        </p>
                        <p className="text-stone-500">
                          {variant.visibility === "sellable" ? "Vendible" : "Interna"} ·{" "}
                          {variant.compositionType === "bundle" ? "Compuesta" : "Simple"}
                        </p>
                      </div>
                      <p className="mt-1 text-stone-400">
                        ${variant.cashPrice.toLocaleString("es-AR")} efectivo · $
                        {variant.transferPrice.toLocaleString("es-AR")} transferencia
                      </p>
                      {variant.components.length ? (
                        <p className="mt-1 text-xs text-stone-500">
                          Componentes:{" "}
                          {variant.components
                            .map((component) => `${component.componentFamilyName} ${component.componentLabel}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
