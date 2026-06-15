import { describe, expect, it } from "vitest";
import { recordOrderActivities, recordOrderActivity } from "@/lib/order-activities";

describe("order activities", () => {
  it("inserts a single order activity payload", async () => {
    const inserts: unknown[] = [];
    const supabase = {
      from: (table: string) => ({
        insert: (payload: unknown) => {
          inserts.push({ payload, table });
          return Promise.resolve({ error: null });
        }
      })
    };

    await recordOrderActivity(supabase as never, {
      actorUserId: "user-1",
      metadata: { amount: 100 },
      orderId: "order-1",
      summary: "Pago registrado.",
      type: "payment_received"
    });

    expect(inserts).toEqual([
      {
        table: "order_activities",
        payload: {
          actor_user_id: "user-1",
          activity_type: "payment_received",
          metadata: { amount: 100 },
          order_id: "order-1",
          summary: "Pago registrado."
        }
      }
    ]);
  });

  it("skips bulk insert when there are no activities", async () => {
    const supabase = {
      from: () => {
        throw new Error("from should not be called");
      }
    };

    await expect(recordOrderActivities(supabase as never, [])).resolves.toBeUndefined();
  });
});
