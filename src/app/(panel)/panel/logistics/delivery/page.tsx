import Link from "next/link";
import { DeliveryTripStartButton } from "@/components/delivery-trip-start-button";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
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
  unresolvedCount: number;
};

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
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
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
    case "in_route":
      return "border-sky-400/20 bg-sky-500/10 text-sky-100";
    default:
      return "border-stone-700 bg-stone-950/80 text-stone-300";
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
    .select("id, driver_user_id, scheduled_date, status, created_at")
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
        searchText: normalizeSearchValue(`${trip.id.slice(0, 8)} ${trip.status} ${searchNames}`),
        status: trip.status,
        totalStops: rows.length,
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
      <article key={trip.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-stone-50">Viaje {trip.id.slice(0, 8)}</h3>
              <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
                {getDeliveryTripStatusLabel(trip.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-stone-400">{formatDate(trip.scheduledDate)}</p>
          </div>
          <Link
            href={`/panel/logistics/delivery/${trip.id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500"
          >
            Ver viaje
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-stone-950/80 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Repartidor</p>
            <p className="mt-1 text-sm text-stone-100">{trip.driverName}</p>
          </div>
          <div className="rounded-2xl bg-stone-950/80 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Pedidos</p>
            <p className="mt-1 text-sm text-stone-100">{metricLabel(trip.totalStops, "pedido", "pedidos")}</p>
          </div>
          <div className="rounded-2xl bg-stone-950/80 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Incidencias</p>
            <p className="mt-1 text-sm text-stone-100">
              {trip.failedCount ? metricLabel(trip.failedCount, "incidencia", "incidencias") : "Sin incidencias"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-sm text-stone-400">
            <span>{trip.progressLabel}</span>
            <span>{trip.unresolvedCount ? `${trip.unresolvedCount} pendientes` : "Todo resuelto"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-950">
            <div
              className="h-full rounded-full bg-stone-100"
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
            <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Viajes de entrega
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-stone-300">
              Visualizá y gestioná todos los viajes de entrega. Abrí cada viaje para registrar entregas,
              no entregados y cobros en efectivo.
            </p>
          </div>
          <Link
            href="/panel/logistics"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stone-100 px-4 text-sm font-medium text-stone-950 transition hover:bg-white"
          >
            Iniciar nuevo viaje
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Activos hoy</p>
            <p className="mt-2 text-3xl font-semibold text-stone-50">{activeToday}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Proximos</p>
            <p className="mt-2 text-3xl font-semibold text-stone-50">{upcoming}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Completados</p>
            <p className="mt-2 text-3xl font-semibold text-stone-50">{completed}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Con incidencias</p>
            <p className="mt-2 text-3xl font-semibold text-stone-50">{withIncidents}</p>
          </article>
        </div>

        <form className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_190px_220px_auto]">
            <div className="min-w-0">
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Buscar por ID de viaje, repartidor o cliente"
                className="h-11 w-full min-w-0 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none transition focus:border-stone-500"
              />
            </div>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 w-full min-w-0 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-stone-500"
            >
              <option value="all">Estado: Todos</option>
              <option value="assigned">Estado: Asignados</option>
              <option value="in_route">Estado: En reparto</option>
              <option value="completed">Estado: Completados</option>
            </select>
            <select
              name="date"
              defaultValue={dateFilter}
              className="h-11 w-full min-w-0 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-stone-500"
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
              className="h-11 w-full min-w-0 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-stone-500"
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
              className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500"
            >
              Filtrar
            </button>
          </div>
        </form>

        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-stone-50">Hoy</h2>
              <span className="text-sm text-stone-500">{sections.today.length}</span>
            </div>
            {sections.today.length ? (
              <div className="grid gap-4 xl:grid-cols-3">{sections.today.map(renderTripCard)}</div>
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/50 px-6 py-8 text-sm text-stone-400">
                No hay viajes para hoy con los filtros actuales.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-stone-50">Mañana</h2>
              <span className="text-sm text-stone-500">{sections.tomorrow.length}</span>
            </div>
            {sections.tomorrow.length ? (
              <div className="grid gap-4 xl:grid-cols-3">{sections.tomorrow.map(renderTripCard)}</div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-stone-50">Proximos dias</h2>
              <span className="text-sm text-stone-500">{sections.future.length}</span>
            </div>
            {sections.future.length ? (
              <div className="grid gap-4 xl:grid-cols-3">{sections.future.map(renderTripCard)}</div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-stone-50">Viajes anteriores</h2>
              <span className="text-sm text-stone-500">{sections.previous.length}</span>
            </div>
            {sections.previous.length ? (
              <div className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-stone-800 text-sm">
                    <thead className="bg-stone-950/70 text-left text-xs uppercase tracking-[0.16em] text-stone-500">
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
                    <tbody className="divide-y divide-stone-800">
                      {sections.previous.map((trip) => (
                        <tr key={trip.id} className="text-stone-300">
                          <td className="px-4 py-4 font-medium text-stone-100">Viaje {trip.id.slice(0, 8)}</td>
                          <td className="px-4 py-4">{formatDate(trip.scheduledDate)}</td>
                          <td className="px-4 py-4">{trip.driverName}</td>
                          <td className="px-4 py-4">{trip.totalStops}</td>
                          <td className="px-4 py-4">
                            <div className="min-w-[160px]">
                              <div className="flex items-center justify-between gap-3 text-xs text-stone-400">
                                <span>{trip.progressLabel}</span>
                                <span>{trip.failedCount ? `${trip.failedCount} incid.` : "Sin incidencias"}</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-950">
                                <div
                                  className="h-full rounded-full bg-stone-100"
                                  style={{
                                    width: `${trip.totalStops ? ((trip.deliveredCount + trip.failedCount) / trip.totalStops) * 100 : 0}%`
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusTone(trip.status)}`}
                            >
                              {getDeliveryTripStatusLabel(trip.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Link
                              href={`/panel/logistics/delivery/${trip.id}`}
                              className="inline-flex h-9 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500"
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
