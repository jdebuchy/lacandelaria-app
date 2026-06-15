import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { recordOrderActivities } from "@/lib/order-activities";
import { createAdminClient } from "@/lib/supabase/admin";

const updateTripSchema = z.object({
  scheduledDate: z.string().min(1, "Selecciona una fecha."),
  driverUserId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  sequence: z.array(
    z.object({
      orderId: z.string().uuid(),
      sequenceNumber: z.number().int().min(1)
    })
  )
});

type Params = {
  params: Promise<{
    tripId: string;
  }>;
};

export async function PATCH(request: Request, context: Params) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const { tripId } = await context.params;
  const body = await request.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "No se pudo actualizar el viaje." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: trip, error: tripError } = await supabase
    .from("delivery_trips")
    .select("id, status")
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
      { success: false, message: "Ese viaje ya no admite cambios." },
      { status: 409 }
    );
  }

  const orderIds = parsed.data.sequence.map((item) => item.orderId);
  const uniqueOrderIds = new Set(orderIds);

  if (uniqueOrderIds.size !== orderIds.length) {
    return NextResponse.json(
      { success: false, message: "No se puede repetir un pedido en la secuencia." },
      { status: 400 }
    );
  }

  const { data: activeTripOrders, error: tripOrdersError } = await supabase
    .from("delivery_trip_orders")
    .select("id, order_id")
    .eq("delivery_trip_id", tripId)
    .is("released_at", null);

  if (tripOrdersError) {
    console.error("trip orders fetch failed", tripOrdersError);
    return NextResponse.json(
      { success: false, message: "No se pudo validar la secuencia del viaje." },
      { status: 500 }
    );
  }

  const activeOrderIds = new Set((activeTripOrders ?? []).map((item) => item.order_id));

  if (activeOrderIds.size !== uniqueOrderIds.size || [...uniqueOrderIds].some((orderId) => !activeOrderIds.has(orderId))) {
    return NextResponse.json(
      { success: false, message: "La secuencia no coincide con los pedidos activos del viaje." },
      { status: 400 }
    );
  }

  const { error: tripUpdateError } = await supabase
    .from("delivery_trips")
    .update({
      scheduled_date: parsed.data.scheduledDate,
      driver_user_id: parsed.data.driverUserId || null,
      notes: parsed.data.notes?.trim() || null
    })
    .eq("id", tripId);

  if (tripUpdateError) {
    console.error("trip update failed", tripUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudo actualizar el viaje." },
      { status: 500 }
    );
  }

  const tripOrderByOrderId = new Map((activeTripOrders ?? []).map((item) => [item.order_id, item.id]));

  for (const item of parsed.data.sequence) {
    const tripOrderId = tripOrderByOrderId.get(item.orderId);

    if (!tripOrderId) {
      continue;
    }

    const { error } = await supabase
      .from("delivery_trip_orders")
      .update({ sequence_number: item.sequenceNumber })
      .eq("id", tripOrderId);

    if (error) {
      console.error("trip order sequence update failed", error);
      return NextResponse.json(
        { success: false, message: "No se pudo guardar la secuencia del viaje." },
        { status: 500 }
      );
    }

    const { error: deliveryError } = await supabase
      .from("deliveries")
      .update({
        sequence_number: item.sequenceNumber,
        assigned_date: parsed.data.scheduledDate,
        driver_user_id: parsed.data.driverUserId || null
      })
      .eq("order_id", item.orderId);

    if (deliveryError) {
      console.error("delivery sequence update failed", deliveryError);
      return NextResponse.json(
        { success: false, message: "No se pudo sincronizar la secuencia de entrega." },
        { status: 500 }
      );
    }
  }

  await recordOrderActivities(
    supabase,
    parsed.data.sequence.map((item) => ({
      actorUserId: authResult.auth.profile.id,
      metadata: {
        deliveryTripId: tripId,
        driverUserId: parsed.data.driverUserId || null,
        scheduledDate: parsed.data.scheduledDate,
        sequenceNumber: item.sequenceNumber
      },
      orderId: item.orderId,
      summary: "Viaje de entrega actualizado.",
      type: "order_trip_updated"
    }))
  );

  return NextResponse.json({
    success: true,
    message: "Viaje actualizado correctamente."
  });
}
