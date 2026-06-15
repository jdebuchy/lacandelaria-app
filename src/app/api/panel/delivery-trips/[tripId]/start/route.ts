import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { recordOrderActivities } from "@/lib/order-activities";
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
    .select("id, driver_user_id, status, scheduled_date")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json(
      { success: false, message: "No se encontro el viaje." },
      { status: 404 }
    );
  }

  if (trip.status === "completed" || trip.status === "cancelled") {
    return NextResponse.json(
      { success: false, message: "Ese viaje ya no se puede iniciar." },
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

  const effectiveDriverId = trip.driver_user_id || authResult.auth.profile.id;
  const { data: activeTripOrders, error: tripOrdersError } = await supabase
    .from("delivery_trip_orders")
    .select("order_id")
    .eq("delivery_trip_id", tripId)
    .is("released_at", null);

  if (tripOrdersError) {
    console.error("trip order fetch failed", tripOrdersError);
    return NextResponse.json(
      { success: false, message: "No se pudieron cargar los pedidos del viaje." },
      { status: 500 }
    );
  }

  const orderIds = (activeTripOrders ?? []).map((item) => item.order_id);

  if (!orderIds.length) {
    return NextResponse.json(
      { success: false, message: "Ese viaje no tiene pedidos activos." },
      { status: 400 }
    );
  }

  const startedAt = new Date().toISOString();
  const { error: tripUpdateError } = await supabase
    .from("delivery_trips")
    .update({
      status: "in_route",
      started_at: startedAt,
      driver_user_id: effectiveDriverId,
      completed_at: null
    })
    .eq("id", tripId);

  if (tripUpdateError) {
    console.error("trip start failed", tripUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudo iniciar el viaje." },
      { status: 500 }
    );
  }

  const { error: ordersUpdateError } = await supabase
    .from("orders")
    .update({ status: "in_route" })
    .in("id", orderIds);

  if (ordersUpdateError) {
    console.error("trip orders status update failed", ordersUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudieron actualizar los pedidos del viaje." },
      { status: 500 }
    );
  }

  const { error: tripOrdersUpdateError } = await supabase
    .from("delivery_trip_orders")
    .update({
      resolved_at: null,
      stop_failure_reason: null,
      stop_note: null,
      stop_status: "in_route"
    })
    .eq("delivery_trip_id", tripId)
    .is("released_at", null);

  if (tripOrdersUpdateError) {
    console.error("trip order status update failed", tripOrdersUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudieron preparar las paradas del viaje." },
      { status: 500 }
    );
  }

  const { error: deliveriesUpdateError } = await supabase
    .from("deliveries")
    .update({
      assigned_date: trip.scheduled_date,
      driver_user_id: effectiveDriverId,
      delivery_status: "in_route",
      failure_reason: null
    })
    .in("order_id", orderIds);

  if (deliveriesUpdateError) {
    console.error("trip deliveries status update failed", deliveriesUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudieron iniciar las entregas del viaje." },
      { status: 500 }
    );
  }

  await recordOrderActivities(
    supabase,
    orderIds.map((orderId) => ({
      actorUserId: authResult.auth.profile.id,
      metadata: {
        deliveryTripId: tripId,
        driverUserId: effectiveDriverId,
        startedAt
      },
      orderId,
      summary: "Pedido marcado en ruta al iniciar el viaje.",
      type: "order_delivery_updated"
    }))
  );

  return NextResponse.json({
    success: true,
    message: "Viaje iniciado correctamente."
  });
}
