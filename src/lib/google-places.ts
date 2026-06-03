import "server-only";

import { AddressKind } from "@/lib/address";

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      types?: string[];
    };
  }>;
};

type GooglePlaceDetailsResponse = {
  types?: string[];
  shortFormattedAddress?: string;
  displayName?: { text?: string };
  addressComponents?: Array<{
    shortText?: string;
    longText?: string;
    types?: string[];
  }>;
};

export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
};

export type PlaceDetailsResult = {
  suggestedAddressKind: AddressKind;
  displayLabel: string;
  gatedCommunityName: string;
  addressLine1: string;
  locality: string;
  administrativeAreaLevel1: string;
  postalCode: string;
  googlePlaceId: string;
};

function getApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? "";
}

function findComponent(
  components: GooglePlaceDetailsResponse["addressComponents"],
  type: string
) {
  return components?.find((component) => component.types?.includes(type));
}

function detectAddressKind(types: string[] = []) {
  if (types.includes("street_address") || types.includes("subpremise")) {
    return "standard" as const;
  }

  if (
    types.includes("establishment") ||
    types.includes("point_of_interest") ||
    types.includes("premise") ||
    types.includes("route")
  ) {
    return "gated" as const;
  }

  return "standard" as const;
}

async function googleFetch<T>(input: string, init?: RequestInit) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("missing_google_maps_api_key");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`google_places_error:${response.status}:${body}`);
  }

  return response.json() as Promise<T>;
}

export async function getPlaceAutocompleteSuggestions(query: string) {
  const body = {
    input: query,
    includedRegionCodes: [process.env.GOOGLE_PLACES_REGION ?? "ar"],
    languageCode: "es"
  };

  const data = await googleFetch<GoogleAutocompleteResponse>(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "X-Goog-FieldMask": [
          "suggestions.placePrediction.placeId",
          "suggestions.placePrediction.text.text",
          "suggestions.placePrediction.structuredFormat.mainText.text",
          "suggestions.placePrediction.structuredFormat.secondaryText.text",
          "suggestions.placePrediction.types"
        ].join(",")
      },
      body: JSON.stringify(body)
    }
  );

  return (data.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
    .map((prediction) => ({
      placeId: prediction.placeId ?? "",
      mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
      fullText: prediction.text?.text ?? "",
      types: prediction.types ?? []
    }))
    .filter((prediction) => prediction.placeId && prediction.mainText);
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const encodedPlaceId = encodeURIComponent(placeId);
  const data = await googleFetch<GooglePlaceDetailsResponse>(
    `https://places.googleapis.com/v1/places/${encodedPlaceId}?languageCode=es`,
    {
      headers: {
        "X-Goog-FieldMask": [
          "types",
          "shortFormattedAddress",
          "displayName.text",
          "addressComponents.shortText",
          "addressComponents.longText",
          "addressComponents.types"
        ].join(",")
      }
    }
  );

  const route = findComponent(data.addressComponents, "route")?.shortText ?? "";
  const streetNumber = findComponent(data.addressComponents, "street_number")?.shortText ?? "";
  const locality = findComponent(data.addressComponents, "locality")?.shortText ?? "";
  const province = findComponent(data.addressComponents, "administrative_area_level_1")?.shortText ?? "";
  const postalCode = findComponent(data.addressComponents, "postal_code")?.shortText ?? "";
  const addressLine1 = [route, streetNumber].filter(Boolean).join(" ") || data.shortFormattedAddress || data.displayName?.text || "";
  const suggestedAddressKind = detectAddressKind(data.types ?? []);

  return {
    suggestedAddressKind,
    displayLabel: data.displayName?.text || data.shortFormattedAddress || addressLine1,
    gatedCommunityName: suggestedAddressKind === "gated" ? (data.displayName?.text ?? "") : "",
    addressLine1,
    locality,
    administrativeAreaLevel1: province,
    postalCode,
    googlePlaceId: placeId
  };
}
