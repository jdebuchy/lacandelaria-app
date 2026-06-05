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

export function formatLogisticsDepotAddress(depot: Pick<
  LogisticsDepot,
  "addressLine1" | "locality" | "administrativeAreaLevel1"
>) {
  return [depot.addressLine1, depot.locality, depot.administrativeAreaLevel1].filter(Boolean).join(", ");
}
