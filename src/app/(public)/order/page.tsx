import { PublicOrderForm } from "@/components/public-order-form";
import { loadCatalog } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PublicOrderPage() {
  const supabase = createAdminClient();
  const { data: products } = await loadCatalog(supabase, {
    onlyActiveFamilies: true,
    onlySellableVariants: true,
    onlyActiveVariants: true
  });

  return (
    <main>
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-16">
        <div className="space-y-4">
          <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
            Pedido publico sin login
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Hace tu pedido
          </h1>
          <p className="max-w-2xl text-base leading-7 text-stone-300">
            El cliente no necesita usuario ni password. Completa sus datos y el pedido entra
            pendiente de confirmacion para que el equipo valide stock, zona y entrega.
          </p>
        </div>

        <PublicOrderForm products={products ?? []} />
      </section>
    </main>
  );
}
