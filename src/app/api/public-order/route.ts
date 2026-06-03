import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { composeFullName, normalizeArgentinaPhoneInput } from "@/lib/contact";

const publicOrderSchema = z.object({
  firstName: z.string().min(2, "Ingresa un nombre valido."),
  lastName: z.string().min(2, "Ingresa un apellido valido."),
  phone: z.string().min(8, "Ingresa un WhatsApp valido."),
  address: z.string().min(5, "Ingresa una direccion."),
  neighborhood: z.string().min(2, "Ingresa un barrio o zona."),
  quantityBoxes: z.coerce.number().int().min(1).max(50),
  paymentMethodExpected: z.enum(["cash", "transfer"]),
  notes: z.string().max(500).optional().or(z.literal("")),
  leadSource: z.enum(["instagram", "whatsapp", "direct_link", "reseller"]).default("direct_link"),
  website: z.string().optional().or(z.literal("")),
  startedAt: z.coerce.number().int().positive()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = publicOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  if (parsed.data.website) {
    return NextResponse.json(
      { success: false, message: "No se pudo enviar el pedido. Intenta nuevamente." },
      { status: 400 }
    );
  }

  const submittedAt = Date.now();
  const elapsedMs = submittedAt - parsed.data.startedAt;

  if (elapsedMs < 2500 || elapsedMs > 1000 * 60 * 60 * 12) {
    return NextResponse.json(
      { success: false, message: "No se pudo validar el envio del pedido." },
      { status: 400 }
    );
  }

  const fullName = composeFullName(parsed.data.firstName, parsed.data.lastName);
  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone);

  if (normalizedPhone.length < 11 || normalizedPhone.length > 14) {
    return NextResponse.json(
      { success: false, message: "Ingresa un telefono de WhatsApp valido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("public_order_requests").insert({
    full_name: fullName,
    phone: normalizedPhone,
    address: parsed.data.address,
    neighborhood: parsed.data.neighborhood,
    zone: parsed.data.neighborhood,
    quantity_boxes: parsed.data.quantityBoxes,
    payment_method_expected: parsed.data.paymentMethodExpected,
    lead_source: parsed.data.leadSource,
    notes: parsed.data.notes || null
  });

  if (error) {
    console.error("public_order_requests insert failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo enviar el pedido. Intenta nuevamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Pedido enviado. Lo vamos a confirmar por WhatsApp."
  });
}
