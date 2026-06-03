import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { BUSINESS_RULES } from "@/lib/constants";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const createManualOrderSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  fullName: z.string().min(3, "Ingresa el nombre completo."),
  phone: z.string().min(8, "Ingresa un WhatsApp valido."),
  address: z.string().min(5, "Ingresa una direccion."),
  neighborhood: z.string().min(2, "Ingresa un barrio."),
  zone: z.string().min(2, "Ingresa una zona."),
  deliveryNotes: z.string().max(500).optional().or(z.literal("")),
  quantityBoxes: z.coerce.number().int().min(1).max(50),
  paymentMethodExpected: z.enum(["cash", "transfer"]),
  deliveryDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createManualOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone);

  if (normalizedPhone.length < 11 || normalizedPhone.length > 14) {
    return NextResponse.json(
      { success: false, message: "Ingresa un telefono valido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let customerId = parsed.data.customerId || null;

  if (!customerId) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    customerId = existingCustomer?.id ?? null;
  }

  if (customerId) {
    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        full_name: parsed.data.fullName,
        phone: normalizedPhone,
        address: parsed.data.address,
        neighborhood: parsed.data.neighborhood,
        zone: parsed.data.zone,
        delivery_notes: parsed.data.deliveryNotes || null
      })
      .eq("id", customerId);

    if (customerUpdateError) {
      console.error("customer update failed", customerUpdateError);
      return NextResponse.json(
        { success: false, message: "No se pudo actualizar el cliente." },
        { status: 500 }
      );
    }
  } else {
    const { data: newCustomer, error: customerInsertError } = await supabase
      .from("customers")
      .insert({
        full_name: parsed.data.fullName,
        phone: normalizedPhone,
        address: parsed.data.address,
        neighborhood: parsed.data.neighborhood,
        zone: parsed.data.zone,
        delivery_notes: parsed.data.deliveryNotes || null,
        source: "repeat"
      })
      .select("id")
      .single();

    if (customerInsertError || !newCustomer) {
      console.error("customer insert failed", customerInsertError);
      return NextResponse.json(
        { success: false, message: "No se pudo crear el cliente." },
        { status: 500 }
      );
    }

    customerId = newCustomer.id;
  }

  const unitPrice =
    parsed.data.paymentMethodExpected === "cash"
      ? BUSINESS_RULES.cashPrice
      : BUSINESS_RULES.transferPrice;

  const { error: orderInsertError } = await supabase.from("orders").insert({
    customer_id: customerId,
    seller_user_id: authResult.auth.profile.id,
    sales_channel: "internal",
    quantity_boxes: parsed.data.quantityBoxes,
    unit_price: unitPrice,
    payment_method_expected: parsed.data.paymentMethodExpected,
    status: "confirmed",
    payment_status: "pending",
    delivery_date: parsed.data.deliveryDate || null,
    zone: parsed.data.zone,
    notes: parsed.data.notes || null
  });

  if (orderInsertError) {
    console.error("manual order insert failed", orderInsertError);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el pedido." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Pedido manual creado correctamente."
  });
}
