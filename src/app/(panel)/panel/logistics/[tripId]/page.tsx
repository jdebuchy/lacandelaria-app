import { notFound } from "next/navigation";
import { DeliveryTripPlanner } from "@/components/delivery-trip-planner";
import { DeliveryTripStartButton } from "@/components/delivery-trip-start-button";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { loadDeliveryTripPlanning } from "@/lib/delivery-planning";
import { computeDisplayedRoute } from "@/lib/delivery-routing";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = {
  params: Promise<{
    tripId: string;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

export default async function DeliveryTripDetailPage(context: Params) {
  const auth = await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/logistics");
  const { tripId } = await context.params;
  const supabase = createAdminClient();
  const { drivers, trip } = await loadDeliveryTripPlanning(supabase, tripId);

  if (!trip) {
    notFound();
  }

  const initialRoute = await computeDisplayedRoute(trip.stops, undefined, trip.depot);

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
              Planificación de viaje
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Viaje {trip.id.slice(0, 8)}
            </h1>
            <p className="mt-2 text-base text-stone-300">
              {formatDate(trip.scheduledDate)} · {getDeliveryTripStatusLabel(trip.status)}
            </p>
          </div>

          {trip.status === "assigned" && auth.profile.role === "admin" ? (
            <DeliveryTripStartButton tripId={trip.id} />
          ) : null}
        </div>

        <DeliveryTripPlanner drivers={drivers} initialRoute={initialRoute} trip={trip} />
      </section>
    </main>
  );
}
