import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { loadDeliveryTripPlanning } from "@/lib/delivery-planning";
import { computeDisplayedRoute } from "@/lib/delivery-routing";
import { createAdminClient } from "@/lib/supabase/admin";

const routingStopSchema = z.object({
  addressLine1: z.string(),
  administrativeAreaLevel1: z.string(),
  deliveryWindowEnd: z.string().nullable(),
  deliveryWindowStart: z.string().nullable(),
  googlePlaceId: z.string().nullable(),
  locality: z.string(),
  orderId: z.string().uuid(),
  sequenceNumber: z.number().int().positive()
});

const previewRouteSchema = z.object({
  orderedStopIds: z.array(z.string().uuid()).optional(),
  stops: z.array(routingStopSchema).optional()
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

  const body = await request.json().catch(() => ({}));
  const parsed = previewRouteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "No se pudo validar el orden de paradas." },
      { status: 400 }
    );
  }

  const { tripId } = await context.params;
  const supabase = createAdminClient();
  const { trip } = await loadDeliveryTripPlanning(supabase, tripId);

  if (!trip) {
    return NextResponse.json(
      { success: false, message: "No se encontro el viaje." },
      { status: 404 }
    );
  }

  const routeStops = parsed.data.stops?.length ? parsed.data.stops : trip.stops;
  const route = await computeDisplayedRoute(routeStops, parsed.data.orderedStopIds, trip.depot);

  return NextResponse.json({
    route,
    success: true
  });
}
