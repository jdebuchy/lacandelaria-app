import Link from "next/link";
import { DateText } from "@/components/ui/date-text";
import { DeliveryTripStartButton } from "@/components/delivery-trip-start-button";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { formatTripNumber } from "@/lib/orders";
import { includesNormalizedSearchValue, normalizeSearchValue } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryFailureReason, DeliveryStatus } from "@/lib/types";

type SearchParams = Promise<{
  date?: string;
  driver?: string;
  q?: string;
  status?: string;
}>;

type TripRow = {
  created_at: string;
  driver_user_id: string | null;
  id: string;
  scheduled_date: string;
  status: "assigned" | "in_route" | "completed";
  trip_number: number | null;
};

type TripOrderRow = {
  delivery_trip_id: string;
  order_id: string;
  released_at: string | null;
  sequence_number: number;
  stop_failure_reason: DeliveryFailureReason | null;
  stop_status: DeliveryStatus | null;
};

type DriverProfile = {
  full_name: string | null;
  id: string;
};

type RelatedCustomer = {
  first_name?: string | null;
  last_name?: string | null;
};

type RelatedDelivery = {
  delivery_status?: DeliveryStatus | null;
};

type OrderRow = {
  customers?: RelatedCustomer | RelatedCustomer[] | null;
  deliveries?: RelatedDelivery | RelatedDelivery[] | null;
  id: string;
  status: string;
};

type TripCard = {
  deliveredCount: number;
  driverName: string;
  failedCount: number;
  id: string;
  progressLabel: string;
  scheduledDate: string;
  searchText: string;
  status: TripRow["status"];
  totalStops: number;
  tripNumber: number | null;
  unresolvedCount: number;
};

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function startOfToday() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date());
}

