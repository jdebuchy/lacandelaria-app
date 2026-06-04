import { notFound } from "next/navigation";
import { DeliveryTripEditor } from "@/components/delivery-trip-editor";
import { DeliveryTripStartButton } from "@/components/delivery-trip-start-button";
import { DriverRouteBoard } from "@/components/driver-route-board";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
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

type Params = {
  params: Promise<{
    tripId: string;
  }>;
};

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

export default async function DeliveryTripDetailPage(context: Params) {
  const auth = await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/logistics");
  const { tripId } = await context.params;
  const supabase = createAdminClient();
  const [{ data: drivers }, { data: trip }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["driver", "admin"])
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("delivery_trips")
      .select("id, scheduled_date, driver_user_id, status, notes, started_at, completed_at")
      .eq("id", tripId)
      .single()
  ]);

  if (!trip) {
    notFound();
  }

  const { data: tripOrders } = await supabase
    .from("delivery_trip_orders")
    .select("id, order_id, sequence_number, released_at")
    .eq("delivery_trip_id", tripId)
    .is("released_at", null)
    .order("sequence_number", { ascending: true });

  const orderIds = (tripOrders ?? []).map((item) => item.order_id);
  const { data: orders } = orderIds.length
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
    : { data: [] };

  const orderById = new Map((orders ?? []).map((order) => [order.id, order]));
  const stops = (tripOrders ?? [])
    .map((tripOrder) => {
      const order = orderById.get(tripOrder.order_id);

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
        deliveryStatus: delivery?.delivery_status || (order.status === "in_route" ? "in_route" : "pending"),
        flowGuidance: getLogisticsFlowGuidance(flow),
        flowLabel: getLogisticsFlowLabel(flow),
        flowTone: getLogisticsFlowTone(flow),
        id: order.id,
        itemsCount: Number(order.items_count ?? 0),
        itemsSummary: formatItemsSummary(items, 3),
        notes: delivery?.proof_note || order.notes || customer?.delivery_notes || null,
        orderId: order.id,
        orderStatus: order.status,
        paymentMethodExpected: order.payment_method_expected,
        paymentStatus: order.payment_status,
        resellerName: reseller?.full_name || null,
        sequenceNumber: tripOrder.sequence_number,
        tripOrderId: tripOrder.id
      };
    })
    .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop));

  const pendingCount = stops.filter((stop) => stop.deliveryStatus === "pending").length;
  const deliveredCount = stops.filter((stop) => stop.deliveryStatus === "delivered").length;
  const failedCount = stops.filter((stop) => stop.deliveryStatus === "failed").length;

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
              Viaje
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Viaje {trip.id.slice(0, 8)}
            </h1>
            <p className="mt-2 text-base text-stone-300">
              {formatDate(trip.scheduled_date)} · {getDeliveryTripStatusLabel(trip.status)}
            </p>
          </div>
          {trip.status === "assigned" && auth.profile.role === "admin" ? (
            <DeliveryTripStartButton tripId={trip.id} />
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pedidos activos</p>
            <p className="mt-2 text-2xl font-semibold text-stone-50 sm:text-3xl">{stops.length}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-sky-300 sm:text-3xl">{pendingCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Entregados</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300 sm:text-3xl">{deliveredCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Rechazados</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300 sm:text-3xl">{failedCount}</p>
          </article>
        </div>

        <DeliveryTripEditor
          drivers={(drivers ?? []).map((driver) => ({ id: driver.id, name: driver.full_name }))}
          notes={trip.notes ?? ""}
          scheduledDate={trip.scheduled_date}
          selectedDriverId={trip.driver_user_id}
          stops={stops.map((stop) => ({
            customerName: stop.customerName,
            id: stop.tripOrderId,
            orderId: stop.orderId,
            sequenceNumber: stop.sequenceNumber
          }))}
          tripId={trip.id}
        />

        <DriverRouteBoard stops={stops} allowActions={auth.profile.role === "admin"} />
      </section>
    </main>
  );
}
