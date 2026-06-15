import { Suspense } from "react";
import Link from "next/link";
import { OrderSearch } from "@/components/order-search";
import { formatStructuredAddressSummary } from "@/lib/address";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { canEditOrder, getOrderStatusLabel } from "@/lib/delivery-trips";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { formatItemsSummary } from "@/lib/products";
import {
  buildPaymentSummary,
  formatCurrency,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} from "@/lib/payments";
import { matchesNormalizedSearchValues } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{ q?: string }>;

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
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

type RelatedPayment = {
  amount: number | string;
  status: string;
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

function normalizeSearchTerm(value?: string) {
  return value?.trim() ?? "";
}

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders");
  const { q } = await searchParams;
  const normalizedQuery = normalizeSearchTerm(q);
  const safeQ = normalizedQuery ? normalizedQuery.replace(/[,()]/g, "") : "";
  const supabase = createAdminClient();
  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: inRouteOrders },
    { data: orders },
    { data: activeTripOrders }
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_confirmation"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "in_route"),
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
          delivery_area,
          notes,
          created_at,
          customers (
            first_name,
            last_name,
            phone,
            address_kind,
            address_line_1,
            gated_community_name,
            locality,
            delivery_area
          ),
          resellers (
            full_name,
            phone
          ),
          order_items (
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity
          ),
          payments (
            amount,
            status
          )
        `
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_trip_orders")
      .select("order_id, delivery_trip_id")
      .is("released_at", null)
  ]);

  const activeTripByOrderId = new Map((activeTripOrders ?? []).map((row) => [row.order_id, row.delivery_trip_id]));

  const orderRows = (orders ?? []).map((order) => {
    const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
    const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
    const items = (order.order_items ?? []) as RelatedOrderItem[];
    const payments = ((order.payments ?? []) as RelatedPayment[]).filter(
      (payment) => payment.status === "received"
    );
    const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const paymentSummary = buildPaymentSummary(Number(order.total_amount ?? 0), paidAmount);

    return {
      id: order.id,
      channel: order.sales_channel,
      created_at: order.created_at,
      customerName: customer
        ? formatPersonName(customer.first_name, customer.last_name)
        : reseller?.full_name || "Cliente sin nombre",
      customerFirstName: customer?.first_name ?? null,
      customerLastName: customer?.last_name ?? null,
      resellerName: reseller?.full_name ?? null,
      customerPhone: customer?.phone || reseller?.phone || "-",
      deliveryDate: order.delivery_date,
      notes: order.notes,
      paymentMethodExpected: order.payment_method_expected,
      paymentStatus: paymentSummary.paymentStatus,
      paidAmount: paymentSummary.paidAmount,
      paymentBalanceAmount: paymentSummary.balanceAmount,
      itemsCount: Number(order.items_count ?? 0),
      itemsSummary: formatItemsSummary(items),
      status: order.status,
      isEditable: canEditOrder(order.status, activeTripByOrderId.has(order.id)),
      tripId: activeTripByOrderId.get(order.id) ?? null,
      totalAmount: paymentSummary.totalAmount,
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
  });

  const visibleOrderRows = safeQ
    ? orderRows.filter((order) =>
        matchesNormalizedSearchValues(
          [
            order.customerFirstName,
            order.customerLastName,
            order.customerName,
            order.resellerName,
            order.customerPhone
          ],
          safeQ
        )
      )
    : orderRows;

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
              Pedidos
            </h1>
          </div>
          <Link
            href="/panel/orders/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
          >
            Nuevo pedido
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pedidos</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300 sm:text-3xl">
              {totalOrders ?? 0}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-sky-300 sm:text-3xl">
              {pendingOrders ?? 0}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">En ruta</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300 sm:text-3xl">
              {inRouteOrders ?? 0}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Ítems cargados</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300 sm:text-3xl">
              {orderRows.reduce((sum, order) => sum + order.itemsCount, 0)}
            </p>
          </article>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-50">Todos los pedidos</h2>
              <p className="mt-1 text-sm text-stone-500">
                {visibleOrderRows.length} {normalizedQuery ? "resultado(s)" : "pedido(s)"}
              </p>
            </div>
            <Suspense>
              <OrderSearch defaultValue={normalizedQuery} />
            </Suspense>
          </div>

          <div className="hidden overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70 lg:block">
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr_0.7fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
              <div>Cliente</div>
              <div>Canal</div>
              <div>Área</div>
              <div>Estado</div>
              <div>Ítems</div>
              <div>Cant.</div>
              <div>Total</div>
              <div>Alta</div>
              <div></div>
            </div>
            {visibleOrderRows.length ? (
              visibleOrderRows.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr_0.7fr_0.9fr_0.8fr_0.8fr] border-b border-stone-800 px-4 py-4 text-sm text-stone-300 last:border-b-0 hover:bg-stone-900/50"
                >
                  <div>
                    <p className="font-medium text-stone-100">{order.customerName}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatWhatsAppPhone(order.customerPhone)}
                    </p>
                  </div>
                  <div>{getChannelLabel(order.channel)}</div>
                  <div>
                    <div>{order.deliveryArea}</div>
                    <div className="mt-1 text-xs text-stone-500">{order.addressSummary}</div>
                  </div>
                  <div>
                    <p>{getOrderStatusLabel(order.status)}</p>
                    {order.tripId ? (
                      <p className="mt-1 text-xs text-sky-300">Viaje {order.tripId.slice(0, 8)}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-stone-500">
                      {getPaymentStatusLabel(order.paymentStatus)} ·{" "}
                      {getPaymentMethodLabel(order.paymentMethodExpected)}
                    </p>
                  </div>
                  <div>{order.itemsSummary}</div>
                  <div>{order.itemsCount}</div>
                  <div>
                    <p>{formatCurrency(order.totalAmount)}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Cobrado {formatCurrency(order.paidAmount)}
                    </p>
                    <p className="mt-1 text-xs text-amber-300">
                      Saldo {formatCurrency(order.paymentBalanceAmount)}
                    </p>
                  </div>
                  <div>{formatDate(order.created_at)}</div>
                  <div className="flex justify-end">
                    {order.isEditable ? (
                      <Link
                        href={`/panel/orders/${order.id}/edit`}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-700 px-3 text-xs font-medium text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
                      >
                        Editar
                      </Link>
                    ) : (
                      <span className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-800 px-3 text-xs font-medium text-stone-500">
                        Bloqueado
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-stone-500">
                {normalizedQuery ? "No hay pedidos para esa búsqueda." : "Todavia no hay pedidos cargados."}
              </div>
            )}
          </div>

          <div className="grid gap-3 lg:hidden">
            {visibleOrderRows.length ? (
              visibleOrderRows.map((order) => (
                <article key={order.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-stone-50">{order.customerName}</p>
                      <p className="mt-1 text-sm text-stone-400">
                        {formatWhatsAppPhone(order.customerPhone)}
                      </p>
                    </div>
                    <span className="rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-stone-300">
                      {getChannelLabel(order.channel)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Estado</p>
                      <p className="mt-1 text-stone-200">{getOrderStatusLabel(order.status)}</p>
                      {order.tripId ? <p className="mt-1 text-xs text-sky-300">Viaje {order.tripId.slice(0, 8)}</p> : null}
                    </div>
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Ítems</p>
                      <p className="mt-1 text-stone-200">{order.itemsSummary}</p>
                    </div>
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Total</p>
                      <p className="mt-1 text-stone-200">{formatCurrency(order.totalAmount)}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        Cobrado {formatCurrency(order.paidAmount)} · Saldo{" "}
                        {formatCurrency(order.paymentBalanceAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    {order.isEditable ? (
                      <Link
                        href={`/panel/orders/${order.id}/edit`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
                      >
                        Editar pedido
                      </Link>
                    ) : (
                      <span className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-800 px-4 text-sm text-stone-500">
                        Pedido bloqueado
                      </span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/70 px-4 py-8 text-center text-sm text-stone-500">
                {normalizedQuery ? "No hay pedidos para esa búsqueda." : "Todavia no hay pedidos cargados."}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
