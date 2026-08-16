import { BrandMark } from "@/components/ui/brand";
import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatTripDate, getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { formatTripNumber } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryTripStatus } from "@/lib/types";

type TripRow = {
  id: string;
  scheduled_date: string;
  status: DeliveryTripStatus;
  trip_number: number | null;
};

export const dynamic = "force-dynamic";

export default async function RepartoHomePage() {
  const auth = await requirePageRole(DRIVER_ALLOWED_ROLES, "/reparto");
  const supabase = createAdminClient();

  let tripsQuery = supabase
    .from("delivery_trips")
    .select("id, trip_number, scheduled_date, status")
    .in("status", ["assigned", "in_route"])
    .order("scheduled_date", { ascending: true });

  if (auth.profile.role === "driver") {
    tripsQuery = tripsQuery.eq("driver_user_id", auth.profile.id);
  }

  const { data: trips } = await tripsQuery;
  const tripRows = (trips ?? []) as TripRow[];
  const tripIds = tripRows.map((trip) => trip.id);

  const { data: tripOrders } = tripIds.length
    ? await supabase
        .from("delivery_trip_orders")
        .select("delivery_trip_id, stop_status")
        .in("delivery_trip_id", tripIds)
        .is("released_at", null)
    : { data: [] };

  const stopsByTrip = new Map<string, { resolved: number; total: number }>();

  for (const row of (tripOrders ?? []) as Array<{
    delivery_trip_id: string;
    stop_status: string | null;
  }>) {
    const current = stopsByTrip.get(row.delivery_trip_id) ?? { resolved: 0, total: 0 };
    current.total += 1;

    if (row.stop_status === "delivered" || row.stop_status === "failed") {
      current.resolved += 1;
    }

    stopsByTrip.set(row.delivery_trip_id, current);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" />
          <h1 className="text-display text-ink">Mi reparto</h1>
        </div>
        <p className="mt-1 text-body text-ink-soft">{auth.profile.full_name}</p>
      </header>

      {tripRows.length ? (
        <div className="grid gap-3">
          {tripRows.map((trip) => {
            const counts = stopsByTrip.get(trip.id) ?? { resolved: 0, total: 0 };

            return (
              <Link
                className="block rounded-card border border-line bg-paper p-5 transition active:bg-paper-raised"
                href={`/reparto/${trip.id}`}
                key={trip.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-title font-bold text-ink first-letter:uppercase">
                    {formatTripDate(trip.scheduled_date)}
                  </p>
                  <span
                    className={`rounded-control px-2.5 py-1 text-meta font-bold uppercase ${
                      trip.status === "in_route"
                        ? "bg-info-bg text-accent-fg"
                        : "bg-paper-raised text-ink"
                    }`}
                  >
                    {getDeliveryTripStatusLabel(trip.status)}
                  </span>
                </div>
                <p className="mt-2 text-body tabular-nums text-ink-soft">
                  {counts.resolved} de {counts.total} paradas ·{" "}
                  {formatTripNumber(trip.trip_number)}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-line px-5 py-10 text-center text-body leading-6 text-ink-soft">
          No tenés viajes asignados.
        </p>
      )}
    </main>
  );
}
