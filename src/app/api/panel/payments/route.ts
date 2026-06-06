import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { COLLECTION_ALLOWED_ROLES } from "@/lib/auth-shared";
import { recordReceivedPayment, voidReceivedPayment } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

const createPaymentSchema = z.object({
  amount: z.coerce.number().positive("Ingresa un monto mayor a cero."),
  method: z.enum(["cash", "transfer"]),
  orderId: z.string().uuid(),
  reference: z.string().max(240).optional().or(z.literal(""))
});

const voidPaymentSchema = z.object({
  action: z.literal("void"),
  paymentId: z.string().uuid(),
  reason: z.string().max(240).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(COLLECTION_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el pago."
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", parsed.data.orderId)
    .limit(1)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { success: false, message: "No se encontro el pedido." },
      { status: 404 }
    );
  }

  try {
    const summary = await recordReceivedPayment({
      amount: parsed.data.amount,
      method: parsed.data.method,
      orderId: parsed.data.orderId,
      receivedByUserId: authResult.auth.profile.id,
      reference: parsed.data.reference,
      supabase
    });

    return NextResponse.json({
      success: true,
      message: "Pago registrado correctamente.",
      summary
    });
  } catch (error) {
    console.error("payment registration failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo registrar el pago." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireApiRole(COLLECTION_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = voidPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar la anulacion."
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    const summary = await voidReceivedPayment({
      paymentId: parsed.data.paymentId,
      reason: parsed.data.reason,
      supabase,
      voidedByUserId: authResult.auth.profile.id
    });

    return NextResponse.json({
      success: true,
      message: "Pago anulado correctamente.",
      summary
    });
  } catch (error) {
    console.error("payment void failed", error);
    const message =
      error instanceof Error && error.message === "payment_not_voidable"
        ? "Ese pago ya no se puede anular."
        : "No se pudo anular el pago.";

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
