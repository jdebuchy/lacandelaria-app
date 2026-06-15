import { LogisticsDepotsManager } from "@/components/logistics-depots-manager";
import { requirePageRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type DepotRow = {
  active: boolean;
  address_line_1: string;
  administrative_area_level_1: string;
  code: string;
  google_place_id: string | null;
  id: string;
  label: string;
  locality: string;
};

export default async function LogisticsDepotsPage() {
  await requirePageRole(["admin"], "/panel/logistics/depots");
  const supabase = createAdminClient();
  const { data: depots } = await supabase
    .from("logistics_depots")
    .select("id, code, label, address_line_1, locality, administrative_area_level_1, google_place_id, active")
    .order("label", { ascending: true });

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Logística
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Depósitos de salida
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Cargá y mantené los domicilios que funcionan como origen y destino de los viajes.
          </p>
        </div>

        <LogisticsDepotsManager depots={((depots ?? []) as DepotRow[])} />
      </section>
    </main>
  );
}
