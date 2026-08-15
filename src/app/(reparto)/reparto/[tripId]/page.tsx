import Link from "next/link";
import { notFound } from "next/navigation";
import { RepartoTripAction } from "@/components/reparto/reparto-trip-action";
import { RepartoTripBoard } from "@/components/reparto/reparto-trip-board";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { loadDeliveryTripStops, summarizeTripProgress } from "@/lib/delivery-execution";
import { formatTripDate } from "@/lib/delivery-trips";
import { formatTripNumber } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = {
  params: Promise<{ tripId: string }>;
};

export const dynamic = "force-dynamic";

export default async function RepartoTripPage(context: Params) {
  const auth = await requirePageRole(DRIVER_ALLOWED_ROLES, "/reparto");
  const { tripId } = await context.params;
  const supabase = createAdminClient();

  const { data: trip, error: tripError } = await supabase
    .from("delivery_trips")
    .select("id, driver_user_id, scheduled_date, status, trip_number")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    notFound();
  }

  if (auth.profile.role === "driver" && trip.driver_user_id && trip.driver_user_id !== auth.profile.id) {
    notFound();
  }

  // Las paradas liberadas siguen a la vista: una no entregada tiene que quedar en rojo,
  // no desaparecer y encoger el viaje bajo los pies del repartidor.
  const stops = await loadDeliveryTripStops(supabase, tripId);
  const progress = summarizeTripProgress(stops);

  return (
    <main className="pb-10">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link
          aria-label="Volver a mis viajes"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-soft transition active:bg-paper-raised"
          href="/reparto"
        >
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </Link>
        <p className="text-[15px] font-medium text-ink-soft first-letter:uppercase">
          {formatTripDate(trip.scheduled_date)}
          <span className="ml-2 text-ink-soft">{formatTripNumber(trip.trip_number)}</span>
        </p>
      </header>

      <RepartoTripBoard
        collectedAmount={progress.collectedAmount}
        currentUserId={auth.profile.id}
        stops={stops}
        tripStatus={trip.status}
      />

      <div className="px-4 pt-6">
        {trip.status === "assigned" ? <RepartoTripAction action="start" tripId={trip.id} /> : null}
        {trip.status === "in_route" ? (
          <RepartoTripAction action="complete" tripId={trip.id} />
        ) : null}
        {trip.status === "completed" ? (
          <p className="text-center text-[15px] text-ink-soft">Viaje finalizado.</p>
        ) : null}
      </div>
    </main>
  );
}
