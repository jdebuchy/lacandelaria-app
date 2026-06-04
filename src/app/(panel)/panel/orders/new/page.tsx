import { ManualOrderForm } from "@/components/manual-order-form";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { loadCatalog } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NewManualOrderPage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders/new");
  const supabase = createAdminClient();
  const { data: products } = await loadCatalog(supabase, {
    onlyActiveFamilies: true,
    onlySellableVariants: true,
    onlyActiveVariants: true
  });

  return (
    <main>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Nuevo pedido
          </h1>
        </div>

        <ManualOrderForm products={products ?? []} />
      </section>
    </main>
  );
}
