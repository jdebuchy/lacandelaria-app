import type { SupabaseClient } from "@supabase/supabase-js";

export const ORDER_ACTIVITY_TYPES = [
  "order_created",
  "order_updated",
  "order_assigned_to_trip",
  "order_trip_updated",
  "order_released_from_trip",
  "order_delivery_updated",
  "payment_received",
  "payment_voided"
] as const;

export type OrderActivityType = (typeof ORDER_ACTIVITY_TYPES)[number];

type OrderActivityInput = {
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  orderId: string;
  summary: string;
  type: OrderActivityType;
};

export async function recordOrderActivity(
  supabase: SupabaseClient,
  { actorUserId, metadata, orderId, summary, type }: OrderActivityInput
) {
  const { error } = await supabase.from("order_activities").insert({
    actor_user_id: actorUserId ?? null,
    activity_type: type,
    metadata: metadata ?? {},
    order_id: orderId,
    summary
  });

  if (error) {
    console.error("order activity insert failed", error);
  }
}

export async function recordOrderActivities(
  supabase: SupabaseClient,
  activities: OrderActivityInput[]
) {
  if (!activities.length) {
    return;
  }

  const { error } = await supabase.from("order_activities").insert(
    activities.map((activity) => ({
      actor_user_id: activity.actorUserId ?? null,
      activity_type: activity.type,
      metadata: activity.metadata ?? {},
      order_id: activity.orderId,
      summary: activity.summary
    }))
  );

  if (error) {
    console.error("order activities insert failed", error);
  }
}
