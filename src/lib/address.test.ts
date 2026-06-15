import { describe, expect, it } from "vitest";
import {
  EMPTY_STRUCTURED_ADDRESS,
  addressLine2Label,
  deriveDeliveryArea,
  formatStructuredAddressLine,
  formatStructuredAddressSummary,
  looksLikeCapitalFederal,
  normalizeStructuredAddress,
  splitFullName,
  toStructuredAddressColumns
} from "@/lib/address";

describe("address", () => {
  it("normalizes structured addresses by trimming text fields", () => {
    expect(
      normalizeStructuredAddress({
        ...EMPTY_STRUCTURED_ADDRESS,
        addressLine1: "  Av. Siempre Viva 123  ",
        locality: "  CABA "
      })
    ).toMatchObject({
      addressLine1: "Av. Siempre Viva 123",
      locality: "CABA"
    });
  });

  it("detects Capital Federal aliases without accents", () => {
    expect(looksLikeCapitalFederal(["CABA"])).toBe(true);
    expect(looksLikeCapitalFederal(["Ciudad Autónoma de Buenos Aires"])).toBe(true);
    expect(looksLikeCapitalFederal(["Capital Federal"])).toBe(true);
    expect(looksLikeCapitalFederal(["La Plata", "", null])).toBe(false);
  });

  it("derives delivery areas from address fields", () => {
    expect(deriveDeliveryArea({ ...EMPTY_STRUCTURED_ADDRESS, locality: "CABA" })).toBe("capital_federal");
    expect(deriveDeliveryArea({ ...EMPTY_STRUCTURED_ADDRESS, locality: "City Bell" })).toBe("pending_review");
    expect(
      deriveDeliveryArea({
        ...EMPTY_STRUCTURED_ADDRESS,
        administrativeAreaLevel1: "Buenos Aires",
        locality: "City Bell"
      })
    ).toBe("standard");
  });

  it("maps structured addresses to Supabase columns", () => {
    expect(
      toStructuredAddressColumns({
        ...EMPTY_STRUCTURED_ADDRESS,
        addressLine1: " Calle 1 ",
        administrativeAreaLevel1: " Buenos Aires ",
        locality: " La Plata ",
        postalCode: "",
        googlePlaceId: ""
      })
    ).toEqual({
      address_kind: "standard",
      address_line_1: "Calle 1",
      address_line_2: null,
      gated_community_name: null,
      locality: "La Plata",
      administrative_area_level_1: "Buenos Aires",
      postal_code: null,
      google_place_id: null,
      google_place_label: null,
      address_source: "manual",
      delivery_area: "standard"
    });
  });

  it("formats standard and gated address summaries", () => {
    expect(formatStructuredAddressSummary({ addressLine1: "Calle 1", locality: "La Plata" })).toBe(
      "Calle 1 · La Plata"
    );
    expect(
      formatStructuredAddressSummary({
        addressKind: "gated",
        gatedCommunityName: "Barrio Norte",
        addressLine1: "Acceso 1",
        locality: "City Bell"
      })
    ).toBe("Barrio Norte · Acceso 1 · City Bell");
    expect(formatStructuredAddressSummary({})).toBe("-");
  });

  it("formats standard and gated address lines", () => {
    expect(formatStructuredAddressLine({ addressLine1: "Calle 1", addressLine2: "2B" })).toBe("Calle 1, 2B");
    expect(
      formatStructuredAddressLine({
        addressKind: "gated",
        gatedCommunityName: "Barrio Norte",
        addressLine1: "Acceso 1",
        addressLine2: "12"
      })
    ).toBe("Barrio Norte, Acceso 1, Lote 12");
  });

  it("splits full names and returns address line 2 labels", () => {
    expect(splitFullName("Juan Martin Perez")).toEqual({ firstName: "Juan Martin", lastName: "Perez" });
    expect(splitFullName("Juan")).toEqual({ firstName: "Juan", lastName: "" });
    expect(addressLine2Label("gated")).toBe("Lote");
    expect(addressLine2Label("standard")).toBe("Piso / Depto");
  });
});
