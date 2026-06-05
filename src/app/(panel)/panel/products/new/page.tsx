import { ProductCatalogManager } from "@/components/product-catalog-manager";
import { requirePageRole } from "@/lib/auth";
import { getProductCatalogDbErrorMessage, loadCatalog } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ONLY = ["admin"] as const;

export default async function NewProductPage() {
  await requirePageRole(ADMIN_ONLY, "/panel/products/new");
  const supabase = createAdminClient();
  const { data: products, error } = await loadCatalog(supabase);

  return (
    <main>
      {error ? (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <p className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">
            {getProductCatalogDbErrorMessage(error, "load")}
          </p>
        </section>
      ) : (
        <ProductCatalogManager initialProducts={products ?? []} editorMode="new" />
      )}
    </main>
  );
}
