import { DriverRouteBoard } from "@/components/driver-route-board";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLogisticsFlowGuidance,
  getLogisticsFlowLabel,
  getLogisticsFlowTone,
  inferLogisticsFlow
} from "@/lib/logistics";

type RelatedCustomer = {
  address?: string | null;
  delivery_notes?: string | null;
  full_name?: string | null;
  neighborhood?: string | null;
  phone?: string | null;
  zone?: string | null;
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
  neighborhood?: string | null;
  phone?: string | null;
  zone?: string | null;
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
  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `
        id,
        sales_channel,
        reseller_id,
        quantity_boxes,
        payment_method_expected,
        payment_status,
        status,
        delivery_date,
        zone,
        notes,
        created_at,
        customers (
          full_name,
          phone,
          address,
          neighborhood,
          zone,
          delivery_notes
        ),
        resellers (
          full_name,
          phone,
          neighborhood,
          zone
        ),
        deliveries (
          id,
          assigned_date,
          sequence_number,
          delivery_status,
          delivered_at,
          proof_note
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
      const flow = inferLogisticsFlow({
        address: customer?.address,
        neighborhood: customer?.neighborhood,
        resellerId: order.reseller_id,
        salesChannel: order.sales_channel,
        zone: order.zone || customer?.zone || reseller?.zone
      });

      return {
        customerName: customer?.full_name || "Cliente sin nombre",
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
        quantityBoxes: order.quantity_boxes,
        resellerName: reseller?.full_name || null,
        routePriority: routePriority(flow),
        sequenceNumber: delivery?.sequence_number ?? null,
        zone:
          order.zone ||
          customer?.zone ||
          customer?.neighborhood ||
          reseller?.zone ||
          reseller?.neighborhood ||
          "-"
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

      return left.zone.localeCompare(right.zone, "es");
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
            Ruta del dia y entregas en marcha
          </h1>
          <p className="max-w-3xl text-base leading-7 text-stone-300">
            Vista pensada para tu papa o para quien reparte: ver las paradas, priorizar la salida
            y marcar rapido si cada pedido fue entregado o no.
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

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-stone-400">Uso rapido</p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                <p className="text-base font-semibold text-stone-50">1. Orden de salida</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Si ya existe secuencia, se respeta. Si no, la pantalla arma una ruta base
                  priorizando revendedoras, despues Capital Federal y despues el resto.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                <p className="text-base font-semibold text-stone-50">2. Estado por parada</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Cada pedido se puede pasar a `En reparto`, `Entregado` o `No entregado` sin
                  salir de la lista.
                </p>
              </div>
              <div className="rounded-2xl border border-stone-800 bg-stone-950/70 p-4">
                <p className="text-base font-semibold text-stone-50">3. Casos sensibles</p>
                <p className="mt-2 text-sm leading-6 text-stone-300">
                  Capital Federal queda marcado como caso de contacto previo. Revendedora queda
                  identificado como punto unico de entrega.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-stone-400">Ruta</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-50">Paradas operativas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
              Esta es la primera version operativa. Todavia no calcula mapas reales, pero ya le da
              al repartidor una lista clara, priorizada y accionable.
            </p>
          </article>
        </section>

        <DriverRouteBoard stops={routeStops} />
      </section>
    </main>
  );
}
