import { ProductCatalogManager } from "@/components/product-catalog-manager";
import { requirePageRole } from "@/lib/auth";
import { getProductCatalogDbErrorMessage, loadCatalog } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
const ADMIN_ONLY = ["admin"] as const;

export default async function ProductsPage() {
  await requirePageRole(ADMIN_ONLY, "/panel/products");
  const supabase = createAdminClient();
  const { data: products, error } = await loadCatalog(supabase);

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
          initialProducts={products ?? []}
          initialMessage={error ? getProductCatalogDbErrorMessage(error, "load") : ""}
        />
      </section>
    </main>
  );
}
