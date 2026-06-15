import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { saveDeliveryTripPlan } from "@/lib/delivery-planning";
import { createAdminClient } from "@/lib/supabase/admin";

const saveSequenceSchema = z.object({
  depotId: z.string().uuid("Selecciona un depósito de salida."),
  driverUserId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
  notes: z.string().max(500).optional().or(z.literal("")),
  orderedStopIds: z.array(z.string().uuid()).min(1, "El viaje necesita al menos un pedido."),
  scheduledDate: z.string().min(1, "Selecciona una fecha.")
});

type Params = {
  params: Promise<{
    tripId: string;
  }>;
};

export async function POST(request: Request, context: Params) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = saveSequenceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "No se pudo guardar el viaje." },
      { status: 400 }
    );
  }

  const { tripId } = await context.params;
  const supabase = createAdminClient();

  try {
    await saveDeliveryTripPlan(supabase, {
      depotId: parsed.data.depotId,
      driverUserId: parsed.data.driverUserId || null,
      notes: parsed.data.notes ?? "",
      orderedStopIds: parsed.data.orderedStopIds,
      scheduledDate: parsed.data.scheduledDate,
      tripId
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "No se pudo guardar el viaje." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "Viaje actualizado correctamente.",
    success: true
  });
}
