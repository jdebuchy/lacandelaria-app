import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const updateCustomerSchema = z.object({
  firstName: z.string().min(1, "Ingresa el nombre."),
  lastName: z.string().min(1, "Ingresa el apellido."),
  phone: z.string().min(1, "Ingresa un WhatsApp válido."),
  address: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  zone: z.string().optional().or(z.literal("")),
  deliveryNotes: z.string().max(500).optional().or(z.literal("")),
  source: z.string().min(1)
});

type Params = Promise<{ customerId: string }>;

export async function PATCH(request: Request, context: { params: Params }) {
  const { customerId } = await context.params;
  const body = await request.json();
  const parsed = updateCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el cliente."
      },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone);

  if (normalizedPhone.length < 11 || normalizedPhone.length > 14) {
    return NextResponse.json(
      { success: false, message: "Ingresa un teléfono válido." },
      { status: 400 }
    );
  }

  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const fullName = `${firstName} ${lastName}`;

  const supabase = createAdminClient();

  // Try with separate name columns first (post-migration), fall back to full_name only
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      phone: normalizedPhone,
      address: parsed.data.address?.trim() || null,
      neighborhood: parsed.data.neighborhood?.trim() || null,
      zone: parsed.data.zone?.trim() || null,
      delivery_notes: parsed.data.deliveryNotes?.trim() || null,
      source: parsed.data.source
    })
    .eq("id", customerId);

  if (error) {
    // If first_name/last_name columns don't exist yet, retry with only full_name
    if (error.code === "42703" || error.code === "PGRST204") {
      const { error: fallbackError } = await supabase
        .from("customers")
        .update({
          full_name: fullName,
          phone: normalizedPhone,
          address: parsed.data.address?.trim() || null,
          neighborhood: parsed.data.neighborhood?.trim() || null,
          zone: parsed.data.zone?.trim() || null,
          delivery_notes: parsed.data.deliveryNotes?.trim() || null,
          source: parsed.data.source
        })
        .eq("id", customerId);

      if (fallbackError) {
        console.error("customer update fallback failed", fallbackError);
        return NextResponse.json(
          { success: false, message: "No se pudo actualizar el cliente." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Cliente actualizado correctamente." });
    }

    console.error("customer update failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo actualizar el cliente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Cliente actualizado correctamente." });
}
