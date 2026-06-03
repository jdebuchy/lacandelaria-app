import { DriverRouteBoard } from "@/components/driver-route-board";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
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

type RelatedDelivery = {
  assigned_date?: string | null;
  delivered_at?: string | null;
  delivery_status?: "pending" | "in_route" | "delivered" | "failed" | null;
  id?: string | null;
  proof_note?: string | null;
  sequence_number?: number | null;
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

function takeSingleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function routePriority(flow: "capital_federal" | "reseller" | "standard") {
  switch (flow) {
    case "reseller":
      return 0;
    case "capital_federal":
      return 1;
    default:
      return 2;
  }
}

export default async function DriverPage() {
  await requirePageRole(DRIVER_ALLOWED_ROLES, "/driver");
  const supabase = createAdminClient();
  const { data: orders } = await supabase
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
        created_at,
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
          id,
          assigned_date,
          sequence_number,
          delivery_status,
          delivered_at,
          proof_note
        ),
        order_items (
          product_name_snapshot,
          sales_unit_label_snapshot,
          quantity
        )
      `
    )
    .in("status", ["confirmed", "assigned", "in_route", "delivered"])
    .order("delivery_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(40);

  const routeStops = (orders ?? [])
    .map((order) => {
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
        customerName: customer
          ? formatPersonName(customer.first_name, customer.last_name)
          : reseller?.full_name || "Cliente sin nombre",
        customerPhone: customer?.phone || reseller?.phone || "-",
        deliveryDate: order.delivery_date,
        deliveryStatus: delivery?.delivery_status || (order.status === "in_route" ? "in_route" : "pending"),
        flow,
        flowGuidance: getLogisticsFlowGuidance(flow),
        flowLabel: getLogisticsFlowLabel(flow),
        flowTone: getLogisticsFlowTone(flow),
        id: order.id,
        notes: delivery?.proof_note || order.notes || customer?.delivery_notes || null,
        orderStatus: order.status,
        paymentMethodExpected: order.payment_method_expected,
        paymentStatus: order.payment_status,
        itemsCount: Number(order.items_count ?? 0),
        itemsSummary: formatItemsSummary(items, 3),
        resellerName: reseller?.full_name || null,
        routePriority: routePriority(flow),
        sequenceNumber: delivery?.sequence_number ?? null,
        deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
        addressSummary: customer
          ? formatStructuredAddressSummary({
              addressKind: customer.address_kind ?? "standard",
              addressLine1: customer.address_line_1 ?? "",
              gatedCommunityName: customer.gated_community_name ?? "",
              locality: customer.locality ?? ""
            })
          : "-"
      };
    })
    .sort((left, right) => {
      if (left.sequenceNumber && right.sequenceNumber) {
        return left.sequenceNumber - right.sequenceNumber;
      }

      if (left.sequenceNumber) {
        return -1;
      }

      if (right.sequenceNumber) {
        return 1;
      }

      const byPriority = left.routePriority - right.routePriority;

      if (byPriority !== 0) {
        return byPriority;
      }

      return left.deliveryArea.localeCompare(right.deliveryArea, "es");
    })
    .map((stop, index) => ({
      ...stop,
      sequenceNumber: stop.sequenceNumber ?? index + 1
    }));

  const pendingStops = routeStops.filter((stop) => stop.deliveryStatus === "pending").length;
  const inRouteStops = routeStops.filter((stop) => stop.deliveryStatus === "in_route").length;
  const deliveredStops = routeStops.filter((stop) => stop.deliveryStatus === "delivered").length;
  const failedStops = routeStops.filter((stop) => stop.deliveryStatus === "failed").length;

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Pantalla de repartidor
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Ruta del día y entregas en marcha
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Vista pensada para reparto: ver cada parada, los productos incluidos y marcar rápido si
            el pedido fue entregado o no.
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
            <p className="text-sm text-stone-400">No entregados</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300 sm:text-3xl">{failedStops}</p>
          </article>
        </div>

        <DriverRouteBoard stops={routeStops} />
      </section>
    </main>
  );
}
