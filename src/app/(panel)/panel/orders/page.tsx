import { Suspense } from "react";
import Link from "next/link";
import { OrderSearch } from "@/components/order-search";
import { OrderFilters } from "@/components/order-filters";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { canEditOrder, getOrderStatusLabel } from "@/lib/delivery-trips";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { formatOrderNumber, formatTripNumber, matchesOrderNumberQuery } from "@/lib/orders";
import { formatItemsSummary } from "@/lib/products";
import { buildPaymentSummary, formatCurrency } from "@/lib/payments";
import { matchesNormalizedSearchValues } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

type SearchParams = Promise<{ page?: string; q?: string; status?: string }>;

const ORDERS_PAGE_SIZE = 50;

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

function getDeliveryAreaLabel(area: string) {
  switch (area) {
    case "capital_federal":
      return "Cap. Federal";
    case "standard":
      return "GBA";
    case "pending_review":
      return "Sin zona";
    default:
      return area;
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "pending_confirmation":
      return "border-warn-line bg-warn-bg text-warn-fg";
    case "confirmed":
      return "border-info-line bg-info-bg text-info-fg";
    case "assigned":
      return "border-info-line bg-info-bg text-info-fg";
    case "in_route":
      return "border-accent bg-accent-soft text-accent";
    case "delivered":
      return "border-line bg-paper-muted text-ink-soft";
    case "cancelled":
      return "border-danger-line bg-danger-bg text-danger-fg";
    default:
      return "border-line bg-paper text-ink-soft";
  }
}

