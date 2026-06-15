import { describe, expect, it } from "vitest";
import { saveDeliveryTripPlan } from "@/lib/delivery-planning";

type MockState = {
  activeTripOrders?: Array<{ id: string; order_id: string }>;
  depotExists?: boolean;
  status: string;
  updates: Array<{ payload: unknown; table: string }>;
};

class QueryMock {
  private operation: "insert" | "select" | "update" | null = null;
  private payload: unknown = null;
  private useSingle = false;

  constructor(
    private readonly table: string,
    private readonly state: MockState
  ) {}

  eq() {
    return this;
  }

  in() {
    return this;
  }

  is() {
    return this;
  }

  neq() {
    return this;
  }

  select() {
    this.operation = "select";
    return this;
  }

  single() {
    this.useSingle = true;
    return Promise.resolve(this.resolve());
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolve() {
    if (this.operation === "update") {
      this.state.updates.push({ payload: this.payload, table: this.table });
      return { data: null, error: null };
    }

    if (this.operation === "insert") {
      return { data: null, error: null };
    }

    if (this.table === "delivery_trips" && this.useSingle) {
      return { data: { id: "trip-1", status: this.state.status }, error: null };
    }

    if (this.table === "logistics_depots" && this.useSingle) {
      return this.state.depotExists === false
        ? { data: null, error: { message: "not found" } }
        : {
            data: {
              address_line_1: "Calle 1",
              administrative_area_level_1: "Buenos Aires",
              code: "casa_juan",
              google_place_id: null,
              id: "depot-2",
              label: "Casa Juan",
              locality: "La Plata"
            },
            error: null
          };
    }

    if (this.table === "delivery_trip_orders") {
      return {
        data: this.state.activeTripOrders ?? [{ id: "trip-order-1", order_id: "order-1" }],
        error: null
      };
    }

    return { data: null, error: null };
  }
}

function createSupabaseMock(state: MockState) {
  return {
    from: (table: string) => new QueryMock(table, state)
  };
}

describe("saveDeliveryTripPlan", () => {
  it("saves the selected depot for assigned trips", async () => {
    const state: MockState = {
      status: "assigned",
      updates: []
    };

    await saveDeliveryTripPlan(createSupabaseMock(state) as never, {
      depotId: "depot-2",
      driverUserId: null,
      notes: "",
      orderedStopIds: ["order-1"],
      scheduledDate: "2026-06-15",
      tripId: "trip-1"
    });

    expect(state.updates).toContainEqual({
      table: "delivery_trips",
      payload: {
        depot_id: "depot-2",
        driver_user_id: null,
        notes: null,
        scheduled_date: "2026-06-15"
      }
    });
  });

  it.each(["in_route", "completed", "cancelled"])(
    "prevents changing depots on %s trips",
    async (status) => {
      const state: MockState = {
        status,
        updates: []
      };

      await expect(
        saveDeliveryTripPlan(createSupabaseMock(state) as never, {
          depotId: "depot-2",
          driverUserId: null,
          notes: "",
          orderedStopIds: ["order-1"],
          scheduledDate: "2026-06-15",
          tripId: "trip-1"
        })
      ).rejects.toThrow();

      expect(state.updates).toEqual([]);
    }
  );
});
