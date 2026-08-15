import Link from "next/link";
import type { ProductFamily } from "@/lib/types";

type ProductCatalogListProps = {
  products: ProductFamily[];
};

export function ProductCatalogList({ products }: ProductCatalogListProps) {
  return (
    <section className="rounded-card border border-line bg-paper p-6">
      <div>
        <h2 className="text-title font-semibold text-ink">Catálogo actual</h2>
        <p className="mt-1 text-body text-ink-soft">
          Productos base con variantes vendibles, internas y bundles configurables.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        {products.length ? (
          products.map((product) => (
            <Link
              key={product.id}
              href={`/panel/products/${product.id}/edit`}
              className="rounded-card border border-line bg-paper-muted p-4 text-left transition hover:border-line"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body font-semibold text-ink">{product.name}</p>
                  <p className="mt-1 text-body text-ink-soft">
                    {product.variants.length} variante{product.variants.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`rounded-control border px-3 py-1 text-meta ${
                    product.active
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-paper text-ink-soft"
                  }`}
                >
                  {product.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {product.variants.map((variant) => (
                  <div key={variant.id} className="rounded-card bg-paper p-3 text-body">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">
                        {variant.label}
                        {variant.isDefault ? " · default" : ""}
                      </p>
                      <p className="text-ink-faint">
                        {variant.visibility === "sellable" ? "Vendible" : "Interna"} ·{" "}
                        {variant.compositionType === "bundle" ? "Compuesta" : "Simple"}
                      </p>
                    </div>
                    <p className="mt-1 text-ink-soft">
                      ${variant.cashPrice.toLocaleString("es-AR")} efectivo · $
                      {variant.transferPrice.toLocaleString("es-AR")} transferencia
                    </p>
                    {variant.components.length ? (
                      <p className="mt-1 text-meta text-ink-faint">
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
          <div className="rounded-card border border-dashed border-line bg-paper-muted px-4 py-8 text-body text-ink-faint">
            Todavía no hay productos cargados.
          </div>
        )}
      </div>
    </section>
  );
}
