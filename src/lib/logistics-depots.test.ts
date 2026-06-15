import { describe, expect, it } from "vitest";
import { loadActiveLogisticsDepot, loadActiveLogisticsDepots } from "@/lib/logistics-depots";

function createSupabaseMock(result: unknown) {
  const query = {
    eq: () => query,
    order: () => result,
    select: () => query,
    single: () => result
  };

  return {
    from: () => query
  };
}

describe("logistics depots", () => {
  it("loads active depots ordered by label", async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          address_line_1: "Calle 1",
          administrative_area_level_1: "Buenos Aires",
          code: "casa_juan",
          google_place_id: "place-1",
          id: "depot-1",
          label: "Casa Juan",
          locality: "La Plata"
        }
      ],
      error: null
    });

    const depots = await loadActiveLogisticsDepots(supabase as never);

    expect(depots).toEqual([
      {
        addressLine1: "Calle 1",
        administrativeAreaLevel1: "Buenos Aires",
        code: "casa_juan",
        googlePlaceId: "place-1",
        id: "depot-1",
        label: "Casa Juan",
        locality: "La Plata"
      }
    ]);
  });

  it("rejects missing or inactive depots", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: { message: "not found" }
    });

    await expect(loadActiveLogisticsDepot(supabase as never, "depot-1")).rejects.toThrow(
      "Selecciona un depósito activo."
    );
  });
});
