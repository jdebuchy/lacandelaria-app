import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { loadActiveLogisticsDepot } from "@/lib/logistics-depots";
import { createAdminClient } from "@/lib/supabase/admin";

const createTripSchema = z.object({
  depotId: z.string().uuid("Selecciona un depósito de salida."),
  scheduledDate: z.string().min(1, "Selecciona una fecha."),
  driverUserId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  orderIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un pedido.")
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "No se pudo crear el viaje." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const depot = await loadActiveLogisticsDepot(supabase, parsed.data.depotId).catch(() => null);
  const uniqueOrderIds = Array.from(new Set(parsed.data.orderIds));

  if (!depot) {
    return NextResponse.json(
      { success: false, message: "Selecciona un depósito de salida activo." },
      { status: 400 }
    );
  }

  const [{ data: orders, error: ordersError }, { data: activeAssignments, error: assignmentsError }] =
    await Promise.all([
      supabase.from("orders").select("id, status").in("id", uniqueOrderIds),
      supabase
        .from("delivery_trip_orders")
        .select("order_id")
        .in("order_id", uniqueOrderIds)
        .is("released_at", null)
    ]);

  if (ordersError) {
    console.error("trip orders fetch failed", ordersError);
    return NextResponse.json(
      { success: false, message: "No se pudieron validar los pedidos seleccionados." },
      { status: 500 }
    );
  }

  if (assignmentsError) {
    console.error("trip assignments fetch failed", assignmentsError);
    return NextResponse.json(
      { success: false, message: "No se pudo validar la asignacion actual de pedidos." },
      { status: 500 }
    );
  }

  if ((orders ?? []).length !== uniqueOrderIds.length) {
    return NextResponse.json(
      { success: false, message: "Uno o mas pedidos ya no existen." },
      { status: 404 }
    );
  }

  const invalidOrders = (orders ?? []).filter(
    (order) => order.status !== "confirmed" && order.status !== "assigned"
  );

  if (invalidOrders.length) {
    return NextResponse.json(
      {
        success: false,
        message: "Solo se pueden consolidar pedidos confirmados o pendientes de reprogramacion."
      },
      { status: 400 }
    );
  }

  if ((activeAssignments ?? []).length) {
    return NextResponse.json(
      { success: false, message: "Hay pedidos seleccionados que ya pertenecen a otro viaje activo." },
      { status: 409 }
    );
  }

  const { data: newTrip, error: tripInsertError } = await supabase
    .from("delivery_trips")
    .insert({
      depot_id: depot.id,
      scheduled_date: parsed.data.scheduledDate,
      driver_user_id: parsed.data.driverUserId || null,
      status: "assigned",
      notes: parsed.data.notes?.trim() || null,
      created_by_user_id: authResult.auth.profile.id
    })
    .select("id")
    .single();

  if (tripInsertError || !newTrip) {
    console.error("delivery trip insert failed", tripInsertError);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el viaje." },
      { status: 500 }
    );
  }

  const tripRows = uniqueOrderIds.map((orderId, index) => ({
    delivery_trip_id: newTrip.id,
    order_id: orderId,
    sequence_number: index + 1
  }));

  const { error: tripOrdersInsertError } = await supabase.from("delivery_trip_orders").insert(tripRows);

  if (tripOrdersInsertError) {
    console.error("delivery trip orders insert failed", tripOrdersInsertError);
    await supabase.from("delivery_trips").delete().eq("id", newTrip.id);
    return NextResponse.json(
      { success: false, message: "No se pudieron asignar los pedidos al viaje." },
      { status: 500 }
    );
  }

  const { error: ordersUpdateError } = await supabase
    .from("orders")
    .update({ status: "assigned" })
    .in("id", uniqueOrderIds);

  if (ordersUpdateError) {
    console.error("orders assignment update failed", ordersUpdateError);
    return NextResponse.json(
      { success: false, message: "El viaje se creo pero no se actualizaron los pedidos." },
      { status: 500 }
    );
  }

  const { data: existingDeliveries, error: deliveriesFetchError } = await supabase
    .from("deliveries")
    .select("id, order_id")
    .in("order_id", uniqueOrderIds);

  if (deliveriesFetchError) {
    console.error("deliveries fetch failed", deliveriesFetchError);
    return NextResponse.json(
      { success: false, message: "El viaje se creo pero no se pudo preparar el reparto." },
      { status: 500 }
    );
  }

  const deliveryByOrderId = new Map((existingDeliveries ?? []).map((delivery) => [delivery.order_id, delivery.id]));

  for (const [index, orderId] of uniqueOrderIds.entries()) {
    const deliveryPayload = {
      assigned_date: parsed.data.scheduledDate,
      driver_user_id: parsed.data.driverUserId || null,
      delivery_status: "pending",
      delivered_at: null,
      failure_reason: null,
      proof_note: null,
      sequence_number: index + 1
    };

    const deliveryId = deliveryByOrderId.get(orderId);

    if (deliveryId) {
      const { error } = await supabase.from("deliveries").update(deliveryPayload).eq("id", deliveryId);

      if (error) {
        console.error("delivery assignment update failed", error);
        return NextResponse.json(
          { success: false, message: "El viaje se creo pero no se pudo preparar una entrega." },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase.from("deliveries").insert({
        order_id: orderId,
        ...deliveryPayload
      });

      if (error) {
        console.error("delivery assignment insert failed", error);
        return NextResponse.json(
          { success: false, message: "El viaje se creo pero no se pudo crear una entrega." },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    tripId: newTrip.id,
    message: "Viaje creado correctamente."
  });
}
