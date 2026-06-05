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
      <ProductCatalogManager
        initialProducts={products ?? []}
        initialEditingProduct={product}
        editorMode="edit"
      />
    </main>
  );
}
