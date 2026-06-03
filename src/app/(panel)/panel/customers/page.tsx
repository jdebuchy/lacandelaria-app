import { Suspense } from "react";
import { SiteNav } from "@/components/site-nav";
import { CustomerSearch } from "@/components/customer-search";
import { CustomerRecords } from "@/components/customer-records";
import { CsvImportButton } from "@/components/csv-import-button";
import { AddCustomerButton } from "@/components/add-customer-button";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{ q?: string }>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/customers");
  const { q } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("customers")
    .select(
      "id, first_name, last_name, phone, instagram, address_kind, address_line_1, address_line_2, gated_community_name, locality, administrative_area_level_1, postal_code, google_place_id, google_place_label, address_source, delivery_area, delivery_notes, source, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    const safeQ = q.replace(/[,()]/g, "");
    query = query.or(`first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%,instagram.ilike.%${safeQ}%`);
  }

  const { data: customers, error } = await query;
  if (error) throw error;
  const rows = customers ?? [];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-16">
        <div className="space-y-4">
          <SiteNav />
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Clientes
          </span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Listado de clientes
              </h1>
              <p className="mt-2 text-stone-400">
                {rows.length} {q ? "resultado(s) para la búsqueda" : "clientes registrados"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CsvImportButton />
              <AddCustomerButton />
              <Suspense>
                <CustomerSearch defaultValue={q ?? ""} />
              </Suspense>
            </div>
          </div>
        </div>

        <CustomerRecords rows={rows} query={q ?? ""} />
      </section>
    </main>
  );
}
