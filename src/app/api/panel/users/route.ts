import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const ADMIN_ONLY: readonly UserRole[] = ["admin"];

const createInternalUserSchema = z.object({
  email: z.string().email("Ingresa un email valido."),
  fullName: z.string().min(2, "Ingresa un nombre.").max(120, "Nombre demasiado largo."),
  role: z.enum(["admin", "seller", "driver", "collector"]),
  active: z.boolean().optional().default(true)
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const authResult = await requireApiRole(ADMIN_ONLY);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createInternalUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el usuario."
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const email = normalizeEmail(parsed.data.email);
  const fullName = parsed.data.fullName.trim().replace(/\s+/g, " ");

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (existingProfileError) {
    console.error("profiles lookup failed", existingProfileError);
    return NextResponse.json(
      { success: false, message: "No se pudo validar si el usuario ya existe." },
      { status: 500 }
    );
  }

  if (existingProfile?.id) {
    return NextResponse.json(
      { success: false, message: "Ya existe un perfil interno con ese email." },
      { status: 409 }
    );
  }

  const { error: profileInsertError } = await supabase.from("profiles").insert({
    email,
    full_name: fullName,
    role: parsed.data.role,
    active: parsed.data.active
  });

  if (profileInsertError) {
    console.error("profile insert failed", profileInsertError);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el perfil interno." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Perfil interno creado correctamente."
  });
}
