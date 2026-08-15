import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { RECEIVED_PAYMENT_STATUS, voidReceivedPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

const voidPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().max(240).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(DRIVER_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const parsed = voidPaymentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Correccion invalida." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const profile = authResult.auth.profile;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, received_by_user_id, status")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();

  if (paymentError || !payment) {
    return NextResponse.json(
      { success: false, message: "No se encontro el cobro." },
      { status: 404 }
    );
  }

  if (payment.status !== RECEIVED_PAYMENT_STATUS) {
    return NextResponse.json(
      { success: false, message: "Ese cobro ya estaba anulado." },
      { status: 409 }
    );
  }

  // El repartidor solo corrige lo que cargo el mismo. El admin puede corregir cualquiera.
  if (profile.role !== "admin" && payment.received_by_user_id !== profile.id) {
    return NextResponse.json(
      { success: false, message: "Ese cobro lo registro otra persona. Avisá a la oficina." },
      { status: 403 }
    );
  }

  const { data: activeTripOrder } = await supabase
    .from("delivery_trip_orders")
    .select("id, delivery_trip_id")
    .eq("order_id", payment.order_id)
    .is("released_at", null)
    .limit(1)
    .maybeSingle();

  if (!activeTripOrder?.delivery_trip_id) {
    return NextResponse.json(
      { success: false, message: "El pedido ya no está en un viaje activo. Avisá a la oficina." },
      { status: 403 }
    );
  }

  if (profile.role === "driver") {
    const { data: trip } = await supabase
      .from("delivery_trips")
      .select("driver_user_id")
      .eq("id", activeTripOrder.delivery_trip_id)
      .limit(1)
      .maybeSingle();

    if (trip?.driver_user_id && trip.driver_user_id !== profile.id) {
      return NextResponse.json(
        { success: false, message: "Ese pedido pertenece al viaje de otro repartidor." },
        { status: 403 }
      );
    }
  }

  try {
    await voidReceivedPayment({
      paymentId: parsed.data.paymentId,
      reason: parsed.data.reason?.trim() || "Corregido desde reparto",
      supabase,
      voidedByUserId: profile.id
    });
  } catch (error) {
    console.error("driver payment void failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo anular el cobro." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Cobro anulado." });
}
