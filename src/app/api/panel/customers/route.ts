import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const createCustomerSchema = z.object({
  firstName: z.string().min(1, "Ingresa el nombre."),
  lastName: z.string().min(1, "Ingresa el apellido."),
  phone: z.string().min(1, "Ingresa un WhatsApp válido."),
  address: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  zone: z.string().optional().or(z.literal("")),
  deliveryNotes: z.string().max(500).optional().or(z.literal("")),
  source: z.enum(["instagram", "referred", "repeat", "reseller"])
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." },
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

  const supabase = createAdminClient();

  const { error } = await supabase.from("customers").insert({
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`,
    phone: normalizedPhone,
    address: parsed.data.address?.trim() || null,
    neighborhood: parsed.data.neighborhood?.trim() || null,
    zone: parsed.data.zone?.trim() || null,
    delivery_notes: parsed.data.deliveryNotes?.trim() || null,
    source: parsed.data.source
  });

  if (error) {
    // Fallback: first_name/last_name columns may not exist yet (migration pending)
    if (error.code === "42703" || error.code === "PGRST204") {
      const { error: fallbackError } = await supabase.from("customers").insert({
        full_name: `${firstName} ${lastName}`,
        phone: normalizedPhone,
        address: parsed.data.address?.trim() || null,
        neighborhood: parsed.data.neighborhood?.trim() || null,
        zone: parsed.data.zone?.trim() || null,
        delivery_notes: parsed.data.deliveryNotes?.trim() || null,
        source: parsed.data.source
      });

      if (fallbackError) {
        console.error("customer create fallback failed", fallbackError);
        return NextResponse.json(
          { success: false, message: "No se pudo crear el cliente." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Cliente creado correctamente." });
    }

    console.error("customer create failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el cliente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Cliente creado correctamente." });
}
