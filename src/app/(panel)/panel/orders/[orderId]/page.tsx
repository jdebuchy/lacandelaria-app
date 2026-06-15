import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentRegisterForm } from "@/components/payment-register-form";
import { PaymentVoidButton } from "@/components/payment-void-button";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { COLLECTION_ALLOWED_ROLES, PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import {
  canEditOrder,
  getDeliveryFailureReasonLabel,
  getDeliveryStatusLabel,
  getDeliveryTripStatusLabel,
  getOrderStatusLabel
} from "@/lib/delivery-trips";
import { formatItemsSummary } from "@/lib/products";
import {
  buildPaymentSummary,
  formatCurrency,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryStatus, ExpectedPaymentMethod, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";

type Params = {
  params: Promise<{
    orderId: string;
  }>;
};

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
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

type RelatedOrderItem = {
  product_name_snapshot: string;
  sales_unit_label_snapshot: string;
  quantity: number | string | null;
  product_variants?: {
    cash_price?: number | string | null;
    transfer_price?: number | string | null;
  } | Array<{
    cash_price?: number | string | null;
    transfer_price?: number | string | null;
  }> | null;
};

type RelatedPayment = {
  amount: number | string;
  id: string;
  method: PaymentMethod;
  received_at: string | null;
  reference: string | null;
  status: string;
  void_reason?: string | null;
  voided_at?: string | null;
};

type RelatedDelivery = {
  assigned_date?: string | null;
  delivered_at?: string | null;
  delivery_status?: DeliveryStatus | null;
  driver?: RelatedProfile | RelatedProfile[] | null;
  failure_reason?: string | null;
  proof_note?: string | null;
  sequence_number?: number | null;
};

type RelatedProfile = {
  email?: string | null;
  full_name?: string | null;
};

type ActivityDisplayRow = {
  actorName: string;
  action: string;
  createdAt: string;
  detail?: string | null;
  id: string;
};

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric"
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-AR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric"
  });
}

function formatActivityDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("day")}-${part("month")} ${part("hour")}:${part("minute")}`;
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return "-";
  }

  return `${start.slice(0, 5)} a ${end.slice(0, 5)}`;
}

function statusBadgeClass(status: OrderStatus | string) {
  switch (status) {
    case "pending_confirmation":
      return "border-amber-700 bg-amber-950/60 text-amber-300";
    case "confirmed":
      return "border-sky-700 bg-sky-950/60 text-sky-300";
    case "assigned":
      return "border-violet-700 bg-violet-950/60 text-violet-300";
    case "in_route":
      return "border-emerald-700 bg-emerald-950/60 text-emerald-300";
    case "delivered":
      return "border-stone-700 bg-stone-950/60 text-stone-300";
    case "cancelled":
      return "border-red-800 bg-red-950/60 text-red-400";
    default:
      return "border-stone-700 bg-stone-900 text-stone-400";
  }
}

function paymentBadgeClass(status: PaymentStatus | string) {
  switch (status) {
    case "paid":
      return "border-emerald-700 bg-emerald-950/60 text-emerald-300";
    case "partial":
      return "border-amber-700 bg-amber-950/60 text-amber-300";
    default:
      return "border-stone-700 bg-stone-950/60 text-stone-300";
  }
}

function calculateCashTotal(items: RelatedOrderItem[]) {
  return items.reduce((sum, item) => {
    const variant = takeSingleRelation(item.product_variants);
    return sum + Number(item.quantity ?? 0) * Number(variant?.cash_price ?? 0);
  }, 0);
}

function profileName(profile?: RelatedProfile | null) {
  return profile?.full_name || profile?.email || "Sistema";
}

function activityMetadata(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function activityAction(type: string, metadata: Record<string, unknown>) {
  switch (type) {
    case "order_created":
      return "creó el pedido";
    case "order_updated":
      return "editó el pedido";
    case "order_assigned_to_trip":
      return "asignó el pedido al viaje";
    case "order_trip_updated":
      return "actualizó el viaje del pedido";
    case "order_released_from_trip":
      return "quitó el pedido del viaje";
    case "order_delivery_updated":
      if (metadata.status === "delivered") {
        return "marcó el pedido como entregado";
      }

      if (metadata.status === "failed") {
        return "marcó el pedido como no entregado";
      }

      if (metadata.status === "in_route") {
        return "marcó el pedido en reparto";
      }

      return "actualizó la entrega";
    case "payment_received":
      return "registró un cobro";
    case "payment_voided":
      return "anuló un cobro";
    default:
      return "registró una actividad";
  }
}

function getChannelLabel(channel: string) {
  switch (channel) {
    case "public_form":
      return "Formulario";
    case "reseller":
      return "Revendedora";
    case "internal":
      return "Interno";
    case "whatsapp_ai":
      return "WhatsApp IA";
    case "instagram_ai":
      return "Instagram IA";
    default:
      return channel;
  }
}

export default async function OrderDetailPage(context: Params) {
  const auth = await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders");
  const { orderId } = await context.params;
  const supabase = createAdminClient();
  const [
    { data: order },
    { data: activeTripOrder },
    { data: tripRows },
    { data: activities }
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `
          id,
          sales_channel,
          items_count,
          total_amount,
          payment_method_expected,
          payment_status,
          status,
          delivery_date,
          delivery_window_start,
          delivery_window_end,
          delivery_area,
          notes,
          created_at,
          seller:profiles!orders_seller_user_id_fkey (
            full_name,
            email
          ),
          customers (
            first_name,
            last_name,
            phone,
            address_kind,
            address_line_1,
            address_line_2,
            gated_community_name,
            locality,
            delivery_area,
            delivery_notes
          ),
          resellers (
            full_name,
            phone
          ),
          deliveries (
            assigned_date,
            delivered_at,
            delivery_status,
            failure_reason,
            proof_note,
            sequence_number,
            driver:profiles!deliveries_driver_user_id_fkey (
              full_name,
              email
            )
          ),
          order_items (
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity,
            product_variants (
              cash_price,
              transfer_price
            )
          ),
          payments (
            id,
            amount,
            method,
            status,
            received_at,
            reference,
            voided_at,
            void_reason
          )
        `
      )
      .eq("id", orderId)
      .single(),
    supabase
      .from("delivery_trip_orders")
      .select("delivery_trip_id")
      .eq("order_id", orderId)
      .is("released_at", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("delivery_trip_orders")
      .select(
        `
          id,
          delivery_trip_id,
          sequence_number,
          stop_status,
          stop_failure_reason,
          stop_note,
          resolved_at,
          released_at,
          created_at,
          delivery_trips (
            id,
            scheduled_date,
            status,
            started_at,
            completed_at,
            created_by:profiles!delivery_trips_created_by_user_id_fkey (
              full_name,
              email
            )
          )
        `
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_activities")
      .select(
        `
          id,
          activity_type,
          summary,
          metadata,
          created_at,
          actor:profiles!order_activities_actor_user_id_fkey (
            full_name,
            email
          )
        `
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
  ]);

  if (!order) {
    notFound();
  }

  const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
  const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
  const delivery = takeSingleRelation<RelatedDelivery>(order.deliveries ?? null);
  const items = (order.order_items ?? []) as RelatedOrderItem[];
  const itemSummaryRows = items.map((item) => ({
    product_name_snapshot: item.product_name_snapshot,
    quantity: Number(item.quantity ?? 0),
    sales_unit_label_snapshot: item.sales_unit_label_snapshot
  }));
  const payments = ((order.payments ?? []) as RelatedPayment[]).sort((a, b) =>
    String(b.received_at ?? "").localeCompare(String(a.received_at ?? ""))
  );
  const receivedPayments = payments.filter((payment) => payment.status === "received");
  const paidAmount = receivedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const paymentSummary = buildPaymentSummary(Number(order.total_amount ?? 0), paidAmount);
  const paymentMethodExpected = order.payment_method_expected as ExpectedPaymentMethod;
  const cashSummary = buildPaymentSummary(
    paymentMethodExpected === "unknown" ? calculateCashTotal(items) : Number(order.total_amount ?? 0),
    paidAmount
  );
  const customerName = customer
    ? formatPersonName(customer.first_name, customer.last_name)
    : reseller?.full_name || "Cliente sin nombre";
  const customerPhone = customer?.phone || reseller?.phone || "-";
  const addressSummary = customer
    ? formatStructuredAddressSummary({
        addressKind: customer.address_kind ?? "standard",
        addressLine1: customer.address_line_1 ?? "",
        addressLine2: customer.address_line_2 ?? "",
        gatedCommunityName: customer.gated_community_name ?? "",
        locality: customer.locality ?? ""
      })
    : "-";
  const orderStatus = order.status as OrderStatus;
  const orderIsEditable = canEditOrder(orderStatus, Boolean(activeTripOrder?.delivery_trip_id));
  const canManagePayments = COLLECTION_ALLOWED_ROLES.includes(auth.profile.role);
  const activityRows = (activities ?? []).map((activity) => {
    const actor = takeSingleRelation<RelatedProfile>(activity.actor ?? null);
    const metadata = activityMetadata(activity.metadata);

    return {
      actorName: profileName(actor),
      action: activityAction(activity.activity_type, metadata),
      createdAt: activity.created_at,
      detail: activity.summary,
      id: activity.id
    } satisfies ActivityDisplayRow;
  });
  const hasOrderCreatedActivity = activityRows.some((activity) => activity.action === "creó el pedido");
  const syntheticActivities: ActivityDisplayRow[] = [];
  const seller = takeSingleRelation<RelatedProfile>(order.seller ?? null);

  if (!hasOrderCreatedActivity) {
    syntheticActivities.push({
      actorName: profileName(seller),
      action: "creó el pedido",
      createdAt: order.created_at,
      id: `synthetic-created-${order.id}`
    });
  }

  const hasTripAssignmentActivity = activityRows.some((activity) => activity.action === "asignó el pedido al viaje");

  if (!hasTripAssignmentActivity) {
    for (const row of tripRows ?? []) {
      const trip = takeSingleRelation(row.delivery_trips);
      const createdBy = takeSingleRelation<RelatedProfile>(trip?.created_by ?? null);

      syntheticActivities.push({
        actorName: profileName(createdBy),
        action: "asignó el pedido al viaje",
        createdAt: row.created_at,
        detail: `Viaje ${String(row.delivery_trip_id).slice(0, 8)}`,
        id: `synthetic-trip-${row.id}`
      });
    }
  }

  const hasDeliveryActivity = activityRows.some(
    (activity) =>
      activity.action === "marcó el pedido como entregado" ||
      activity.action === "marcó el pedido como no entregado"
  );

  if (!hasDeliveryActivity && delivery?.delivery_status === "delivered" && delivery.delivered_at) {
    const driver = takeSingleRelation<RelatedProfile>(delivery.driver ?? null);

    syntheticActivities.push({
      actorName: profileName(driver),
      action: "marcó el pedido como entregado",
      createdAt: delivery.delivered_at,
      detail: delivery.proof_note || null,
      id: `synthetic-delivered-${order.id}`
    });
  }

  if (!hasDeliveryActivity && delivery?.delivery_status === "failed") {
    const driver = takeSingleRelation<RelatedProfile>(delivery.driver ?? null);
    const failedTripRow = (tripRows ?? []).find((row) => row.stop_status === "failed");

    syntheticActivities.push({
      actorName: profileName(driver),
      action: "marcó el pedido como no entregado",
      createdAt: failedTripRow?.resolved_at || order.created_at,
      detail: delivery.failure_reason ? getDeliveryFailureReasonLabel(delivery.failure_reason) : null,
      id: `synthetic-failed-${order.id}`
    });
  }

  const displayedActivities = [...activityRows, ...syntheticActivities].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/panel/orders" className="text-sm text-stone-400 transition hover:text-stone-100">
              Pedidos
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              {customerName}
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              {formatWhatsAppPhone(customerPhone)} · {getChannelLabel(order.sales_channel)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {orderIsEditable ? (
              <Link
                href={`/panel/orders/${order.id}/edit`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
              >
                Editar pedido
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Pedido</p>
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm ${statusBadgeClass(orderStatus)}`}>
              {getOrderStatusLabel(orderStatus)}
            </span>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cobro</p>
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm ${paymentBadgeClass(paymentSummary.paymentStatus)}`}>
              {getPaymentStatusLabel(paymentSummary.paymentStatus)}
            </span>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Total</p>
            <p className="mt-3 text-2xl font-semibold text-stone-50">{formatCurrency(paymentSummary.totalAmount)}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Saldo</p>
            <p className="mt-3 text-2xl font-semibold text-amber-300">{formatCurrency(paymentSummary.balanceAmount)}</p>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="grid gap-6">
            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <h2 className="text-lg font-semibold text-stone-50">Detalle</h2>
              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-stone-500">Productos</p>
                  <p className="mt-1 text-stone-100">{formatItemsSummary(itemSummaryRows)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Método esperado</p>
                  <p className="mt-1 text-stone-100">{getPaymentMethodLabel(paymentMethodExpected)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Fecha de entrega</p>
                  <p className="mt-1 text-stone-100">{formatDate(order.delivery_date)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Franja</p>
                  <p className="mt-1 text-stone-100">
                    {formatTimeRange(order.delivery_window_start, order.delivery_window_end)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-stone-500">Dirección</p>
                  <p className="mt-1 text-stone-100">{addressSummary}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-stone-500">Notas</p>
                  <p className="mt-1 whitespace-pre-wrap text-stone-100">{order.notes || "-"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-50">Cobros</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Cobrado {formatCurrency(paymentSummary.paidAmount)} de {formatCurrency(paymentSummary.totalAmount)}
                  </p>
                </div>
                <span className="text-sm text-amber-300">Saldo {formatCurrency(paymentSummary.balanceAmount)}</span>
              </div>

              {canManagePayments && paymentSummary.balanceAmount > 0 ? (
                <div className="mt-4">
                  <PaymentRegisterForm
                    balanceAmount={paymentSummary.balanceAmount}
                    cashBalanceAmount={cashSummary.balanceAmount}
                    defaultMethod={paymentMethodExpected}
                    orderId={order.id}
                    transferBalanceAmount={paymentSummary.balanceAmount}
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {payments.length ? (
                  payments.map((payment) => (
                    <article key={payment.id} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-stone-100">
                            {formatCurrency(Number(payment.amount ?? 0))} · {getPaymentMethodLabel(payment.method)}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {payment.status === "voided"
                              ? `Anulado ${formatDateTime(payment.voided_at)}`
                              : formatDateTime(payment.received_at)}
                          </p>
                          {payment.reference ? (
                            <p className="mt-2 text-sm text-stone-400">{payment.reference}</p>
                          ) : null}
                          {payment.void_reason ? (
                            <p className="mt-2 text-sm text-rose-300">{payment.void_reason}</p>
                          ) : null}
                        </div>
                        {canManagePayments && payment.status === "received" ? (
                          <PaymentVoidButton
                            amount={Number(payment.amount ?? 0)}
                            method={payment.method}
                            paymentId={payment.id}
                            receivedAt={formatDateTime(payment.received_at)}
                          />
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-stone-800 px-4 py-6 text-sm text-stone-500">
                    No hay cobros registrados.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="grid content-start gap-6">
            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <h2 className="text-lg font-semibold text-stone-50">Logística</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="rounded-2xl bg-stone-950/70 p-3">
                  <p className="text-stone-500">Entrega</p>
                  <p className="mt-1 text-stone-100">
                    {delivery?.delivery_status ? getDeliveryStatusLabel(delivery.delivery_status) : "-"}
                  </p>
                  {delivery?.failure_reason ? (
                    <p className="mt-1 text-xs text-rose-300">
                      {getDeliveryFailureReasonLabel(delivery.failure_reason)}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-stone-950/70 p-3">
                  <p className="text-stone-500">Asignada</p>
                  <p className="mt-1 text-stone-100">{formatDate(delivery?.assigned_date)}</p>
                </div>
                <div className="rounded-2xl bg-stone-950/70 p-3">
                  <p className="text-stone-500">Entregada</p>
                  <p className="mt-1 text-stone-100">{formatDateTime(delivery?.delivered_at)}</p>
                </div>
                {delivery?.proof_note ? (
                  <div className="rounded-2xl bg-stone-950/70 p-3">
                    <p className="text-stone-500">Nota de entrega</p>
                    <p className="mt-1 text-stone-100">{delivery.proof_note}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3">
                {(tripRows ?? []).length ? (
                  (tripRows ?? []).map((row) => {
                    const trip = takeSingleRelation(row.delivery_trips);
                    return (
                      <article key={row.id} className="rounded-2xl border border-stone-800 bg-stone-950/70 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-stone-100">
                              Viaje {String(row.delivery_trip_id).slice(0, 8)}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {trip ? `${formatDate(trip.scheduled_date)} · ${getDeliveryTripStatusLabel(trip.status)}` : "-"}
                            </p>
                          </div>
                          {!row.released_at ? (
                            <Link
                              href={`/panel/logistics/delivery/${row.delivery_trip_id}`}
                              className="text-xs text-sky-400 transition hover:text-sky-300"
                            >
                              Ver
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-stone-400">
                          Parada {row.sequence_number}
                          {row.stop_status ? ` · ${getDeliveryStatusLabel(row.stop_status)}` : ""}
                        </p>
                        {row.released_at ? (
                          <p className="mt-2 text-xs text-amber-300">
                            Liberado {formatDateTime(row.released_at)}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-dashed border-stone-800 px-4 py-6 text-sm text-stone-500">
                    Sin viajes asociados.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
              <h2 className="text-lg font-semibold text-stone-50">Actividad</h2>
              <div className="mt-5">
                {displayedActivities.length ? (
                  <ol className="divide-y divide-stone-800 overflow-hidden rounded-2xl border border-stone-800 bg-stone-950/70">
                    {displayedActivities.map((activity) => (
                      <li key={activity.id} className="px-3 py-3 text-sm">
                        <p className="text-stone-100">
                          <span className="font-mono text-xs text-stone-500">
                            {formatActivityDateTime(activity.createdAt)}
                          </span>{" "}
                          <span className="font-medium">{activity.actorName}</span>{" "}
                          <span>{activity.action}</span>
                        </p>
                        {activity.detail ? (
                          <p className="mt-1 pl-[5.8rem] text-xs text-stone-500">{activity.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-2xl border border-dashed border-stone-800 px-4 py-6 text-sm text-stone-500">
                    Todavía no hay actividades registradas para este pedido.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
