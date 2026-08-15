import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { recordOrderActivity } from "@/lib/order-activities";
import { normalizeDeliveryWindow } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";

const deliveryWindowSchema = z.object({
  deliveryWindowEnd: z.string().optional().or(z.literal("")),
  deliveryWindowStart: z.string().optional().or(z.literal(""))
});

const CLOSED_ORDER_STATUSES = ["in_route", "delivered", "cancelled"];

type Params = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function PATCH(request: Request, context: Params) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const parsed = deliveryWindowSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "No se pudo validar la franja de entrega." },
      { status: 400 }
    );
  }

  const normalized = normalizeDeliveryWindow(
    parsed.data.deliveryWindowStart,
    parsed.data.deliveryWindowEnd
  );

  if (!normalized.ok) {
    return NextResponse.json({ success: false, message: normalized.message }, { status: 400 });
  }

  const { orderId } = await context.params;
  const supabase = createAdminClient();

  const { data: order, error: orderFetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (orderFetchError || !order) {
    return NextResponse.json(
      { success: false, message: "No se encontro el pedido." },
      { status: 404 }
    );
  }

  // Un pedido asignado a un viaje todavia admite ajustar la franja: es
  // justamente lo que realimenta al optimizador de recorrido.
  if (CLOSED_ORDER_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { success: false, message: "Ese pedido ya no admite cambios de franja." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      delivery_window_end: normalized.end,
      delivery_window_start: normalized.start
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("delivery window update failed", updateError);
    return NextResponse.json(
      { success: false, message: "No se pudo guardar la franja de entrega." },
      { status: 500 }
    );
  }

  await recordOrderActivity(supabase, {
    actorUserId: authResult.auth.profile.id,
    metadata: {
      deliveryWindowEnd: normalized.end,
      deliveryWindowStart: normalized.start
    },
    orderId,
    summary: normalized.start
      ? `Franja de entrega actualizada: ${normalized.start} a ${normalized.end}.`
      : "Franja de entrega borrada.",
    type: "order_updated"
  });

  return NextResponse.json({
    success: true,
    message: normalized.start ? "Franja de entrega guardada." : "Franja de entrega borrada."
  });
}