function normalizeSearchTerm(value?: string) {
  return value?.trim() ?? "";
}

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/orders");
  const { page, q, status: statusFilter } = await searchParams;
  const requestedPage = Number.parseInt(page ?? "1", 10) || 1;
  const normalizedQuery = normalizeSearchTerm(q);
  const safeQ = normalizedQuery ? normalizedQuery.replace(/[,()]/g, "") : "";
  const normalizedStatusFilter = statusFilter ?? "";
  const supabase = createAdminClient();
  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: inRouteOrders },
    { data: orders, error: ordersError },
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
          order_number,
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
      .order("order_number", { ascending: false }),
    supabase
      .from("delivery_trip_orders")
      .select("order_id, delivery_trip_id, delivery_trips ( trip_number )")
      .is("released_at", null)
  ]);

  const activeTripByOrderId = new Map(
    (activeTripOrders ?? []).map((row) => [
      row.order_id,
      {
        id: row.delivery_trip_id,
        number: takeSingleRelation<{ trip_number: number | null }>(row.delivery_trips ?? null)?.trip_number ?? null
      }
    ])
  );

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
      orderNumber: order.order_number,
      channel: order.sales_channel,
      created_at: order.created_at,
      customerName: customer
        ? formatPersonName(customer.first_name, customer.last_name)
        : reseller?.full_name || "Cliente sin nombre",
      customerFirstName: customer?.first_name ?? null,
      customerLastName: customer?.last_name ?? null,
      resellerName: reseller?.full_name ?? null,
      customerPhone: customer?.phone || reseller?.phone || "-",
      paidAmount: paymentSummary.paidAmount,
      paymentBalanceAmount: paymentSummary.balanceAmount,
      itemsSummary: formatItemsSummary(items),
      status: order.status,
      isEditable: canEditOrder(order.status, activeTripByOrderId.has(order.id)),
      trip: activeTripByOrderId.get(order.id) ?? null,
      totalAmount: paymentSummary.totalAmount,
      deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
      locality: customer?.locality ?? null
    };
  });

  const visibleOrderRows = orderRows.filter((order) => {
    const matchesSearch = safeQ
      ? matchesOrderNumberQuery(safeQ, order.orderNumber) ||
        matchesNormalizedSearchValues(
          [order.customerFirstName, order.customerLastName, order.customerName, order.resellerName, order.customerPhone],
          safeQ
        )
      : true;
    const matchesStatus = normalizedStatusFilter ? order.status === normalizedStatusFilter : true;
    return matchesSearch && matchesStatus;
  });

  // Lo accionable: pedidos ya confirmados que todavia no entraron a ningun viaje.
  const awaitingTripCount = orderRows.filter(
    (order) => order.status === "confirmed" && !order.trip
  ).length;

  const totalPages = Math.max(1, Math.ceil(visibleOrderRows.length / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const pageStart = (currentPage - 1) * ORDERS_PAGE_SIZE;
  const pagedOrderRows = visibleOrderRows.slice(pageStart, pageStart + ORDERS_PAGE_SIZE);

  function buildPageHref(page: number) {
    const params = new URLSearchParams();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    if (normalizedStatusFilter) {
      params.set("status", normalizedStatusFilter);
    }

    if (page > 1) {
      params.set("page", String(page));
    }

    const query = params.toString();
    return query ? `/panel/orders?${query}` : "/panel/orders";
  }

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Pedidos
            </h1>
          </div>
          <Link
            href="/panel/orders/new"
            className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg transition hover:bg-accent"
          >
            Nuevo pedido
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Link
            href="/panel/orders?status=confirmed"
            className="rounded-card border border-line bg-paper p-5 transition hover:border-line"
          >
            <p className="text-sm text-ink-soft">Esperando viaje</p>
            <p className="mt-2 text-2xl font-semibold text-warn-fg sm:text-3xl">
              {awaitingTripCount}
            </p>
          </Link>
          <Link
            href="/panel/orders?status=in_route"
            className="rounded-card border border-line bg-paper p-5 transition hover:border-line"
          >
            <p className="text-sm text-ink-soft">En ruta</p>
            <p className="mt-2 text-2xl font-semibold text-accent sm:text-3xl">
              {inRouteOrders ?? 0}
            </p>
          </Link>
          <Link
            href="/panel/orders?status=pending_confirmation"
            className="rounded-card border border-line bg-paper p-5 transition hover:border-line"
          >
            <p className="text-sm text-ink-soft">A confirmar</p>
            <p className="mt-2 text-2xl font-semibold text-info-fg sm:text-3xl">
              {pendingOrders ?? 0}
            </p>
          </Link>
          <article className="rounded-card border border-line bg-paper p-5">
            <p className="text-sm text-ink-soft">Pedidos</p>
            <p className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
              {totalOrders ?? 0}
            </p>
          </article>
        </div>

        {ordersError ? (
          <div className="rounded-card border border-danger-line bg-danger-bg p-4 text-sm text-danger-fg">
            <p className="font-medium">No se pudieron cargar los pedidos.</p>
            <p className="mt-1 text-danger-fg">
              La lista de abajo está vacía por este error, no porque no haya pedidos.
            </p>
            <p className="mt-2 font-mono text-xs text-danger-fg">{ordersError.message}</p>
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Todos los pedidos</h2>
              <p className="mt-1 text-sm text-ink-faint">
                {visibleOrderRows.length} {normalizedQuery ? "resultado(s)" : "pedido(s)"}
              </p>
            </div>
            <Suspense>
              <OrderSearch defaultValue={normalizedQuery} />
            </Suspense>
          </div>

          <Suspense>
            <OrderFilters activeStatus={normalizedStatusFilter} />
          </Suspense>

          <div className="hidden overflow-hidden rounded-card border border-line bg-paper lg:block">
            <div className="grid grid-cols-[1.8fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] border-b border-line bg-paper px-4 py-3 text-xs uppercase tracking-[0.18em] text-ink-soft">
              <div>Cliente</div>
              <div>Área</div>
              <div>Estado</div>
              <div>Ítems</div>
              <div>Total</div>
              <div>Alta</div>
              <div></div>
            </div>
            {pagedOrderRows.length ? (
              pagedOrderRows.map((order) => (
                <div
                  key={order.id}
                  className="relative grid grid-cols-[1.8fr_1fr_1fr_1.5fr_0.9fr_0.8fr_0.8fr] cursor-pointer border-b border-line px-4 py-4 text-sm text-ink-soft last:border-b-0 hover:bg-paper"
                >
                  <Link
                    href={`/panel/orders/${order.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Ver pedido de ${order.customerName}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-ink-faint">
                        {formatOrderNumber(order.orderNumber)}
                      </span>
                      <p className="font-medium text-ink">{order.customerName}</p>
                      {order.channel !== "internal" && (
                        <span className="rounded-control border border-line px-2 py-0.5 text-xs text-ink-soft">
                          {getChannelLabel(order.channel)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                      {formatWhatsAppPhone(order.customerPhone)}
                    </p>
                  </div>
                  <div>
                    <p>{getDeliveryAreaLabel(order.deliveryArea)}</p>
                    {order.locality && (
                      <p className="mt-0.5 truncate text-xs text-ink-faint">{order.locality}</p>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                      {getOrderStatusLabel(order.status)}
                    </span>
                    {order.trip && (
                      <Link
                        href={`/panel/logistics/delivery/${order.trip.id}`}
                        className="relative z-10 mt-1.5 inline-block text-xs text-info-fg hover:text-info-fg"
                      >
                        {formatTripNumber(order.trip.number)}
                      </Link>
                    )}
                  </div>
                  <div className="line-clamp-2">{order.itemsSummary}</div>
                  <div>
                    <p>{formatCurrency(order.totalAmount)}</p>
                    {order.paidAmount > 0 && (
                      <>
                        <p className="mt-1 text-xs text-ink-faint">
                          Cobrado {formatCurrency(order.paidAmount)}
                        </p>
                        {order.paymentBalanceAmount > 0 && (
                          <p className="mt-1 text-xs text-warn-fg">
                            Saldo {formatCurrency(order.paymentBalanceAmount)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div>{formatDate(order.created_at)}</div>
                  <div className="relative z-10 flex justify-end">
                    {order.isEditable ? (
                      <Link
                        href={`/panel/orders/${order.id}/edit`}
                        className="inline-flex h-9 items-center justify-center rounded-control border border-line px-3 text-xs font-medium text-ink transition hover:border-line-strong hover:text-ink"
                      >
                        Editar
                      </Link>
                    ) : (
                      <Link
                        href={`/panel/orders/${order.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-control border border-line px-3 text-xs font-medium text-ink-soft transition hover:border-line hover:text-ink"
                      >
                        Ver
                      </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-ink-faint">
                {ordersError
                  ? "No se pudo cargar la lista."
                  : normalizedQuery
                    ? "No hay pedidos para esa búsqueda."
                    : "Todavia no hay pedidos cargados."}
              </div>
            )}
          </div>

          <div className="grid gap-3 lg:hidden">
            {pagedOrderRows.length ? (
              pagedOrderRows.map((order) => (
                <article key={order.id} className="rounded-card border border-line bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-ink-faint">
                        {formatOrderNumber(order.orderNumber)}
                      </p>
                      <p className="text-base font-semibold text-ink">{order.customerName}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {formatWhatsAppPhone(order.customerPhone)}
                      </p>
                    </div>
                    <span className="rounded-control border border-line bg-paper-muted px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-soft">
                      {getChannelLabel(order.channel)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="rounded-card bg-paper-muted p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Estado</p>
                      <div className="mt-1">
                        <span className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.trip && (
                        <Link
                          href={`/panel/logistics/delivery/${order.trip.id}`}
                          className="mt-1 inline-block text-xs text-info-fg hover:text-info-fg"
                        >
                          {formatTripNumber(order.trip.number)}
                        </Link>
                      )}
                    </div>
                    <div className="rounded-card bg-paper-muted p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Ítems</p>
                      <p className="mt-1 text-ink">{order.itemsSummary}</p>
                    </div>
                    <div className="rounded-card bg-paper-muted p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Total</p>
                      <p className="mt-1 text-ink">{formatCurrency(order.totalAmount)}</p>
                      {order.paidAmount > 0 && (
                        <p className="mt-1 text-xs text-ink-faint">
                          Cobrado {formatCurrency(order.paidAmount)} · Saldo{" "}
                          {formatCurrency(order.paymentBalanceAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/panel/orders/${order.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-control border border-line px-4 text-sm text-ink transition hover:border-line-strong hover:text-ink"
                    >
                      Ver pedido
                    </Link>
                    {order.isEditable ? (
                      <Link
                        href={`/panel/orders/${order.id}/edit`}
                        className="inline-flex h-10 items-center justify-center rounded-control border border-line px-4 text-sm text-ink transition hover:border-line-strong hover:text-ink"
                      >
                        Editar pedido
                      </Link>
                    ) : (
                      <span className="inline-flex h-10 items-center justify-center rounded-control border border-line px-4 text-sm text-ink-faint">
                        Pedido bloqueado
                      </span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-card border border-dashed border-line bg-paper px-4 py-8 text-center text-sm text-ink-faint">
                {ordersError
                  ? "No se pudo cargar la lista."
                  : normalizedQuery
                    ? "No hay pedidos para esa búsqueda."
                    : "Todavia no hay pedidos cargados."}
              </div>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-ink-faint">
                {pageStart + 1}–{pageStart + pagedOrderRows.length} de {visibleOrderRows.length}
              </p>
              <div className="flex gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={buildPageHref(currentPage - 1)}
                    className="inline-flex h-10 items-center justify-center rounded-control border border-line px-4 text-ink transition hover:border-line-strong"
                  >
                    Anteriores
                  </Link>
                ) : null}
                {currentPage < totalPages ? (
                  <Link
                    href={buildPageHref(currentPage + 1)}
                    className="inline-flex h-10 items-center justify-center rounded-control border border-line px-4 text-ink transition hover:border-line-strong"
                  >
                    Siguientes
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
