import Link from "next/link";
import { DeliveryTripCreateForm } from "@/components/delivery-trip-create-form";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { formatItemsSummary } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  delivery_area?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  gated_community_name?: string | null;
  locality?: string | null;
};

type RelatedOrderItem = {
  product_name_snapshot: string;
  quantity: number;
  sales_unit_label_snapshot: string;
};

type RelatedReseller = {
  full_name?: string | null;
};

type TripRow = {
  created_at: string;
  driver_user_id: string | null;
  id: string;
  scheduled_date: string;
  status: "assigned" | "completed" | "in_route";
};

function takeSingleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

export default async function LogisticsPage() {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/logistics");
  const supabase = createAdminClient();
  const [{ data: drivers }, { data: activeTripOrders }, { data: orders }, { data: trips }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["driver", "admin"])
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase.from("delivery_trip_orders").select("order_id").is("released_at", null),
    supabase
      .from("orders")
      .select(
        `
          id,
          status,
          delivery_date,
          delivery_area,
          customers (
            first_name,
            last_name,
            address_kind,
            address_line_1,
            delivery_area,
            gated_community_name,
            locality
          ),
          resellers (
            full_name
          ),
          order_items (
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity
          )
        `
      )
      .in("status", ["confirmed", "assigned", "in_route"])
      .order("delivery_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("delivery_trips")
      .select("id, scheduled_date, status, driver_user_id, created_at")
      .in("status", ["assigned", "in_route", "completed"])
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(40)
  ]);

  const activeOrderIdSet = new Set((activeTripOrders ?? []).map((row) => row.order_id));
  const pendingOrders = (orders ?? [])
    .filter((order) => !activeOrderIdSet.has(order.id) && order.status === "confirmed")
    .map((order) => {
      const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
      const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
      const items = (order.order_items ?? []) as RelatedOrderItem[];
      const customerName = customer
        ? formatPersonName(customer.first_name, customer.last_name)
        : reseller?.full_name || "Cliente sin nombre";
      const addressSummary = customer
        ? formatStructuredAddressSummary({
            addressKind: customer.address_kind ?? "standard",
            addressLine1: customer.address_line_1 ?? "",
            gatedCommunityName: customer.gated_community_name ?? "",
            locality: customer.locality ?? ""
          })
        : "-";

      return {
        area: order.delivery_area || customer?.delivery_area || "pending_review",
        customerName,
        deliveryDate: order.delivery_date,
        id: order.id,
        itemsSummary: formatItemsSummary(items, 3),
        label: `${formatDate(order.delivery_date)} · ${addressSummary}`
      };
    });

  const driverOptions = (drivers ?? []).map((driver) => ({
    id: driver.id,
    name: driver.full_name
  }));

  const tripIds = ((trips ?? []) as TripRow[]).map((trip) => trip.id);
  const { data: activeTripRows } = tripIds.length
    ? await supabase
        .from("delivery_trip_orders")
        .select("delivery_trip_id, order_id")
        .in("delivery_trip_id", tripIds)
        .is("released_at", null)
    : { data: [] };
  const tripCounts = new Map<string, number>();

  for (const row of activeTripRows ?? []) {
    tripCounts.set(row.delivery_trip_id, (tripCounts.get(row.delivery_trip_id) ?? 0) + 1);
  }

  const today = todayDate();
  const visibleTrips = ((trips ?? []) as TripRow[]).filter(
    (trip) => trip.created_at.slice(0, 10) === today || trip.status === "assigned" || trip.status === "in_route"
  );

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
            Logística
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Armado de pedidos
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Crea el viaje desde los pedidos pendientes y, una vez armado, termina de ordenar el recorrido
            dentro del detalle del viaje.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-stone-200">
            {pendingOrders.length} pedidos pendientes
          </span>
          <span className="rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-stone-200">
            {visibleTrips.length} viajes de hoy o pendientes
          </span>
        </div>

        <DeliveryTripCreateForm defaultDate={today} drivers={driverOptions} orders={pendingOrders} />

        <section className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-stone-50">Viajes creados hoy o pendientes</h2>
              <p className="mt-1 text-sm text-stone-400">
                Lista compacta para volver rápido al armado de cada recorrido.
              </p>
            </div>
            <span className="text-sm text-stone-500">{visibleTrips.length}</span>
          </div>

          <div className="mt-5 divide-y divide-stone-800">
            {visibleTrips.length ? (
              visibleTrips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/panel/logistics/${trip.id}`}
                  className="grid gap-3 px-1 py-4 transition hover:bg-stone-900/50 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-100">Viaje {trip.id.slice(0, 8)}</p>
                    <p className="mt-1 text-sm text-stone-400">{formatDate(trip.scheduled_date)}</p>
                  </div>
                  <p className="text-sm text-stone-300">{tripCounts.get(trip.id) ?? 0} pedidos</p>
                  <span className="justify-self-start rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
                    {getDeliveryTripStatusLabel(trip.status)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-1 py-6 text-sm text-stone-400">
                Todavía no hay viajes creados hoy ni recorridos pendientes.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
