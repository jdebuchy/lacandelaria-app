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
        <h1 className="text-3xl font-bold tracking-tight text-stone-50">Mi reparto</h1>
        <p className="mt-1 text-[15px] text-stone-400">{auth.profile.full_name}</p>
      </header>

      {tripRows.length ? (
        <div className="grid gap-3">
          {tripRows.map((trip) => {
            const counts = stopsByTrip.get(trip.id) ?? { resolved: 0, total: 0 };

            return (
              <Link
                className="block rounded-2xl border border-stone-700 bg-stone-900 p-5 transition active:bg-stone-800"
                href={`/reparto/${trip.id}`}
                key={trip.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xl font-bold text-stone-50 first-letter:uppercase">
                    {formatTripDate(trip.scheduled_date)}
                  </p>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                      trip.status === "in_route"
                        ? "bg-sky-400 text-stone-950"
                        : "bg-stone-700 text-stone-200"
                    }`}
                  >
                    {getDeliveryTripStatusLabel(trip.status)}
                  </span>
                </div>
                <p className="mt-2 text-[15px] tabular-nums text-stone-400">
                  {counts.resolved} de {counts.total} paradas ·{" "}
                  {formatTripNumber(trip.trip_number)}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-700 px-5 py-10 text-center text-[15px] leading-6 text-stone-400">
          No tenés viajes asignados.
        </p>
      )}
    </main>
  );
}
