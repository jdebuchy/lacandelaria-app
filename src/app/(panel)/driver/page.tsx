import Link from "next/link";
import { DriverRouteBoard } from "@/components/driver-route-board";
import { DeliveryTripStartButton } from "@/components/delivery-trip-start-button";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import { getDeliveryTripStatusLabel } from "@/lib/delivery-trips";
import { formatItemsSummary } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLogisticsFlowGuidance,
  getLogisticsFlowLabel,
  getLogisticsFlowTone,
  inferLogisticsFlow
} from "@/lib/logistics";

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  administrative_area_level_1?: string | null;
  delivery_notes?: string | null;
  delivery_area?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  gated_community_name?: string | null;
  locality?: string | null;
  phone?: string | null;
};

type RelatedReseller = {
  full_name?: string | null;
  phone?: string | null;
};

type RelatedOrderItem = {
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number;
};

type RelatedDelivery = {
  delivery_status?: "pending" | "in_route" | "delivered" | "failed" | null;
  proof_note?: string | null;
};

type TripRow = {
  created_at: string;
  driver_user_id: string | null;
  id: string;
  scheduled_date: string;
  status: "draft" | "assigned" | "in_route" | "completed" | "cancelled";
};

type TripOrderRow = {
  delivery_trip_id: string;
  order_id: string;
  sequence_number: number;
};

