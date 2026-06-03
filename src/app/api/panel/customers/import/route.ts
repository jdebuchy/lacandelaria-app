import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { deriveDeliveryArea, splitFullName } from "@/lib/address";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

const SOURCE_MAP: Record<string, string> = {
  instagram: "instagram",
  referido: "referred",
  referred: "referred",
  recurrente: "repeat",
  repeat: "repeat",
  revendedora: "reseller",
  reseller: "reseller"
};

const ADDRESS_KIND_MAP: Record<string, "standard" | "gated"> = {
  estandar: "standard",
  estándar: "standard",
  standard: "standard",
  casa: "standard",
  depto: "standard",
  departamento: "standard",
  gated: "gated",
  privado: "gated",
  barrio_cerrado: "gated",
  "barrio cerrado": "gated",
  country: "gated"
};

const customerRowSchema = z.object({
  nombre: z.string().optional().or(z.literal("")),
  apellido: z.string().optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  instagram: z.string().max(100).optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  direccion_2: z.string().optional().or(z.literal("")),
  piso_depto: z.string().optional().or(z.literal("")),
  barrio_cerrado: z.string().optional().or(z.literal("")),
  nombre_barrio: z.string().optional().or(z.literal("")),
  localidad: z.string().optional().or(z.literal("")),
  provincia: z.string().optional().or(z.literal("")),
  codigo_postal: z.string().optional().or(z.literal("")),
  barrio: z.string().optional().or(z.literal("")),
  zona: z.string().optional().or(z.literal("")),
  tipo_direccion: z.string().optional().or(z.literal("")),
  notas_entrega: z.string().optional().or(z.literal("")),
  origen: z.string().optional().or(z.literal(""))
});

const importSchema = z.object({
  rows: z.array(customerRowSchema).min(1).max(1000)
});

function isTruthyFlag(value?: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return ["x", "si", "sí", "true", "1"].includes(normalized);
}

type NormalizedImportRow = {
  first_name: string;
  last_name: string | null;
  phone: string | null;
  instagram: string | null;
  address_kind: "standard" | "gated";
  address_line_1: string | null;
  address_line_2: string | null;
  gated_community_name: string | null;
  locality: string | null;
  administrative_area_level_1: string | null;
  postal_code: string | null;
  google_place_id: null;
  google_place_label: null;
  address_source: "manual";
  delivery_area: string;
  delivery_notes: string | null;
  source: string;
  display_name: string;
};

type InvalidImportRow = {
  error: string;
};

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Datos inválidos." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const preparedRows = parsed.data.rows.map<NormalizedImportRow | InvalidImportRow>((row, index) => {
    const firstNameRaw = row.nombre?.trim() ?? "";
    const lastNameRaw = row.apellido?.trim() ?? "";
    const combinedName = [firstNameRaw, lastNameRaw].filter(Boolean).join(" ").trim();

    if (!combinedName) {
      return { error: `La fila ${index + 2} no tiene nombre ni apellido.` } as const;
    }

    const phoneInput = row.telefono?.trim() ?? "";
    const phone = phoneInput ? normalizeArgentinaPhoneInput(phoneInput) : null;
    const instagram = row.instagram?.trim().replace(/^@+/, "") || null;
    const sourceRaw = (row.origen ?? "").toLowerCase().trim();
    const source = SOURCE_MAP[sourceRaw] ?? "repeat";
    const { firstName, lastName } = lastNameRaw
      ? { firstName: firstNameRaw || splitFullName(combinedName).firstName, lastName: lastNameRaw }
      : splitFullName(combinedName);
    const addressKindRaw = (row.tipo_direccion ?? "").toLowerCase().trim();
    const gatedFlag = isTruthyFlag(row.barrio);
    const gatedCommunityName = row.nombre_barrio?.trim() || row.barrio_cerrado?.trim() || "";
    const addressKind = gatedCommunityName
      || gatedFlag
      ? "gated"
      : ADDRESS_KIND_MAP[addressKindRaw] ?? "standard";
    const addressLine2 = row.direccion_2?.trim() || row.piso_depto?.trim() || null;
    const locality = row.localidad?.trim() || (gatedFlag ? "" : row.barrio?.trim()) || null;
    const administrativeAreaLevel1 = row.provincia?.trim() || null;
    const deliveryArea = row.zona?.trim()
      || deriveDeliveryArea({
        addressKind,
        addressLine1: row.direccion?.trim() || "",
        addressLine2: addressLine2 ?? "",
        gatedCommunityName,
        locality: locality ?? "",
        administrativeAreaLevel1: administrativeAreaLevel1 ?? "",
        postalCode: row.codigo_postal?.trim() || "",
        googlePlaceId: "",
        googlePlaceLabel: "",
        addressSource: "manual"
      });

    return {
      first_name: firstName,
      last_name: lastName || null,
      phone,
      instagram,
      address_kind: addressKind,
      address_line_1: row.direccion?.trim() || null,
      address_line_2: addressLine2,
      gated_community_name: gatedCommunityName || null,
      locality,
      administrative_area_level_1: administrativeAreaLevel1,
      postal_code: row.codigo_postal?.trim() || null,
      google_place_id: null,
      google_place_label: null,
      address_source: "manual",
      delivery_area: deliveryArea,
      delivery_notes: row.notas_entrega?.trim() || null,
      source,
      display_name: combinedName
    };
  });

  const invalidNameRows = preparedRows.filter((row) => "error" in row);
  if (invalidNameRows.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: invalidNameRows.map((row) => row.error).join(" ")
      },
      { status: 400 }
    );
  }

  const normalized = preparedRows.filter((row): row is NormalizedImportRow => !("error" in row));

  const invalidRows = normalized.filter(
    (r) => r.phone !== null && (r.phone.length < 11 || r.phone.length > 14)
  );
  if (invalidRows.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `${invalidRows.length} fila(s) tienen teléfonos inválidos: ${invalidRows.map((r) => r.display_name).join(", ")}`
      },
      { status: 400 }
    );
  }

  const phones = normalized
    .map((r) => r.phone)
    .filter((phone): phone is string => Boolean(phone));
  const { data: existing, error: existingError } = phones.length > 0
    ? await supabase
      .from("customers")
      .select("phone")
      .in("phone", phones)
    : { data: [], error: null };

  if (existingError) {
    console.error("customer import existing lookup failed", existingError);
    return NextResponse.json(
      { success: false, message: "Error al validar clientes existentes." },
      { status: 500 }
    );
  }

  const existingPhones = new Set((existing ?? []).map((c) => c.phone));
  const toInsert = normalized
    .filter((r) => !r.phone || !existingPhones.has(r.phone))
    .map(({ display_name, ...row }) => row);
  const skipped = normalized.length - toInsert.length;

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: true,
      inserted: 0,
      skipped,
      message: `Todos los clientes ya existían (${skipped} omitido${skipped !== 1 ? "s" : ""}).`
    });
  }

  const { error } = await supabase.from("customers").insert(toInsert);

  if (error) {
    console.error("csv import failed", error);
    return NextResponse.json(
      { success: false, message: "Error al importar los clientes." },
      { status: 500 }
    );
  }

  const parts = [`${toInsert.length} cliente${toInsert.length !== 1 ? "s" : ""} importado${toInsert.length !== 1 ? "s" : ""}.`];
  if (skipped > 0) parts.push(`${skipped} omitido${skipped !== 1 ? "s" : ""} por teléfono duplicado.`);

  return NextResponse.json({
    success: true,
    inserted: toInsert.length,
    skipped,
    message: parts.join(" ")
  });
}
