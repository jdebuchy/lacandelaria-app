import { z } from "zod";

export const ADDRESS_KIND_VALUES = ["standard", "gated"] as const;
export const ADDRESS_SOURCE_VALUES = ["manual", "google_places"] as const;

export type AddressKind = (typeof ADDRESS_KIND_VALUES)[number];
export type AddressSource = (typeof ADDRESS_SOURCE_VALUES)[number];

export const structuredAddressSchema = z.object({
  addressKind: z.enum(ADDRESS_KIND_VALUES),
  addressLine1: z.string().optional().or(z.literal("")),
  addressLine2: z.string().optional().or(z.literal("")),
  gatedCommunityName: z.string().optional().or(z.literal("")),
  locality: z.string().optional().or(z.literal("")),
  administrativeAreaLevel1: z.string().optional().or(z.literal("")),
  postalCode: z.string().optional().or(z.literal("")),
  googlePlaceId: z.string().optional().or(z.literal("")),
  googlePlaceLabel: z.string().optional().or(z.literal("")),
  addressSource: z.enum(ADDRESS_SOURCE_VALUES)
});

export type StructuredAddress = z.infer<typeof structuredAddressSchema>;

export const EMPTY_STRUCTURED_ADDRESS: StructuredAddress = {
  addressKind: "standard",
  addressLine1: "",
  addressLine2: "",
  gatedCommunityName: "",
  locality: "",
  administrativeAreaLevel1: "",
  postalCode: "",
  googlePlaceId: "",
  googlePlaceLabel: "",
  addressSource: "manual"
};

const CAPITAL_FEDERAL_KEYWORDS = [
  "capital federal",
  "caba",
  "ciudad autonoma de buenos aires",
  "ciudad de buenos aires",
  "cdad. autonoma de buenos aires"
];

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

function normalize(value?: string | null) {
  return clean(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function normalizeStructuredAddress(input: StructuredAddress): StructuredAddress {
  return {
    addressKind: input.addressKind,
    addressLine1: clean(input.addressLine1),
    addressLine2: clean(input.addressLine2),
    gatedCommunityName: clean(input.gatedCommunityName),
    locality: clean(input.locality),
    administrativeAreaLevel1: clean(input.administrativeAreaLevel1),
    postalCode: clean(input.postalCode),
    googlePlaceId: clean(input.googlePlaceId),
    googlePlaceLabel: clean(input.googlePlaceLabel),
    addressSource: input.addressSource
  };
}

export function looksLikeCapitalFederal(values: Array<string | null | undefined>) {
  return values.some((value) => {
    const normalized = normalize(value);

    if (!normalized) {
      return false;
    }

    return CAPITAL_FEDERAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
  });
}

export function deriveDeliveryArea(input: StructuredAddress) {
  const address = normalizeStructuredAddress(input);
  const candidates = [
    address.locality,
    address.administrativeAreaLevel1,
    address.googlePlaceLabel,
    address.addressLine1
  ];

  if (looksLikeCapitalFederal(candidates)) {
    return "capital_federal";
  }

  if (!address.locality || !address.administrativeAreaLevel1) {
    return "pending_review";
  }

  return "standard";
}

export function toStructuredAddressColumns(input: StructuredAddress) {
  const address = normalizeStructuredAddress(input);

  return {
    address_kind: address.addressKind,
    address_line_1: address.addressLine1 || null,
    address_line_2: address.addressLine2 || null,
    gated_community_name: address.gatedCommunityName || null,
    locality: address.locality || null,
    administrative_area_level_1: address.administrativeAreaLevel1 || null,
    postal_code: address.postalCode || null,
    google_place_id: address.googlePlaceId || null,
    google_place_label: address.googlePlaceLabel || null,
    address_source: address.addressSource,
    delivery_area: deriveDeliveryArea(address)
  };
}

export function formatStructuredAddressSummary(input: Partial<StructuredAddress>) {
  const addressKind = input.addressKind ?? "standard";
  const parts = addressKind === "gated"
    ? [clean(input.gatedCommunityName), clean(input.addressLine1), clean(input.locality)]
    : [clean(input.addressLine1), clean(input.locality)];

  return parts.filter(Boolean).join(" · ") || "-";
}

export function formatStructuredAddressLine(input: Partial<StructuredAddress>) {
  const addressKind = input.addressKind ?? "standard";
  const line1 = clean(input.addressLine1);
  const line2 = clean(input.addressLine2);
  const gatedCommunityName = clean(input.gatedCommunityName);

  if (addressKind === "gated") {
    return [gatedCommunityName, line1, line2 ? `Lote ${line2}` : ""].filter(Boolean).join(", ");
  }

  return [line1, line2].filter(Boolean).join(", ");
}

export function splitFullName(fullName?: string | null) {
  const trimmed = clean(fullName);
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return { firstName: trimmed, lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? ""
  };
}

export function addressLine2Label(addressKind: AddressKind) {
  return addressKind === "gated" ? "Lote" : "Piso / Depto";
}