function takeSingleRelation<T>(value: T | T[] | null): T | null {
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

export default async function DriverPage() {
  const auth = await requirePageRole(DRIVER_ALLOWED_ROLES, "/driver");
  const supabase = createAdminClient();
  let tripsQuery = supabase
    .from("delivery_trips")
    .select("id, driver_user_id, scheduled_date, status, created_at")
    .in("status", ["assigned", "in_route"])
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (auth.profile.role === "driver") {
    tripsQuery = tripsQuery.eq("driver_user_id", auth.profile.id);
  }

  const { data: trips, error: tripsError } = await tripsQuery;

  if (tripsError) {
    console.error("driver trips fetch failed", tripsError);
  }

  const tripIds = ((trips ?? []) as TripRow[]).map((trip) => trip.id);
  const { data: tripOrders, error: tripOrdersError } = tripIds.length
    ? await supabase
        .from("delivery_trip_orders")
        .select("delivery_trip_id, order_id, sequence_number")
        .in("delivery_trip_id", tripIds)
        .is("released_at", null)
        .order("sequence_number", { ascending: true })
    : { data: [], error: null };

  if (tripOrdersError) {
    console.error("driver trip orders fetch failed", tripOrdersError);
  }

  const orderIds = ((tripOrders ?? []) as TripOrderRow[]).map((item) => item.order_id);
  const { data: orders, error: ordersError } = orderIds.length
    ? await supabase
        .from("orders")
        .select(
          `
            id,
            sales_channel,
            reseller_id,
            items_count,
            payment_method_expected,
            payment_status,
            status,
            delivery_date,
            delivery_area,
            notes,
            customers (
              first_name,
              last_name,
              phone,
              address_kind,
              address_line_1,
              locality,
              administrative_area_level_1,
              gated_community_name,
              delivery_area,
              delivery_notes
            ),
            resellers (
              full_name,
              phone
            ),
            deliveries (
              delivery_status,
              proof_note
            ),
            order_items (
              product_name_snapshot,
              sales_unit_label_snapshot,
              quantity
            )
          `
        )
        .in("id", orderIds)
    : { data: [], error: null };

  if (ordersError) {
    console.error("driver orders fetch failed", ordersError);
  }

  const orderById = new Map((orders ?? []).map((order) => [order.id, order]));
  const tripOrderRows = (tripOrders ?? []) as TripOrderRow[];
  const tripsWithStops = ((trips ?? []) as TripRow[])
    .map((trip) => {
      const stops = tripOrderRows
        .filter((item) => item.delivery_trip_id === trip.id)
        .map((item) => {
          const order = orderById.get(item.order_id);

          if (!order) {
            return null;
          }

          const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
          const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
          const delivery = takeSingleRelation<RelatedDelivery>(order.deliveries ?? null);
          const items = (order.order_items ?? []) as RelatedOrderItem[];
          const flow = inferLogisticsFlow({
            addressLine1: customer?.address_line_1,
            administrativeAreaLevel1: customer?.administrative_area_level_1,
            deliveryArea: order.delivery_area || customer?.delivery_area,
            locality: customer?.locality,
            resellerId: order.reseller_id,
            salesChannel: order.sales_channel
          });

          return {
            addressSummary: customer
              ? formatStructuredAddressSummary({
                  addressKind: customer.address_kind ?? "standard",
                  addressLine1: customer.address_line_1 ?? "",
                  gatedCommunityName: customer.gated_community_name ?? "",
                  locality: customer.locality ?? ""
                })
              : "-",
            customerName: customer
              ? formatPersonName(customer.first_name, customer.last_name)
              : reseller?.full_name || "Cliente sin nombre",
            customerPhone: customer?.phone || reseller?.phone || "-",
            deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
            deliveryDate: order.delivery_date,
            deliveryStatus:
              delivery?.delivery_status || (order.status === "in_route" ? "in_route" : "pending"),
            flowGuidance: getLogisticsFlowGuidance(flow),
            flowLabel: getLogisticsFlowLabel(flow),
            flowTone: getLogisticsFlowTone(flow),
            id: order.id,
            itemsCount: Number(order.items_count ?? 0),
            itemsSummary: formatItemsSummary(items, 3),
            notes: delivery?.proof_note || order.notes || customer?.delivery_notes || null,
            orderStatus: order.status,
            paymentMethodExpected: order.payment_method_expected,
            paymentStatus: order.payment_status,
            resellerName: reseller?.full_name || null,
            sequenceNumber: item.sequence_number
          };
        })
        .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop));

      return {
        ...trip,
        stops
      };
    })
    .filter((trip) => trip.stops.length > 0);

  const flatStops = tripsWithStops.flatMap((trip) => trip.stops);
  const pendingStops = flatStops.filter((stop) => stop.deliveryStatus === "pending").length;
  const inRouteStops = flatStops.filter((stop) => stop.deliveryStatus === "in_route").length;
  const deliveredStops = flatStops.filter((stop) => stop.deliveryStatus === "delivered").length;
  const failedStops = flatStops.filter((stop) => stop.deliveryStatus === "failed").length;

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Pantalla de repartidor
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Viajes activos y entregas en marcha
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Cada viaje agrupa sus pedidos, permite iniciar la salida desde depósito y resolver cada
            entrega desde la misma vista.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-stone-50 sm:text-3xl">{pendingStops}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">En reparto</p>
            <p className="mt-2 text-2xl font-semibold text-sky-300 sm:text-3xl">{inRouteStops}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Entregados</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300 sm:text-3xl">{deliveredStops}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Rechazados</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300 sm:text-3xl">{failedStops}</p>
          </article>
        </div>

        <div className="grid gap-5">
          {tripsWithStops.length ? (
            tripsWithStops.map((trip) => (
              <section key={trip.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
                <div className="flex flex-col gap-4 border-b border-stone-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                        {getDeliveryTripStatusLabel(trip.status)}
                      </span>
                      <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                        {formatDate(trip.scheduled_date)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-stone-50">
                      Viaje {trip.id.slice(0, 8)}
                    </h2>
                    <p className="mt-1 text-sm text-stone-400">{trip.stops.length} pedidos asignados</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/panel/logistics/${trip.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500"
                    >
                      Ver detalle
                    </Link>
                    {trip.status === "assigned" ? <DeliveryTripStartButton tripId={trip.id} /> : null}
                  </div>
                </div>

                <div className="mt-5">
                  <DriverRouteBoard stops={trip.stops} />
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 px-6 py-10 text-sm text-stone-400">
              No hay viajes activos para mostrar.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
