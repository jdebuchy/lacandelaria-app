import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { normalizeStructuredAddress, structuredAddressSchema } from "@/lib/address";
import { createAdminClient } from "@/lib/supabase/admin";

const createDepotSchema = z.object({
  address: structuredAddressSchema,
  label: z.string().trim().min(1, "Completa el nombre del depósito.")
}).superRefine((data, ctx) => {
  if (!data.address.addressLine1?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completa la dirección.",
      path: ["address", "addressLine1"]
    });
  }

  if (!data.address.locality?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completa la localidad.",
      path: ["address", "locality"]
    });
  }

  if (!data.address.administrativeAreaLevel1?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completa la provincia o CABA.",
      path: ["address", "administrativeAreaLevel1"]
    });
  }
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(["admin"]);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createDepotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "No se pudo crear el depósito." },
      { status: 400 }
    );
  }

  const address = normalizeStructuredAddress(parsed.data.address);
  const supabase = createAdminClient();
  const { error } = await supabase.from("logistics_depots").insert({
    active: true,
    address_line_1: address.addressLine1,
    administrative_area_level_1: address.administrativeAreaLevel1,
    code: `custom_${crypto.randomUUID()}`,
    google_place_id: address.googlePlaceId || null,
    label: parsed.data.label,
    locality: address.locality
  });

  if (error) {
    console.error("logistics depot insert failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el depósito." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Depósito creado correctamente."
  });
}
