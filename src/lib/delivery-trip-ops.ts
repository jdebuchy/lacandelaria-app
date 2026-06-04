import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryTripStatus, OrderStatus } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type ActiveTripOrderRow = {
  delivery_trip_id: string;
  order_id: string;
};

export async function getActiveTripOrder(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from("delivery_trip_orders")
    .select("id, delivery_trip_id, order_id, sequence_number")
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
  const { data: activeRows, error: activeRowsError } = await admin
    .from("delivery_trip_orders")
    .select("delivery_trip_id, order_id")
    .eq("delivery_trip_id", tripId)
    .is("released_at", null);

  if (activeRowsError) {
    throw activeRowsError;
  }

  const activeTripOrders = (activeRows ?? []) as ActiveTripOrderRow[];

  if (!activeTripOrders.length) {
    const { error } = await admin
      .from("delivery_trips")
      .update({
        status: "completed" satisfies DeliveryTripStatus,
        completed_at: new Date().toISOString()
      })
      .eq("id", tripId);

    if (error) {
      throw error;
    }

    return;
  }

  const orderIds = activeTripOrders.map((row) => row.order_id);
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, status")
    .in("id", orderIds);

  if (ordersError) {
    throw ordersError;
  }

  const unresolved = (orders ?? []).some((order) => order.status !== ("delivered" satisfies OrderStatus));

  const nextStatus: DeliveryTripStatus = unresolved ? "in_route" : "completed";
  const payload =
    nextStatus === "completed"
      ? { status: nextStatus, completed_at: new Date().toISOString() }
      : { status: nextStatus, completed_at: null };

  const { error } = await admin.from("delivery_trips").update(payload).eq("id", tripId);

  if (error) {
    throw error;
  }
}
