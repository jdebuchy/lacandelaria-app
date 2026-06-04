import { ProductCatalogManager } from "@/components/product-catalog-manager";
import { requirePageRole } from "@/lib/auth";
import { getProductCatalogDbErrorMessage, PRODUCT_SELECT_COLUMNS } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

const ADMIN_ONLY = ["admin"] as const;

function mapProducts(rows: Array<Record<string, unknown>>): Product[] {
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: typeof row.description === "string" ? row.description : null,
    salesUnitLabel: String(row.sales_unit_label),
    cashPrice: Number(row.cash_price),
    transferPrice: Number(row.transfer_price),
    active: Boolean(row.active),
    displayOrder: Number(row.display_order ?? 0)
  }));
}

export default async function ProductsPage() {
  await requirePageRole(ADMIN_ONLY, "/panel/products");
  const supabase = createAdminClient();
  const { data: products, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT_COLUMNS)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Catálogo de productos
          </h1>
          <p className="mt-2 text-stone-400">
            Gestión centralizada de productos, unidades comerciales y precios por medio de pago.
          </p>
        </div>

        <ProductCatalogManager
          initialProducts={mapProducts(products ?? [])}
          initialMessage={error ? getProductCatalogDbErrorMessage(error, "load") : ""}
        />
      </section>
    </main>
  );
}
