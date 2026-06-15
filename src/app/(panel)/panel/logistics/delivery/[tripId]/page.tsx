import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryTripCompleteButton } from "@/components/delivery-trip-complete-button";
import {
  DeliveryTripExecutionTable,
  type DeliveryExecutionStop
} from "@/components/delivery-trip-execution-table";
import { DeliveryTripStartButton } from "@/components/delivery-trip-start-button";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { DRIVER_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import {
  getDeliveryFailureReasonLabel,
  getDeliveryTripStatusLabel
} from "@/lib/delivery-trips";
import { formatCurrency } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryFailureReason, DeliveryStatus } from "@/lib/types";

type Params = {
  params: Promise<{
    tripId: string;
  }>;
};

type TripOrderRow = {
  id: string;
  order_id: string;
  released_at: string | null;
  resolved_at: string | null;
  sequence_number: number;
  stop_failure_reason: DeliveryFailureReason | null;
  stop_note: string | null;
  stop_status: DeliveryStatus | null;
};

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  administrative_area_level_1?: string | null;
  delivery_area?: string | null;
  delivery_notes?: string | null;
  first_name?: string | null;
  gated_community_name?: string | null;
  last_name?: string | null;
  locality?: string | null;
  phone?: string | null;
};

type RelatedReseller = {
  full_name?: string | null;
  phone?: string | null;
};

type RelatedDelivery = {
  delivery_status?: DeliveryStatus | null;
  failure_reason?: DeliveryFailureReason | null;
  proof_note?: string | null;
};

type RelatedPayment = {
  amount: number | string;
  status: string;
};

type RelatedOrderItem = {
  quantity: number | string | null;
  product_variants?: {
    cash_price?: number | string | null;
  } | Array<{
    cash_price?: number | string | null;
  }> | null;
};

type OrderRow = {
  customers?: RelatedCustomer | RelatedCustomer[] | null;
  deliveries?: RelatedDelivery | RelatedDelivery[] | null;
  id: string;
  payment_method_expected: string;
  payment_status: string;
  resellers?: RelatedReseller | RelatedReseller[] | null;
  status: string;
  total_amount?: number | string | null;
  payments?: RelatedPayment[] | null;
  order_items?: RelatedOrderItem[] | null;
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sin registrar";
  }

  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function getEffectiveStopStatus(row: TripOrderRow, order: OrderRow | undefined) {
  if (row.released_at) {
    return row.stop_status ?? "failed";
  }

  const delivery = takeSingleRelation(order?.deliveries);
  return delivery?.delivery_status ?? row.stop_status ?? "pending";
}

function calculateCashTotal(items: RelatedOrderItem[] | null | undefined) {
  return (items ?? []).reduce((sum, item) => {
    const variant = takeSingleRelation(item.product_variants);
    return sum + Number(item.quantity ?? 0) * Number(variant?.cash_price ?? 0);
  }, 0);
}

