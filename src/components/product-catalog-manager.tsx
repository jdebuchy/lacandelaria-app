"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductFamily } from "@/lib/types";

type ProductCatalogManagerProps = {
  initialProducts: ProductFamily[];
  initialEditingProduct?: ProductFamily | null;
  initialMessage?: string;
  editorMode?: "index" | "new" | "edit";
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

type MobileEditorScreen = "general" | "variants" | "variant-form";

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

function formatCurrency(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return `$${parsed.toLocaleString("es-AR")}`;
}

function getProductStats(product: ProductFamily) {
  const sellableCount = product.variants.filter((variant) => variant.visibility === "sellable").length;
  const bundleCount = product.variants.filter((variant) => variant.compositionType === "bundle").length;
  const inactiveCount = product.variants.filter((variant) => !variant.active).length;

  return { sellableCount, bundleCount, inactiveCount };
}

function getVariantTone(variant: FormVariant | ProductFamily["variants"][number]) {
  if (!variant.active) {
    return "border-stone-700 bg-stone-900 text-stone-400";
  }

  return variant.visibility === "sellable"
    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
    : "border-sky-400/20 bg-sky-500/10 text-sky-100";
}

function getVariantSummary(variant: FormVariant | ProductFamily["variants"][number]) {
  const visibilityLabel = variant.visibility === "sellable" ? "Vendible" : "Interna";
  const compositionLabel = variant.compositionType === "bundle" ? "Compuesta" : "Simple";
  return `${visibilityLabel} · ${compositionLabel}`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
        active
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          : "border-stone-700 bg-stone-900 text-stone-400"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

type ProductCardProps = {
  expanded: boolean;
  onToggle: () => void;
  product: ProductFamily;
};

function ProductCard({ expanded, onToggle, product }: ProductCardProps) {
  const stats = getProductStats(product);

  return (
    <div className="rounded-[28px] border border-stone-800 bg-stone-950/85 p-4 transition hover:border-stone-600 hover:bg-stone-950 sm:p-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="mt-7 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-xl text-stone-400 transition hover:border-stone-600 hover:text-stone-100"
          aria-expanded={expanded}
          aria-label={expanded ? `Ocultar variantes de ${product.name}` : `Mostrar variantes de ${product.name}`}
        >
          {expanded ? "⌄" : "›"}
        </button>

        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-stone-700 bg-stone-900/80 text-[10px] uppercase tracking-[0.28em] text-stone-500">
          Foto
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-stone-50">{product.name}</p>
              <p className="mt-1 text-sm text-stone-400">
                {product.variants.length} variante{product.variants.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <StatusPill active={product.active} />
              <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1 text-xs text-stone-300">
                {stats.sellableCount ? "Vendible" : "Interna"}
              </span>
              {stats.bundleCount ? (
                <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1 text-xs text-stone-300">
                  Mix
                </span>
              ) : null}
              <Link
                href={`/panel/products/${product.id}/edit`}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-stone-700 bg-stone-900 px-3 text-sm text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
              >
                Editar
              </Link>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-300">
            <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1">
              {stats.sellableCount} vendible{stats.sellableCount === 1 ? "" : "s"}
            </span>
            {stats.bundleCount ? (
              <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1">
                {stats.bundleCount} bundle{stats.bundleCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {stats.inactiveCount ? (
              <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1">
                {stats.inactiveCount} inactiva{stats.inactiveCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="mt-5 rounded-[24px] border border-stone-800 bg-stone-900/60">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_140px_minmax(0,1fr)_88px] gap-4 border-b border-stone-800 px-4 py-3 text-xs uppercase tracking-[0.14em] text-stone-500 sm:grid">
            <p>Variante</p>
            <p>Tipo</p>
            <p>Precios</p>
            <p className="text-right">Acción</p>
          </div>

          <div className="divide-y divide-stone-800">
            {product.variants.map((variant, index) => (
              <div
                key={variant.id}
                className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1.5fr)_140px_minmax(0,1fr)_88px] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 text-[8px] uppercase tracking-[0.24em] text-stone-500">
                    Img
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-100">
                      {variant.label}
                      {variant.isDefault ? " · default" : ""}
                    </p>
                    <p className="mt-1 text-xs text-stone-500 sm:hidden">{getVariantSummary(variant)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${getVariantTone(variant)}`}>
                    {variant.visibility === "sellable" ? "Vendible" : "Interna"}
                  </span>
                </div>

                <p className="text-sm text-stone-300">
                  {formatCurrency(variant.cashPrice)} · {formatCurrency(variant.transferPrice)}
                </p>

                <button
                  type="button"
                  onClick={onToggle}
                  className="inline-flex h-9 items-center justify-center justify-self-end rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-300 transition hover:border-stone-500 hover:text-stone-50"
                  aria-label={`Ocultar variantes de ${product.name}`}
                >
                  Ocultar
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type VariantFieldsProps = {
  componentOptions: Array<{ id: string; label: string }>;
  index: number;
  isMobile: boolean;
  isOnlyVariant: boolean;
  variant: FormVariant;
  onAddComponent: (variantIndex: number) => void;
  onRemoveComponent: (variantIndex: number, componentIndex: number) => void;
  onRemoveVariant: (index: number) => void;
  onSetDefaultVariant: (index: number) => void;
  onSetVariantField: (index: number, patch: Partial<FormVariant>) => void;
  onUpdateComponent: (variantIndex: number, componentIndex: number, patch: Partial<FormComponent>) => void;
};

function VariantFields({
  componentOptions,
  index,
  isMobile,
  isOnlyVariant,
  variant,
  onAddComponent,
  onRemoveComponent,
  onRemoveVariant,
  onSetDefaultVariant,
  onSetVariantField,
  onUpdateComponent
}: VariantFieldsProps) {
  return (
    <div className="rounded-[26px] border border-stone-800 bg-stone-950/85 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-stone-50">{variant.label || `Variante ${index + 1}`}</p>
          <p className="mt-1 text-sm text-stone-400">Presentación, precios y composición interna.</p>
        </div>
        <button
          type="button"
          onClick={() => onRemoveVariant(index)}
          disabled={isOnlyVariant}
          className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Quitar
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-stone-300">
          Nombre de variante
          <input
            value={variant.label}
            onChange={(event) => onSetVariantField(index, { label: event.target.value })}
            placeholder="Ej: 500 g"
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Slug
          <input
            value={variant.slug}
            onChange={(event) => onSetVariantField(index, { slug: event.target.value })}
            placeholder="ej-500g"
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300 sm:col-span-2">
          Descripción
          <textarea
            rows={isMobile ? 3 : 2}
            value={variant.description}
            onChange={(event) => onSetVariantField(index, { description: event.target.value })}
            className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Precio efectivo
          <input
            type="number"
            min="1"
            value={variant.cashPrice}
            onChange={(event) => onSetVariantField(index, { cashPrice: event.target.value })}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Precio transferencia
          <input
            type="number"
            min="1"
            value={variant.transferPrice}
            onChange={(event) => onSetVariantField(index, { transferPrice: event.target.value })}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Estado
          <select
            value={variant.active ? "active" : "inactive"}
            onChange={(event) => onSetVariantField(index, { active: event.target.value === "active" })}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-stone-300">
          Visibilidad
          <select
            value={variant.visibility}
            onChange={(event) =>
              onSetVariantField(index, {
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
              onSetVariantField(index, {
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
            onChange={(event) => onSetVariantField(index, { displayOrder: event.target.value })}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/70 px-4 py-3 text-sm text-stone-300 sm:col-span-2">
          <input
            type="radio"
            name="defaultVariant"
            checked={variant.isDefault}
            disabled={variant.visibility !== "sellable"}
            onChange={() => onSetDefaultVariant(index)}
          />
          Variante vendible por defecto
        </label>
      </div>

      {variant.compositionType === "bundle" ? (
        <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-100">Componentes del mix</p>
              <p className="mt-1 text-xs text-stone-500">
                El cliente compra esta variante y el sistema descuenta sus componentes simples.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddComponent(index)}
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
                  className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_auto]"
                >
                  <select
                    value={component.componentVariantId}
                    onChange={(event) =>
                      onUpdateComponent(index, componentIndex, {
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
                      onUpdateComponent(index, componentIndex, {
                        quantity: event.target.value
                      })
                    }
                    className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400"
                  />

                  <button
                    type="button"
                    onClick={() => onRemoveComponent(index, componentIndex)}
                    className="h-11 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm text-rose-200 transition hover:bg-rose-500/20"
                  >
                    Quitar
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">Todavía no definiste componentes para esta variante compuesta.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProductCatalogManager({
  initialProducts,
  initialEditingProduct = null,
  initialMessage = "",
  editorMode = "index"
}: ProductCatalogManagerProps) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(initialEditingProduct?.id ?? null);
  const [form, setForm] = useState<FormState>(
    initialEditingProduct ? mapFamilyToForm(initialEditingProduct) : emptyForm()
  );
  const [message, setMessage] = useState(initialMessage);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [mobileEditorScreen, setMobileEditorScreen] = useState<MobileEditorScreen>("general");
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const isEditorRoute = editorMode !== "index";

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

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products.filter((product) => {
      if (statusFilter === "active" && !product.active) {
        return false;
      }

      if (statusFilter === "inactive" && product.active) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [product.name, product.description ?? "", ...product.variants.map((variant) => variant.label)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [products, search, statusFilter]);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (initialEditingProduct) {
      setEditingId(initialEditingProduct.id);
      setForm(mapFamilyToForm(initialEditingProduct));
    } else {
      setEditingId(null);
      setForm(emptyForm());
    }

    setMessage(initialMessage);
    setMobileEditorScreen("general");
    setActiveVariantIndex(0);
  }, [initialEditingProduct, initialMessage, editorMode]);

  function resetToNewProduct() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage("");
    setActiveVariantIndex(0);
    setMobileEditorScreen("general");
  }

  async function refreshProducts() {
    const response = await fetch("/api/panel/products");
    const result = (await response.json()) as { products?: ProductFamily[]; message?: string };

    if (response.ok && result.products) {
      setProducts(result.products);
      return result.products;
    }

    setMessage(result.message ?? "No se pudo refrescar el catálogo.");
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
    setActiveVariantIndex(form.variants.length);
    setMobileEditorScreen("variant-form");
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

    setActiveVariantIndex((current) => Math.max(0, Math.min(current, form.variants.length - 2)));
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

  function openVariantEditor(index: number) {
    setActiveVariantIndex(index);
    setMobileEditorScreen("variant-form");
  }

  function toggleProduct(productId: string) {
    setExpandedProductIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]
    );
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

      if (!response.ok) {
        return;
      }

      const refreshed = await refreshProducts();

      if (!editingId && result.productId) {
        router.push(`/panel/products/${result.productId}/edit`);
        return;
      }

      if (editingId) {
        const updated = refreshed?.find((product) => product.id === editingId);

        if (updated) {
          setForm(mapFamilyToForm(updated));
        }
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
      "Vas a borrar este producto y sus variantes. Esta acción no se puede deshacer."
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

      if (!response.ok) {
        return;
      }

      await refreshProducts();
      router.push("/panel/products");
    }

    startTransition(() => {
      void deleteProduct();
    });
  }

  const mobileVariant = form.variants[activeVariantIndex] ?? null;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className={isEditorRoute ? "hidden lg:block" : "block"}>
        <div className="rounded-[32px] border border-stone-800 bg-stone-900/70 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.25)] sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">Productos</h1>
                <p className="mt-2 text-sm text-stone-400 sm:text-base">
                  Productos y presentaciones. Gestioná variantes y precios desde un solo lugar.
                </p>
              </div>
              <Link
                href="/panel/products/new"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
              >
                Nuevo producto
              </Link>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="grid gap-2 text-sm text-stone-300">
                <span className="sr-only">Buscar productos</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar productos"
                  className="h-12 rounded-2xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                />
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { value: "all", label: "Todos" },
                  { value: "active", label: "Activos" },
                  { value: "inactive", label: "Inactivos" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value as typeof statusFilter)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      statusFilter === option.value
                        ? "border-stone-100 bg-stone-100 text-stone-950"
                        : "border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="hidden items-center justify-end text-sm text-stone-500 lg:flex">
                {filteredProducts.length} producto{filteredProducts.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {filteredProducts.length ? (
              filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  expanded={expandedProductIds.includes(product.id)}
                  onToggle={() => toggleProduct(product.id)}
                  product={product}
                />
              ))
            ) : (
              <div className="rounded-[28px] border border-dashed border-stone-800 bg-stone-950/60 px-4 py-10 text-sm text-stone-500">
                No encontramos productos con ese filtro.
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditorRoute ? (
        <>
          <div className="hidden lg:block">
            <div className="fixed inset-0 z-40 bg-stone-950/75 backdrop-blur-sm" aria-hidden="true" />
          </div>

          <div className="relative z-50 overflow-y-auto overscroll-contain lg:fixed lg:inset-y-0 lg:right-0 lg:w-[min(760px,calc(100vw-4rem))]">
            <form
              id="product-editor"
              onSubmit={handleSubmit}
              className="flex min-h-screen flex-col rounded-[32px] border border-stone-800 bg-stone-900 shadow-[0_30px_120px_rgba(0,0,0,0.45)] lg:m-4 lg:min-h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
            >
              <div className="border-b border-stone-800 px-5 py-4 sm:px-6 lg:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 text-sm text-stone-400">
                      <Link href="/panel/products" className="transition hover:text-stone-200">
                        ← Volver
                      </Link>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-stone-50">
                      {editingId ? "Editar producto" : "Nuevo producto"}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-stone-400">
                      Ajustá la información general, las variantes vendibles o internas y la composición de bundles.
                    </p>
                  </div>
                  <Link
                    href="/panel/products"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-700 text-xl text-stone-300 transition hover:border-stone-500 hover:text-stone-100"
                    aria-label="Cerrar editor"
                  >
                    ×
                  </Link>
                </div>

                <div className="mt-5 flex gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileEditorScreen("general")}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      mobileEditorScreen === "general"
                        ? "bg-stone-100 text-stone-950"
                        : "border border-stone-700 bg-stone-900 text-stone-300"
                    }`}
                  >
                    General
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileEditorScreen("variants")}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      mobileEditorScreen === "variants" || mobileEditorScreen === "variant-form"
                        ? "bg-stone-100 text-stone-950"
                        : "border border-stone-700 bg-stone-900 text-stone-300"
                    }`}
                  >
                    Variantes
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-7">
                <div className="space-y-6 lg:space-y-8">
                  <div className={mobileEditorScreen === "general" ? "block" : "hidden lg:block"}>
                    <div className="rounded-[28px] border border-stone-800 bg-stone-950/70 p-4 sm:p-5">
                      <div>
                        <h3 className="text-lg font-semibold text-stone-100">Información general</h3>
                        <p className="mt-1 text-sm text-stone-400">
                          Configurá el nombre comercial, descripción y estado del producto.
                        </p>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm text-stone-300 sm:col-span-2">
                          Nombre del producto
                          <input
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                          />
                        </label>

                        <label className="grid gap-2 text-sm text-stone-300 sm:col-span-2">
                          Slug
                          <input
                            value={form.slug}
                            onChange={(event) => setForm({ ...form, slug: event.target.value })}
                            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                          />
                        </label>

                        <label className="grid gap-2 text-sm text-stone-300 sm:col-span-2">
                          Descripción
                          <textarea
                            rows={4}
                            value={form.description}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            className="rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-base text-stone-100 outline-none focus:border-emerald-400"
                          />
                        </label>

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

                        <label className="grid gap-2 text-sm text-stone-300">
                          Estado
                          <select
                            value={form.active ? "active" : "inactive"}
                            onChange={(event) => setForm({ ...form, active: event.target.value === "active" })}
                            className="h-12 rounded-xl border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 outline-none focus:border-emerald-400"
                          >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className={mobileEditorScreen === "variants" || mobileEditorScreen === "variant-form" ? "block" : "hidden lg:block"}>
                    <div className="rounded-[28px] border border-stone-800 bg-stone-950/70 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-100">Variantes</h3>
                          <p className="mt-1 text-sm text-stone-400">
                            Gestioná presentaciones, precios, visibilidad y componentes de cada variante.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addVariant}
                          className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20"
                        >
                          Agregar variante
                        </button>
                      </div>

                      <div className="mt-5 lg:hidden">
                        {mobileEditorScreen === "variant-form" && mobileVariant ? (
                          <div className="space-y-4">
                            <button
                              type="button"
                              onClick={() => setMobileEditorScreen("variants")}
                              className="text-sm text-stone-400 transition hover:text-stone-200"
                            >
                              ← Volver a variantes
                            </button>

                            <VariantFields
                              componentOptions={componentOptions}
                              index={activeVariantIndex}
                              isMobile
                              isOnlyVariant={form.variants.length === 1}
                              variant={mobileVariant}
                              onAddComponent={addComponent}
                              onRemoveComponent={removeComponent}
                              onRemoveVariant={removeVariant}
                              onSetDefaultVariant={setDefaultVariant}
                              onSetVariantField={setVariantField}
                              onUpdateComponent={updateComponent}
                            />

                            <button
                              type="button"
                              onClick={() => setMobileEditorScreen("variants")}
                              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-5 text-base text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
                            >
                              Listo
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {form.variants.map((variant, index) => (
                              <button
                                key={variant.id ?? `mobile-variant-${index}`}
                                type="button"
                                onClick={() => openVariantEditor(index)}
                                className="w-full rounded-[24px] border border-stone-800 bg-stone-950/80 p-4 text-left transition hover:border-stone-600"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-base font-semibold text-stone-100">
                                      {variant.label || `Variante ${index + 1}`}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${getVariantTone(variant)}`}>
                                        {variant.active ? "Activa" : "Inactiva"}
                                      </span>
                                      <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-[11px] text-stone-300">
                                        {getVariantSummary(variant)}
                                      </span>
                                      {variant.isDefault ? (
                                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100">
                                          Default
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-3 text-sm text-stone-400">
                                      {formatCurrency(variant.cashPrice)} efectivo ·{" "}
                                      {formatCurrency(variant.transferPrice)} transf.
                                    </p>
                                  </div>
                                  <span className="text-xl text-stone-500">›</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 hidden space-y-4 lg:block">
                        {form.variants.map((variant, index) => (
                          <VariantFields
                            key={variant.id ?? `desktop-variant-${index}`}
                            componentOptions={componentOptions}
                            index={index}
                            isMobile={false}
                            isOnlyVariant={form.variants.length === 1}
                            variant={variant}
                            onAddComponent={addComponent}
                            onRemoveComponent={removeComponent}
                            onRemoveVariant={removeVariant}
                            onSetDefaultVariant={setDefaultVariant}
                            onSetVariantField={setVariantField}
                            onUpdateComponent={updateComponent}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-800 px-5 py-4 sm:px-6 lg:px-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/panel/products"
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-5 text-base text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
                    >
                      Cancelar
                    </Link>
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
                    ) : (
                      <button
                        type="button"
                        onClick={resetToNewProduct}
                        className="hidden lg:inline-flex h-12 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-5 text-base text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {message ? (
                    <p className="text-sm text-stone-300 sm:max-w-xs sm:text-right">{message}</p>
                  ) : (
                    <p className="text-sm text-stone-500">
                      {form.variants.length} variante{form.variants.length === 1 ? "" : "s"} en este producto.
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </section>
  );
}
