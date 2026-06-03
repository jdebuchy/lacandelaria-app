import { ManualOrderForm } from "@/components/manual-order-form";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

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

export default async function NewManualOrderPage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders/new");
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, description, sales_unit_label, cash_price, transfer_price, active, display_order")
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <main>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Nuevo pedido
          </h1>
        </div>

        <ManualOrderForm products={mapProducts(products ?? [])} />
      </section>
    </main>
  );
}
