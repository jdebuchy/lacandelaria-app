import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { structuredAddressSchema, toStructuredAddressColumns } from "@/lib/address";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { normalizeArgentinaPhoneInput, normalizeInstagramUsername } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const createCustomerSchema = structuredAddressSchema.extend({
  firstName: z.string().optional().or(z.literal("")),
  lastName: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  instagram: z.string().max(100).optional().or(z.literal("")),
  deliveryNotes: z.string().max(500).optional().or(z.literal("")),
  source: z.enum(["instagram", "referred", "repeat", "reseller"])
}).superRefine((data, ctx) => {
  if (!data.firstName?.trim() && !data.lastName?.trim() && !data.instagram?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa nombre, apellido o Instagram.",
      path: ["firstName"]
    });
  }
});

function isDuplicateInstagramError(error?: { code?: string | null; message?: string | null } | null) {
  return error?.code === "23505" && (error.message?.includes("customers_instagram_normalized_unique_idx") ?? false);
}

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

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone ?? "");

  if (normalizedPhone && (normalizedPhone.length < 11 || normalizedPhone.length > 14)) {
    return NextResponse.json(
      { success: false, message: "Ingresa un teléfono válido." },
      { status: 400 }
    );
  }

  const firstName = parsed.data.firstName?.trim() || null;
  const lastName = parsed.data.lastName?.trim() || null;
  const instagram = normalizeInstagramUsername(parsed.data.instagram) || null;
  const addressColumns = toStructuredAddressColumns(parsed.data);

  const supabase = createAdminClient();
  if (instagram) {
    const { data: existingCustomer, error: existingCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("instagram", instagram)
      .limit(1)
      .maybeSingle();

    if (existingCustomerError) {
      console.error("customer instagram lookup failed", existingCustomerError);
      return NextResponse.json(
        { success: false, message: "No se pudo validar el Instagram del cliente." },
        { status: 500 }
      );
    }

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Ya existe un cliente con ese Instagram." },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from("customers").insert({
    first_name: firstName,
    last_name: lastName,
    phone: normalizedPhone || null,
    instagram,
    ...addressColumns,
    delivery_notes: parsed.data.deliveryNotes?.trim() || null,
    source: parsed.data.source
  });

  if (error) {
    if (isDuplicateInstagramError(error)) {
      return NextResponse.json(
        { success: false, message: "Ya existe un cliente con ese Instagram." },
        { status: 409 }
      );
    }

    console.error("customer create failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el cliente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Cliente creado correctamente." });
}
