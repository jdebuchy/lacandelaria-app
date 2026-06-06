import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const manualMessageSchema = z.object({
  body: z.string().min(1, "Escribí un mensaje.").max(2000, "El mensaje es demasiado largo."),
  customerId: z.string().uuid("Seleccioná un cliente."),
  messageType: z.enum([
    "satisfaction_check",
    "reactivation_offer",
    "transactional_reply",
    "order_confirmation",
    "human_handoff",
    "opt_out_confirmation"
  ]),
  orderId: z.string().uuid().optional().or(z.literal("")),
  scheduledFor: z.string().optional().or(z.literal(""))
});

function isMissingWhatsappTable(error?: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || Boolean(error.message?.includes("schema cache"));
}

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const parsed = manualMessageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "No se pudo validar el mensaje." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, phone, whatsapp_phone, whatsapp_opt_in, whatsapp_opt_out_at")
    .eq("id", parsed.data.customerId)
    .maybeSingle();

  if (isMissingWhatsappTable(customerError)) {
    const fallback = await supabase
      .from("customers")
      .select("id, phone")
      .eq("id", parsed.data.customerId)
      .maybeSingle();
    customer = fallback.data ? { ...fallback.data, whatsapp_phone: null, whatsapp_opt_in: true, whatsapp_opt_out_at: null } : null;
    customerError = fallback.error;
  }

  if (customerError || !customer) {
    return NextResponse.json(
      { success: false, message: "No se encontró el cliente." },
      { status: 404 }
    );
  }

  if (customer.whatsapp_opt_in === false || customer.whatsapp_opt_out_at) {
    return NextResponse.json(
      { success: false, message: "El cliente pidió baja o no tiene WhatsApp habilitado." },
      { status: 409 }
    );
  }

  const phone = normalizeArgentinaPhoneInput(customer.whatsapp_phone || customer.phone || "");

  if (phone.length < 11 || phone.length > 14) {
    return NextResponse.json(
      { success: false, message: "El cliente no tiene un teléfono válido para WhatsApp." },
      { status: 400 }
    );
  }

  const scheduledFor = parsed.data.scheduledFor
    ? new Date(parsed.data.scheduledFor).toISOString()
    : new Date().toISOString();

  const { error: insertError } = await supabase.from("whatsapp_message_queue").insert({
    body: parsed.data.body.trim(),
    customer_id: parsed.data.customerId,
    message_type: parsed.data.messageType,
    order_id: parsed.data.orderId || null,
    phone,
    scheduled_for: scheduledFor,
    status: "pending"
  });

  if (insertError) {
    if (isMissingWhatsappTable(insertError)) {
      return NextResponse.json(
        { success: false, message: "Falta aplicar la migración supabase/whatsapp_crm.sql." },
        { status: 409 }
      );
    }

    if (insertError.code === "23505") {
      return NextResponse.json(
        { success: false, message: "Ya existe un mensaje de ese tipo para ese pedido." },
        { status: 409 }
      );
    }

    console.error("manual whatsapp message insert failed", insertError);
    return NextResponse.json(
      { success: false, message: "No se pudo programar el mensaje." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Mensaje programado en la cola de WhatsApp."
  });
}
