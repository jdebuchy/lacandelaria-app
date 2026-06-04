import Link from "next/link";
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
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/panel/products"
              className="text-sm text-stone-500 transition hover:text-stone-300"
            >
              ← Volver a productos
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Nuevo producto
            </h1>
            <p className="mt-2 text-stone-400">
              Creá un producto base, sus variantes vendibles o internas y la composición de bundles.
            </p>
            {error ? (
              <p className="mt-2 text-sm text-rose-300">
                {getProductCatalogDbErrorMessage(error, "load")}
              </p>
            ) : null}
          </div>
        </div>

        <ProductCatalogManager initialProducts={products ?? []} mode="form-only" />
      </section>
    </main>
  );
}