export default async function DeliveryTripExecutionPage(context: Params) {
  const auth = await requirePageRole(DRIVER_ALLOWED_ROLES, "/panel/logistics/delivery");
  const { tripId } = await context.params;
  const supabase = createAdminClient();
  const { data: trip, error: tripError } = await supabase
    .from("delivery_trips")
    .select("id, driver_user_id, scheduled_date, status, started_at, completed_at, notes, created_at")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    notFound();
  }

  if (auth.profile.role === "driver" && trip.driver_user_id && trip.driver_user_id !== auth.profile.id) {
    notFound();
  }

  const [{ data: tripOrders }, { data: driverProfile }] = await Promise.all([
    supabase
      .from("delivery_trip_orders")
      .select(
        "id, order_id, released_at, resolved_at, sequence_number, stop_status, stop_failure_reason, stop_note"
      )
      .eq("delivery_trip_id", tripId)
      .order("sequence_number", { ascending: true }),
    trip.driver_user_id
      ? supabase.from("profiles").select("id, full_name").eq("id", trip.driver_user_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const orderIds = (tripOrders ?? []).map((item: TripOrderRow) => item.order_id);
  const { data: orders } = orderIds.length
    ? await supabase
        .from("orders")
        .select(
          `
            id,
            status,
            total_amount,
            payment_method_expected,
            payment_status,
            delivery_area,
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
              failure_reason,
              proof_note
            ),
            payments (
              amount,
              status
            ),
            order_items (
              quantity,
              product_variants (
                cash_price
              )
            )
          `
        )
        .in("id", orderIds)
    : { data: [] };

  const orderById = new Map((orders ?? []).map((order: OrderRow) => [order.id, order]));
  const stops: DeliveryExecutionStop[] = ((tripOrders ?? []) as TripOrderRow[])
    .map((row) => {
      const order = orderById.get(row.order_id);

      if (!order) {
        return null;
      }

      const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
      const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
      const delivery = takeSingleRelation<RelatedDelivery>(order.deliveries ?? null);
      const payments = ((order.payments ?? []) as RelatedPayment[]).filter(
        (payment) => payment.status === "received"
      );
      const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const totalAmount = Number(order.total_amount ?? 0);
      const cashTotalAmount =
        order.payment_method_expected === "unknown"
          ? calculateCashTotal(order.order_items ?? [])
          : totalAmount;

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
        deliveryFailureReason: row.released_at
          ? row.stop_failure_reason ?? null
          : delivery?.failure_reason ?? row.stop_failure_reason ?? null,
        deliveryStatus: getEffectiveStopStatus(row, order),
        id: order.id,
        notes: row.released_at
          ? row.stop_note ?? null
          : delivery?.proof_note || row.stop_note || customer?.delivery_notes || null,
        orderStatus: order.status,
        paidAmount,
        cashPaymentBalanceAmount: Math.max(0, cashTotalAmount - paidAmount),
        paymentBalanceAmount: Math.max(0, totalAmount - paidAmount),
        paymentMethodExpected: order.payment_method_expected,
        paymentStatus: order.payment_status,
        sequenceNumber: row.sequence_number,
        totalAmount
      } satisfies DeliveryExecutionStop;
    })
    .filter((stop): stop is DeliveryExecutionStop => Boolean(stop));

  const deliveredCount = stops.filter((stop) => stop.deliveryStatus === "delivered").length;
  const failedCount = stops.filter((stop) => stop.deliveryStatus === "failed").length;
  const pendingCount = stops.filter(
    (stop) => stop.deliveryStatus === "pending" || stop.deliveryStatus === "in_route"
  ).length;
  const totalCollected = stops.reduce((sum, stop) => sum + stop.paidAmount, 0);
  const reasonsCount = new Map<string, number>();
  const driverName = driverProfile?.full_name || "Sin repartidor asignado";

  for (const stop of stops) {
    if (!stop.deliveryFailureReason) {
      continue;
    }

    reasonsCount.set(stop.deliveryFailureReason, (reasonsCount.get(stop.deliveryFailureReason) ?? 0) + 1);
  }

  const reasonSummary = Array.from(reasonsCount.entries()).sort((left, right) => right[1] - left[1]);

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/panel/logistics/delivery" className="text-stone-400 transition hover:text-stone-100">
            Volver a delivery
          </Link>
          <span className="text-stone-700">/</span>
          <Link href="/panel/logistics" className="text-stone-400 transition hover:text-stone-100">
            Iniciar nuevo viaje
          </Link>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Viaje {trip.id.slice(0, 8)}
              </h1>
              <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
                {getDeliveryTripStatusLabel(trip.status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-stone-400">
              <span>{formatDate(trip.scheduled_date)}</span>
              <span>{driverName}</span>
              <span>{stops.length} pedidos</span>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {trip.status === "assigned" ? (
              <DeliveryTripStartButton tripId={trip.id} label="Iniciar reparto" />
            ) : null}
            {trip.status === "in_route" ? <DeliveryTripCompleteButton tripId={trip.id} /> : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Total pedidos</p>
            <p className="mt-2 text-3xl font-semibold text-stone-50">{stops.length}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Entregados</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-300">{deliveredCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">No entregados</p>
            <p className="mt-2 text-3xl font-semibold text-rose-300">{failedCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Pendientes</p>
            <p className="mt-2 text-3xl font-semibold text-amber-300">{pendingCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <p className="text-sm text-stone-400">Total cobrado</p>
            <p className="mt-2 text-3xl font-semibold text-stone-50">{formatCurrency(totalCollected)}</p>
          </article>
        </div>

        {!stops.length ? (
          <section className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 px-6 py-10">
            <h2 className="text-lg font-semibold text-stone-50">Viaje sin pedidos asociados</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
              Este viaje existe en la base pero no tiene filas activas ni históricas en la secuencia de
              pedidos. Por eso no aparece nada para operar o auditar desde esta pantalla.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/panel/logistics/delivery"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500"
              >
                Volver a delivery
              </Link>
              {trip.status === "assigned" ? (
                <Link
                  href={`/panel/logistics/${trip.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-stone-100 px-4 text-sm font-medium text-stone-950 transition hover:bg-white"
                >
                  Abrir planificación
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {stops.length ? (
          <>
            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-stone-50">Progreso del viaje</h2>
                  <p className="mt-1 text-sm text-stone-400">
                    {deliveredCount + failedCount} de {stops.length} paradas resueltas
                  </p>
                </div>
                <p className="text-sm text-stone-400">
                  Salida {formatDateTime(trip.started_at)} · Cierre {formatDateTime(trip.completed_at)}
                </p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-950">
                <div
                  className="h-full rounded-full bg-stone-100 transition"
                  style={{
                    width: `${stops.length ? ((deliveredCount + failedCount) / stops.length) * 100 : 0}%`
                  }}
                />
              </div>
              {trip.notes ? <p className="mt-4 text-sm text-stone-300">{trip.notes}</p> : null}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <DeliveryTripExecutionTable
                canManage={auth.profile.role === "admin" || auth.profile.role === "driver"}
                stops={stops}
                tripId={trip.id}
                tripStatus={trip.status}
              />

              <aside className="grid gap-4">
                <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-stone-50">Incidencias del viaje</h2>
                    <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
                      {failedCount}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {stops.filter((stop) => stop.deliveryStatus === "failed").length ? (
                      stops
                        .filter((stop) => stop.deliveryStatus === "failed")
                        .map((stop) => (
                          <article key={stop.id} className="rounded-2xl border border-stone-800 bg-stone-950/80 p-3">
                            <p className="text-sm font-medium text-stone-100">{stop.customerName}</p>
                            <p className="mt-1 text-xs text-rose-300">
                              {getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}
                            </p>
                            {stop.notes ? <p className="mt-2 text-xs text-stone-400">{stop.notes}</p> : null}
                          </article>
                        ))
                    ) : (
                      <p className="text-sm text-stone-400">Todavia no hay incidencias registradas.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
                  <h2 className="text-base font-semibold text-stone-50">Motivos frecuentes</h2>
                  <div className="mt-4 grid gap-2">
                    {reasonSummary.length ? (
                      reasonSummary.map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-stone-300">{getDeliveryFailureReasonLabel(reason)}</span>
                          <span className="rounded-full bg-stone-950 px-2.5 py-1 text-xs text-stone-400">
                            {count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-stone-400">Sin motivos cargados.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
                  <h2 className="text-base font-semibold text-stone-50">Informacion del viaje</h2>
                  <div className="mt-4 grid gap-3 text-sm text-stone-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-stone-500">Programado</span>
                      <span>{formatDate(trip.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-stone-500">Repartidor</span>
                      <span>{driverName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-stone-500">Estado</span>
                      <span>{getDeliveryTripStatusLabel(trip.status)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-stone-500">Creado</span>
                      <span>{formatDateTime(trip.created_at)}</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
