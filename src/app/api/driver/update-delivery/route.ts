import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const updateDeliverySchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "in_route", "delivered", "failed"])
});

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = updateDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Actualizacion invalida." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
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

  const nextOrderStatus =
    parsed.data.status === "delivered"
      ? "delivered"
      : parsed.data.status === "in_route"
        ? "in_route"
        : "assigned";

  const deliveryPayload = {
    assigned_date: currentDate(),
    delivered_at: parsed.data.status === "delivered" ? new Date().toISOString() : null,
    delivery_status: parsed.data.status
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

  const message =
    parsed.data.status === "delivered"
      ? "Pedido marcado como entregado."
      : parsed.data.status === "failed"
        ? "Pedido marcado como no entregado."
        : parsed.data.status === "in_route"
          ? "Pedido marcado en reparto."
          : "Estado actualizado.";

  return NextResponse.json({ success: true, message });
}