function plusDays(base: string, days: number) {
  const next = new Date(`${base}T12:00:00-03:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function getEffectiveStopStatus(row: TripOrderRow, order: OrderRow | undefined) {
  if (row.released_at) {
    return row.stop_status ?? "failed";
  }

  const delivery = takeSingleRelation(order?.deliveries);
  return delivery?.delivery_status ?? row.stop_status ?? "pending";
}

function buildSectionedTrips(trips: TripCard[], today: string) {
  const tomorrow = plusDays(today, 1);

  return {
    future: trips.filter((trip) => trip.scheduledDate > tomorrow),
    previous: trips.filter((trip) => trip.scheduledDate < today),
    today: trips.filter((trip) => trip.scheduledDate === today),
    tomorrow: trips.filter((trip) => trip.scheduledDate === tomorrow)
  };
}

function matchesDateFilter(trip: TripCard, filter: string, today: string) {
  const tomorrow = plusDays(today, 1);
  const nextWeek = plusDays(today, 7);

  switch (filter) {
    case "today":
      return trip.scheduledDate === today;
    case "next_7":
      return trip.scheduledDate >= today && trip.scheduledDate <= nextWeek;
    case "upcoming":
      return trip.scheduledDate > tomorrow;
    case "past":
      return trip.scheduledDate < today || trip.status === "completed";
    default:
      return true;
  }
}

function metricLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function statusTone(status: TripCard["status"]) {
  switch (status) {
    case "completed":
      return "border-accent bg-accent-soft text-accent";
    case "in_route":
      return "border-info-line bg-info-bg text-info-fg";
    default:
      return "border-line bg-paper-muted text-ink-soft";
  }
}

export default async function LogisticsDeliveryPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const auth = await requirePageRole(DRIVER_ALLOWED_ROLES, "/panel/logistics/delivery");
  const params = await searchParams;
  const supabase = createAdminClient();
  let tripsQuery = supabase
    .from("delivery_trips")
    .select("id, trip_number, driver_user_id, scheduled_date, status, created_at")
    .in("status", ["assigned", "in_route", "completed"])
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (auth.profile.role === "driver") {
    tripsQuery = tripsQuery.eq("driver_user_id", auth.profile.id);
  }

  const [{ data: trips }, { data: drivers }] = await Promise.all([
    tripsQuery,
    supabase.from("profiles").select("id, full_name").in("role", ["driver", "admin"]).eq("active", true)
  ]);

  const tripIds = ((trips ?? []) as TripRow[]).map((trip) => trip.id);
  const { data: tripOrders } = tripIds.length
    ? await supabase
        .from("delivery_trip_orders")
        .select(
          "delivery_trip_id, order_id, released_at, sequence_number, stop_status, stop_failure_reason"
        )
        .in("delivery_trip_id", tripIds)
        .order("sequence_number", { ascending: true })
    : { data: [] };

  const orderIds = ((tripOrders ?? []) as TripOrderRow[]).map((row) => row.order_id);
  const { data: orders } = orderIds.length
    ? await supabase
        .from("orders")
        .select(
          `
            id,
            status,
            customers (
              first_name,
              last_name
            ),
            deliveries (
              delivery_status
            )
          `
        )
        .in("id", orderIds)
    : { data: [] };

  const driverById = new Map((drivers ?? []).map((driver: DriverProfile) => [driver.id, driver.full_name || "Sin asignar"]));
  const orderById = new Map((orders ?? []).map((order: OrderRow) => [order.id, order]));
  const cards = ((trips ?? []) as TripRow[])
    .map((trip) => {
    const rows = ((tripOrders ?? []) as TripOrderRow[]).filter((row) => row.delivery_trip_id === trip.id);
    const deliveredCount = rows.filter(
      (row) => getEffectiveStopStatus(row, orderById.get(row.order_id)) === "delivered"
    ).length;
    const failedCount = rows.filter(
      (row) => getEffectiveStopStatus(row, orderById.get(row.order_id)) === "failed"
    ).length;
    const unresolvedCount = rows.length - deliveredCount - failedCount;
    const searchNames = rows
      .map((row) => {
        const customer = takeSingleRelation<RelatedCustomer>(orderById.get(row.order_id)?.customers ?? null);
        return customer ? formatPersonName(customer.first_name, customer.last_name) : "";
      })
      .join(" ");

      return {
        deliveredCount,
        driverName: trip.driver_user_id ? driverById.get(trip.driver_user_id) || "Sin asignar" : "Sin asignar",
        failedCount,
        id: trip.id,
        progressLabel: `${deliveredCount + failedCount}/${rows.length} resueltos`,
        scheduledDate: trip.scheduled_date,
        searchText: normalizeSearchValue(`${trip.trip_number ?? ""} ${trip.status} ${searchNames}`),
        status: trip.status,
        totalStops: rows.length,
        tripNumber: trip.trip_number,
        unresolvedCount
      } satisfies TripCard;
    })
    .filter((trip) => trip.totalStops > 0);

  const today = startOfToday();
  const activeToday = cards.filter(
    (trip) => trip.scheduledDate === today && (trip.status === "assigned" || trip.status === "in_route")
  ).length;
  const upcoming = cards.filter(
    (trip) => trip.scheduledDate > today && (trip.status === "assigned" || trip.status === "in_route")
  ).length;
  const completed = cards.filter((trip) => trip.status === "completed").length;
  const withIncidents = cards.filter((trip) => trip.failedCount > 0).length;
  const query = normalizeSearchValue(params.q);
  const statusFilter = params.status || "all";
  const dateFilter = params.date || "all";
  const driverFilter = params.driver || "all";

  const filteredCards = cards.filter((trip) => {
    if (
      query &&
      !trip.searchText.includes(query) &&
      !includesNormalizedSearchValue(trip.driverName, query)
    ) {
      return false;
    }

    if (statusFilter !== "all" && trip.status !== statusFilter) {
      return false;
    }

    if (driverFilter !== "all") {
      const matchedTrip = (trips ?? []).find((candidate: TripRow) => candidate.id === trip.id);
      if (matchedTrip?.driver_user_id !== driverFilter) {
        return false;
      }
    }

    return matchesDateFilter(trip, dateFilter, today);
  });

  const sections = buildSectionedTrips(filteredCards, today);

  function renderTripCard(trip: TripCard) {
    const completionRatio = trip.totalStops ? ((trip.deliveredCount + trip.failedCount) / trip.totalStops) * 100 : 0;

    return (
      <article key={trip.id} className="rounded-card border border-line bg-paper p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-title font-semibold text-ink">{formatTripNumber(trip.tripNumber)}</h3>
              <span className="rounded-control border border-line bg-paper-muted px-3 py-1 text-meta text-ink-soft">
                {getDeliveryTripStatusLabel(trip.status)}
              </span>
            </div>
            <p className="mt-2 text-body text-ink-soft"><DateText value={trip.scheduledDate} /></p>
          </div>
          <Link
            href={`/panel/logistics/delivery/${trip.id}`}
            className="inline-flex h-10 items-center justify-center rounded-control border border-line px-4 text-body font-medium text-ink transition hover:border-line-strong"
          >
            Ver viaje
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-card bg-paper-muted p-3">
            <p className="text-meta text-ink-faint">Repartidor</p>
            <p className="mt-1 text-body text-ink">{trip.driverName}</p>
          </div>
          <div className="rounded-card bg-paper-muted p-3">
            <p className="text-meta text-ink-faint">Pedidos</p>
            <p className="mt-1 text-body text-ink">{metricLabel(trip.totalStops, "pedido", "pedidos")}</p>
          </div>
          <div className="rounded-card bg-paper-muted p-3">
            <p className="text-meta text-ink-faint">Incidencias</p>
            <p className="mt-1 text-body text-ink">
              {trip.failedCount ? metricLabel(trip.failedCount, "incidencia", "incidencias") : "Sin incidencias"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-body text-ink-soft">
            <span>{trip.progressLabel}</span>
            <span>{trip.unresolvedCount ? `${trip.unresolvedCount} pendientes` : "Todo resuelto"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-control bg-paper-muted">
            <div
              className="h-full rounded-control bg-ink"
              style={{ width: `${completionRatio}%` }}
            />
          </div>
        </div>

        {trip.status === "assigned" ? (
          <div className="mt-4">
            <DeliveryTripStartButton tripId={trip.id} label="Iniciar reparto" />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-display font-semibold tracking-tight text-ink">
              Viajes de entrega
            </h1>
            <p className="mt-2 max-w-3xl text-body leading-7 text-ink-soft">
              Visualizá y gestioná todos los viajes de entrega. Abrí cada viaje para registrar entregas,
              no entregados y cobros en efectivo.
            </p>
          </div>
          <Link
            href="/panel/logistics"
            className="inline-flex h-11 items-center justify-center rounded-control bg-ink px-4 text-body font-medium text-accent-fg transition hover:bg-white"
          >
            Iniciar nuevo viaje
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <article className="rounded-card border border-line bg-paper p-5">
            <p className="text-body text-ink-soft">Activos hoy</p>
            <p className="mt-2 text-display font-semibold text-ink">{activeToday}</p>
          </article>
          <article className="rounded-card border border-line bg-paper p-5">
            <p className="text-body text-ink-soft">Proximos</p>
            <p className="mt-2 text-display font-semibold text-ink">{upcoming}</p>
          </article>
          <article className="rounded-card border border-line bg-paper p-5">
            <p className="text-body text-ink-soft">Completados</p>
            <p className="mt-2 text-display font-semibold text-ink">{completed}</p>
          </article>
          <article className="rounded-card border border-line bg-paper p-5">
            <p className="text-body text-ink-soft">Con incidencias</p>
            <p className="mt-2 text-display font-semibold text-ink">{withIncidents}</p>
          </article>
        </div>

        <form className="rounded-card border border-line bg-paper p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_190px_220px_auto]">
            <div className="min-w-0">
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Buscar por ID de viaje, repartidor o cliente"
                className="h-11 w-full min-w-0 rounded-control border border-line bg-paper-muted px-4 text-body text-ink outline-hidden transition focus:border-line-strong"
              />
            </div>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 w-full min-w-0 rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden transition focus:border-line-strong"
            >
              <option value="all">Estado: Todos</option>
              <option value="assigned">Estado: Asignados</option>
              <option value="in_route">Estado: En reparto</option>
              <option value="completed">Estado: Completados</option>
            </select>
            <select
              name="date"
              defaultValue={dateFilter}
              className="h-11 w-full min-w-0 rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden transition focus:border-line-strong"
            >
              <option value="all">Fecha: Todas</option>
              <option value="today">Fecha: Hoy</option>
              <option value="next_7">Fecha: Proximos 7 dias</option>
              <option value="upcoming">Fecha: Futuro</option>
              <option value="past">Fecha: Anteriores</option>
            </select>
            <select
              name="driver"
              defaultValue={driverFilter}
              className="h-11 w-full min-w-0 rounded-control border border-line bg-paper-muted px-3 text-body text-ink outline-hidden transition focus:border-line-strong"
            >
              <option value="all">Reparto: Todos</option>
              {(drivers ?? []).map((driver: DriverProfile) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name || "Sin nombre"}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-control border border-line px-4 text-body font-medium text-ink transition hover:border-line-strong"
            >
              Filtrar
            </button>
          </div>
        </form>

        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title font-semibold text-ink">Hoy</h2>
              <span className="text-body text-ink-faint">{sections.today.length}</span>
            </div>
            {sections.today.length ? (
              <div className="grid gap-4 xl:grid-cols-3">{sections.today.map(renderTripCard)}</div>
            ) : (
              <div className="rounded-card border border-dashed border-line bg-paper px-6 py-8 text-body text-ink-soft">
                No hay viajes para hoy con los filtros actuales.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title font-semibold text-ink">Mañana</h2>
              <span className="text-body text-ink-faint">{sections.tomorrow.length}</span>
            </div>
            {sections.tomorrow.length ? (
              <div className="grid gap-4 xl:grid-cols-3">{sections.tomorrow.map(renderTripCard)}</div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title font-semibold text-ink">Proximos dias</h2>
              <span className="text-body text-ink-faint">{sections.future.length}</span>
            </div>
            {sections.future.length ? (
              <div className="grid gap-4 xl:grid-cols-3">{sections.future.map(renderTripCard)}</div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-title font-semibold text-ink">Viajes anteriores</h2>
              <span className="text-body text-ink-faint">{sections.previous.length}</span>
            </div>
            {sections.previous.length ? (
              <div className="overflow-hidden rounded-card border border-line bg-paper">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-body">
                    <thead className="bg-paper-muted text-left text-meta text-ink-faint">
                      <tr>
                        <th className="px-4 py-3">ID de viaje</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Conductor</th>
                        <th className="px-4 py-3">Pedidos</th>
                        <th className="px-4 py-3">Progreso</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {sections.previous.map((trip) => (
                        <tr key={trip.id} className="text-ink-soft">
                          <td className="px-4 py-4 font-medium text-ink">{formatTripNumber(trip.tripNumber)}</td>
                          <td className="px-4 py-4"><DateText value={trip.scheduledDate} /></td>
                          <td className="px-4 py-4">{trip.driverName}</td>
                          <td className="px-4 py-4">{trip.totalStops}</td>
                          <td className="px-4 py-4">
                            <div className="min-w-[160px]">
                              <div className="flex items-center justify-between gap-3 text-meta text-ink-soft">
                                <span>{trip.progressLabel}</span>
                                <span>{trip.failedCount ? `${trip.failedCount} incid.` : "Sin incidencias"}</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-control bg-paper-muted">
                                <div
                                  className="h-full rounded-control bg-ink"
                                  style={{
                                    width: `${trip.totalStops ? ((trip.deliveredCount + trip.failedCount) / trip.totalStops) * 100 : 0}%`
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-control border px-3 py-1 text-meta ${statusTone(trip.status)}`}
                            >
                              {getDeliveryTripStatusLabel(trip.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Link
                              href={`/panel/logistics/delivery/${trip.id}`}
                              className="inline-flex h-9 items-center justify-center rounded-control border border-line px-4 text-body font-medium text-ink transition hover:border-line-strong"
                            >
                              Ver viaje
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
