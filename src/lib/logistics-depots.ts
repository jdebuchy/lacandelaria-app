import type { SupabaseClient } from "@supabase/supabase-js";

export type LogisticsDepot = {
  addressLine1: string;
  administrativeAreaLevel1: string;
  code: string;
  googlePlaceId: string | null;
  id: string;
  label: string;
  locality: string;
};

export const DEFAULT_LOGISTICS_DEPOT_CODE = "deposito_1";

export const DEFAULT_LOGISTICS_DEPOT_SEED = {
  address_line_1: "Juan Antonio Cabrera 4511",
  administrative_area_level_1: "Capital Federal",
  code: DEFAULT_LOGISTICS_DEPOT_CODE,
  google_place_id: null,
  label: "Depósito 1",
  locality: "Buenos Aires"
} as const;

export const DEFAULT_LOGISTICS_DEPOT_FALLBACK: LogisticsDepot = {
  addressLine1: DEFAULT_LOGISTICS_DEPOT_SEED.address_line_1,
  administrativeAreaLevel1: DEFAULT_LOGISTICS_DEPOT_SEED.administrative_area_level_1,
  code: DEFAULT_LOGISTICS_DEPOT_SEED.code,
  googlePlaceId: DEFAULT_LOGISTICS_DEPOT_SEED.google_place_id,
  id: DEFAULT_LOGISTICS_DEPOT_CODE,
  label: DEFAULT_LOGISTICS_DEPOT_SEED.label,
  locality: DEFAULT_LOGISTICS_DEPOT_SEED.locality
};

export const DEFAULT_LOGISTICS_DEPOT = DEFAULT_LOGISTICS_DEPOT_FALLBACK;

type LogisticsDepotRow = {
  address_line_1: string;
  administrative_area_level_1: string;
  code: string;
  google_place_id?: string | null;
  id: string;
  label: string;
  locality: string;
};

function buildLogisticsDepot(row: LogisticsDepotRow): LogisticsDepot {
  return {
    addressLine1: row.address_line_1,
    administrativeAreaLevel1: row.administrative_area_level_1,
    code: row.code,
    googlePlaceId: row.google_place_id ?? null,
    id: row.id,
    label: row.label,
    locality: row.locality
  };
}

export function formatLogisticsDepotAddress(depot: Pick<
  LogisticsDepot,
  "addressLine1" | "locality" | "administrativeAreaLevel1"
>) {
  return [depot.addressLine1, depot.locality, depot.administrativeAreaLevel1].filter(Boolean).join(", ");
}

export async function loadActiveLogisticsDepots(supabase: SupabaseClient): Promise<LogisticsDepot[]> {
  const { data, error } = await supabase
    .from("logistics_depots")
    .select("id, code, label, address_line_1, locality, administrative_area_level_1, google_place_id")
    .eq("active", true)
    .order("label", { ascending: true });

  if (error) {
    throw new Error("No se pudieron cargar los depósitos activos.");
  }

  return (data ?? []).map((row) => buildLogisticsDepot(row satisfies LogisticsDepotRow));
}

export async function loadActiveLogisticsDepot(
  supabase: SupabaseClient,
  depotId: string
): Promise<LogisticsDepot> {
  const { data, error } = await supabase
    .from("logistics_depots")
    .select("id, code, label, address_line_1, locality, administrative_area_level_1, google_place_id")
    .eq("id", depotId)
    .eq("active", true)
    .single();

  if (error || !data) {
    throw new Error("Selecciona un depósito activo.");
  }

  return buildLogisticsDepot(data satisfies LogisticsDepotRow);
}
