import { NextResponse } from "next/server";
import { z } from "zod";
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

const customerRowSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().min(1),
  telefono_alternativo: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  barrio: z.string().optional().or(z.literal("")),
  zona: z.string().optional().or(z.literal("")),
  notas_entrega: z.string().optional().or(z.literal("")),
  origen: z.string().optional().or(z.literal(""))
});

const importSchema = z.object({
  rows: z.array(customerRowSchema).min(1).max(1000)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Datos inválidos." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const normalized = parsed.data.rows.map((row) => {
    const phone = normalizeArgentinaPhoneInput(row.telefono.trim());
    const alternatePhone = row.telefono_alternativo
      ? normalizeArgentinaPhoneInput(row.telefono_alternativo.trim())
      : null;
    const sourceRaw = (row.origen ?? "").toLowerCase().trim();
    const source = SOURCE_MAP[sourceRaw] ?? "repeat";

    return {
      full_name: row.nombre.trim(),
      phone,
      alternate_phone: alternatePhone || null,
      address: row.direccion?.trim() || null,
      neighborhood: row.barrio?.trim() || null,
      zone: row.zona?.trim() || null,
      delivery_notes: row.notas_entrega?.trim() || null,
      source
    };
  });

  const invalidRows = normalized.filter(
    (r) => r.phone.length < 11 || r.phone.length > 14
  );
  if (invalidRows.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `${invalidRows.length} fila(s) tienen teléfonos inválidos: ${invalidRows.map((r) => r.full_name).join(", ")}`
      },
      { status: 400 }
    );
  }

  const phones = normalized.map((r) => r.phone);
  const { data: existing } = await supabase
    .from("customers")
    .select("phone")
    .in("phone", phones);

  const existingPhones = new Set((existing ?? []).map((c) => c.phone));
  const toInsert = normalized.filter((r) => !existingPhones.has(r.phone));
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
