import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCatalogManager } from "@/components/product-catalog-manager";
import { requirePageRole } from "@/lib/auth";
import { loadCatalog } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ONLY = ["admin"] as const;

export default async function EditProductPage({
  params
}: {
  params: Promise<{ productId: string }>;
}) {
  await requirePageRole(ADMIN_ONLY, "/panel/products");
  const { productId } = await params;
  const supabase = createAdminClient();
  const { data: products, error } = await loadCatalog(supabase);

  if (error) {
    throw error;
  }

  const product = (products ?? []).find((item) => item.id === productId);

  if (!product) {
    notFound();
  }

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
              Editar producto
            </h1>
            <p className="mt-2 text-stone-400">
              Ajustá la configuración comercial de {product.name}, sus variantes y bundles.
            </p>
          </div>
        </div>

        <ProductCatalogManager
          initialProducts={products ?? []}
          initialEditingProduct={product}
          mode="form-only"
        />
      </section>
    </main>
  );
}
