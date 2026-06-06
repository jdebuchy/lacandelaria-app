import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = {
  params: Promise<{
    tripId: string;
  }>;
};

export async function POST(_: Request, context: Params) {
  const authResult = await requireApiRole(DRIVER_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const { tripId } = await context.params;
  const supabase = createAdminClient();
  const { data: trip, error: tripError } = await supabase
    .from("delivery_trips")
    .select("id, driver_user_id, status")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json(
      { success: false, message: "No se encontro el viaje." },
      { status: 404 }
    );
  }

  if (trip.status === "completed") {
    return NextResponse.json(
      { success: false, message: "Ese viaje ya estaba finalizado." },
      { status: 409 }
    );
  }

  if (trip.status === "cancelled" || trip.status === "assigned") {
    return NextResponse.json(
      { success: false, message: "Solo se puede finalizar un viaje que ya esta en reparto." },
      { status: 409 }
    );
  }

  if (
    authResult.auth.profile.role === "driver" &&
    trip.driver_user_id &&
    trip.driver_user_id !== authResult.auth.profile.id
  ) {
    return NextResponse.json(
      { success: false, message: "Ese viaje esta asignado a otro repartidor." },
      { status: 403 }
    );
  }

  const { data: tripOrders, error: tripOrdersError } = await supabase
    .from("delivery_trip_orders")
    .select("id, order_id, released_at, stop_status")
    .eq("delivery_trip_id", tripId);

  if (tripOrdersError) {
    console.error("trip completion rows fetch failed", tripOrdersError);
    return NextResponse.json(
      { success: false, message: "No se pudo validar el estado de las paradas del viaje." },
      { status: 500 }
    );
  }

  const activeOrderIds = (tripOrders ?? [])
    .filter((row) => !row.released_at)
    .map((row) => row.order_id);

  const { data: deliveries, error: deliveriesError } = activeOrderIds.length
    ? await supabase
        .from("deliveries")
        .select("order_id, delivery_status")
        .in("order_id", activeOrderIds)
    : { data: [], error: null };

  if (deliveriesError) {
    console.error("trip completion deliveries fetch failed", deliveriesError);
    return NextResponse.json(
      { success: false, message: "No se pudieron validar las entregas activas del viaje." },
      { status: 500 }
    );
  }

  const deliveryByOrderId = new Map((deliveries ?? []).map((delivery) => [delivery.order_id, delivery.delivery_status]));
  const hasPendingStops = (tripOrders ?? []).some((row) => {
    if (row.released_at) {
      const releasedStatus = row.stop_status ?? "failed";
      return releasedStatus !== "delivered" && releasedStatus !== "failed";
    }

    const activeStatus = deliveryByOrderId.get(row.order_id) ?? row.stop_status;
    return activeStatus !== "delivered" && activeStatus !== "failed";
  });

  if (hasPendingStops) {
    return NextResponse.json(
      {
        success: false,
        message: "Todavia hay pedidos pendientes o en reparto. Resolve todas las paradas antes de finalizar."
      },
      { status: 409 }
    );
  }

  const completedAt = new Date().toISOString();
  const { error: tripUpdateError } = await supabase
    .from("delivery_trips")
    .update({
      completed_at: completedAt,
      status: "completed"
    })
    .eq("id", tripId);

  if (tripUpdateError) {
    console.error("trip complete failed", tripUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudo finalizar el viaje." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Viaje finalizado correctamente."
  });
}
