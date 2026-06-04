import Link from "next/link";
import type { ProductFamily } from "@/lib/types";

type ProductCatalogListProps = {
  products: ProductFamily[];
};

export function ProductCatalogList({ products }: ProductCatalogListProps) {
  return (
    <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">Catálogo actual</h2>
        <p className="mt-1 text-sm text-stone-400">
          Productos base con variantes vendibles, internas y bundles configurables.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        {products.length ? (
          products.map((product) => (
            <Link
              key={product.id}
              href={`/panel/products/${product.id}/edit`}
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
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-950/60 px-4 py-8 text-sm text-stone-500">
            Todavía no hay productos cargados.
          </div>
        )}
      </div>
    </section>
  );
}
