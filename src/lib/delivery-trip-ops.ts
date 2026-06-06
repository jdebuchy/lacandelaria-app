import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryTripStatus } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type ActiveTripOrderRow = {
  delivery_trip_id: string;
  order_id: string;
};

export async function getActiveTripOrder(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from("delivery_trip_orders")
    .select("id, delivery_trip_id, order_id, sequence_number, stop_status, stop_failure_reason, stop_note")
    .eq("order_id", orderId)
    .is("released_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function releaseTripOrder(admin: AdminClient, orderId: string) {
  const activeTripOrder = await getActiveTripOrder(admin, orderId);

  if (!activeTripOrder?.id) {
    return null;
  }

  const { error } = await admin
    .from("delivery_trip_orders")
    .update({ released_at: new Date().toISOString() })
    .eq("id", activeTripOrder.id);

  if (error) {
    throw error;
  }

  return activeTripOrder.delivery_trip_id;
}

export async function syncTripCompletion(admin: AdminClient, tripId: string) {
  const { data: trip, error: tripError } = await admin
    .from("delivery_trips")
    .select("id, status")
    .eq("id", tripId)
    .limit(1)
    .maybeSingle();

  if (tripError) {
    throw tripError;
  }

  if (!trip || trip.status === ("completed" satisfies DeliveryTripStatus) || trip.status === ("cancelled" satisfies DeliveryTripStatus)) {
    return;
  }

  const { data: activeRows, error: activeRowsError } = await admin
    .from("delivery_trip_orders")
    .select("delivery_trip_id, order_id")
    .eq("delivery_trip_id", tripId)
    .is("released_at", null);

  if (activeRowsError) {
    throw activeRowsError;
  }

  const activeTripOrders = (activeRows ?? []) as ActiveTripOrderRow[];

  const nextStatus: DeliveryTripStatus =
    activeTripOrders.length || trip.status === ("in_route" satisfies DeliveryTripStatus)
      ? "in_route"
      : "assigned";
  const { error } = await admin
    .from("delivery_trips")
    .update({
      status: nextStatus,
      completed_at: null
    })
    .eq("id", tripId);

  if (error) {
    throw error;
  }
}
