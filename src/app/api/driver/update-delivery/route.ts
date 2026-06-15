import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { releaseTripOrder, syncTripCompletion } from "@/lib/delivery-trip-ops";
import { getDeliveryFailureReasonLabel, getDeliveryStatusLabel } from "@/lib/delivery-trips";
import { recordOrderActivity } from "@/lib/order-activities";
import { recordReceivedPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

const failureReasonSchema = z.enum([
  "customer_absent",
  "incorrect_address",
  "rejected",
  "closed",
  "other"
]);

const updateDeliverySchema = z.object({
  failureReason: failureReasonSchema.optional(),
  note: z.string().max(500).optional().or(z.literal("")),
  orderId: z.string().uuid(),
  payment: z
    .object({
      amount: z.coerce.number().positive("Ingresa un monto mayor a cero."),
      method: z.literal("cash"),
      reference: z.string().max(240).optional().or(z.literal(""))
    })
    .optional(),
  status: z.enum(["pending", "in_route", "delivered", "failed"])
});

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const authResult = await requireApiRole(DRIVER_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = updateDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Actualizacion invalida." },
      { status: 400 }
    );
  }

  if (parsed.data.payment && parsed.data.status !== "delivered") {
    return NextResponse.json(
      { success: false, message: "El pago solo se puede registrar al marcar entregado." },
      { status: 400 }
    );
  }

  if (parsed.data.status === "failed" && !parsed.data.failureReason) {
    return NextResponse.json(
      { success: false, message: "Selecciona un motivo para registrar el no entregado." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, payment_method_expected")
    .eq("id", parsed.data.orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { success: false, message: "No se encontro el pedido." },
      { status: 404 }
    );
  }

  const { data: existingDelivery } = await supabase
    .from("deliveries")
    .select("id, sequence_number")
    .eq("order_id", parsed.data.orderId)
    .limit(1)
    .maybeSingle();

  const { data: activeTripOrder } = await supabase
    .from("delivery_trip_orders")
    .select("id, delivery_trip_id")
    .eq("order_id", parsed.data.orderId)
    .is("released_at", null)
    .limit(1)
    .maybeSingle();

  if (authResult.auth.profile.role === "driver" && activeTripOrder?.delivery_trip_id) {
    const { data: trip } = await supabase
      .from("delivery_trips")
      .select("driver_user_id")
      .eq("id", activeTripOrder.delivery_trip_id)
      .limit(1)
      .maybeSingle();

    if (trip?.driver_user_id && trip.driver_user_id !== authResult.auth.profile.id) {
      return NextResponse.json(
        { success: false, message: "Ese pedido pertenece al viaje de otro repartidor." },
        { status: 403 }
      );
    }
  }

  if (parsed.data.payment && !activeTripOrder?.delivery_trip_id) {
    return NextResponse.json(
      { success: false, message: "El cobro debe estar asociado a un viaje activo." },
      { status: 403 }
    );
  }

  if (
    parsed.data.payment &&
    order.payment_method_expected !== "cash" &&
    order.payment_method_expected !== "unknown"
  ) {
    return NextResponse.json(
      { success: false, message: "El repartidor solo puede registrar cobros en efectivo." },
      { status: 400 }
    );
  }

  const nextOrderStatus =
    parsed.data.status === "delivered"
      ? "delivered"
      : parsed.data.status === "in_route"
        ? "in_route"
        : parsed.data.status === "failed"
          ? "confirmed"
          : activeTripOrder
            ? "assigned"
            : "confirmed";

  const deliveryPayload = {
    assigned_date: currentDate(),
    delivered_at: parsed.data.status === "delivered" ? new Date().toISOString() : null,
    failure_reason: parsed.data.status === "failed" ? parsed.data.failureReason ?? null : null,
    delivery_status: parsed.data.status,
    driver_user_id: authResult.auth.profile.id,
    proof_note: parsed.data.note?.trim() || null
  };

  if (existingDelivery?.id) {
    const { error: updateDeliveryError } = await supabase
      .from("deliveries")
      .update(deliveryPayload)
      .eq("id", existingDelivery.id);

    if (updateDeliveryError) {
      console.error("delivery update failed", updateDeliveryError);
      return NextResponse.json(
        { success: false, message: "No se pudo actualizar la entrega." },
        { status: 500 }
      );
    }
  } else {
    const { error: insertDeliveryError } = await supabase.from("deliveries").insert({
      order_id: parsed.data.orderId,
      sequence_number: null,
      ...deliveryPayload
    });

    if (insertDeliveryError) {
      console.error("delivery insert failed", insertDeliveryError);
      return NextResponse.json(
        { success: false, message: "No se pudo crear la entrega." },
        { status: 500 }
      );
    }
  }

  const { error: updateOrderError } = await supabase
    .from("orders")
    .update({
      status: nextOrderStatus
    })
    .eq("id", parsed.data.orderId);

  if (updateOrderError) {
    console.error("order status update failed", updateOrderError);
    return NextResponse.json(
      { success: false, message: "La entrega se actualizo pero no el estado del pedido." },
      { status: 500 }
    );
  }

  if (activeTripOrder?.id) {
    const { error: tripOrderUpdateError } = await supabase
      .from("delivery_trip_orders")
      .update({
        resolved_at:
          parsed.data.status === "delivered" || parsed.data.status === "failed"
            ? new Date().toISOString()
            : null,
        stop_failure_reason: parsed.data.status === "failed" ? parsed.data.failureReason ?? null : null,
        stop_note: parsed.data.note?.trim() || null,
        stop_status: parsed.data.status
      })
      .eq("id", activeTripOrder.id);

    if (tripOrderUpdateError) {
      console.error("trip order state update failed", tripOrderUpdateError);
      return NextResponse.json(
        { success: false, message: "La entrega se actualizo pero no el historial del viaje." },
        { status: 500 }
      );
    }
  }

  await recordOrderActivity(supabase, {
    actorUserId: authResult.auth.profile.id,
    metadata: {
      deliveryTripId: activeTripOrder?.delivery_trip_id ?? null,
      failureReason: parsed.data.status === "failed" ? parsed.data.failureReason ?? null : null,
      note: parsed.data.note?.trim() || null,
      status: parsed.data.status
    },
    orderId: parsed.data.orderId,
    summary:
      parsed.data.status === "failed"
        ? `Entrega marcada como no entregada: ${getDeliveryFailureReasonLabel(parsed.data.failureReason)}.`
        : `Entrega marcada como ${getDeliveryStatusLabel(parsed.data.status).toLowerCase()}.`,
    type: "order_delivery_updated"
  });

  if (parsed.data.status === "failed" && activeTripOrder?.delivery_trip_id) {
    try {
      const tripId = await releaseTripOrder(supabase, parsed.data.orderId);

      if (tripId) {
        await recordOrderActivity(supabase, {
          actorUserId: authResult.auth.profile.id,
          metadata: {
            deliveryTripId: tripId,
            failureReason: parsed.data.failureReason ?? null
          },
          orderId: parsed.data.orderId,
          summary: "Pedido liberado del viaje para reprogramación.",
          type: "order_released_from_trip"
        });
        await syncTripCompletion(supabase, tripId);
      }
    } catch (error) {
      console.error("trip release failed", error);
      return NextResponse.json(
        { success: false, message: "La entrega fallo pero no se pudo devolver el pedido a logística." },
        { status: 500 }
      );
    }
  }

  if (parsed.data.status === "delivered" && activeTripOrder?.delivery_trip_id) {
    try {
      await syncTripCompletion(supabase, activeTripOrder.delivery_trip_id);
    } catch (error) {
      console.error("trip completion sync failed", error);
      return NextResponse.json(
        { success: false, message: "Se actualizo el pedido pero no el estado del viaje." },
        { status: 500 }
      );
    }
  }

  if (parsed.data.payment) {
    try {
      await recordReceivedPayment({
        amount: parsed.data.payment.amount,
        method: parsed.data.payment.method,
        orderId: parsed.data.orderId,
        receivedByUserId: authResult.auth.profile.id,
        reference: parsed.data.payment.reference,
        supabase
      });
    } catch (error) {
      console.error("driver payment registration failed", error);
      return NextResponse.json(
        { success: false, message: "La entrega se actualizo pero no se pudo registrar el cobro." },
        { status: 500 }
      );
    }
  }

  const message =
    parsed.data.status === "delivered"
      ? parsed.data.payment
        ? "Pedido entregado y cobro registrado."
        : "Pedido marcado como entregado."
      : parsed.data.status === "failed"
        ? "Pedido marcado como no entregado y devuelto a logística."
        : parsed.data.status === "in_route"
          ? "Pedido marcado en reparto."
          : "Estado actualizado.";

  return NextResponse.json({ success: true, message });
}
