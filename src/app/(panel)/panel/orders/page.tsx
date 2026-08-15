import { faInbox, faPlus } from "@fortawesome/pro-regular-svg-icons";
import Link from "next/link";
import { Suspense } from "react";
import { OrderFilters } from "@/components/order-filters";
import { OrderSearch } from "@/components/order-search";
import { Badge, ZoneStamp } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/card";
import { DataTable, Pagination, type Column } from "@/components/ui/data-table";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { canEditOrder, getOrderStatusLabel } from "@/lib/delivery-trips";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { formatOrderNumber, formatTripNumber, matchesOrderNumberQuery } from "@/lib/orders";
import { buildPaymentSummary } from "@/lib/payments";
import { formatItemsSummary } from "@/lib/products";
import { matchesNormalizedSearchValues } from "@/lib/search";
import { orderStatusTone } from "@/lib/status-tone";
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


  type OrderRow = (typeof orderRows)[number];

  const columns: Array<Column<OrderRow>> = [
    {
      cell: (order) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-meta text-ink-faint" data-numeric>
              {formatOrderNumber(order.orderNumber)}
            </span>
            <span className="truncate font-medium text-ink">{order.customerName}</span>
            {order.channel !== "internal" ? (
              <span className="shrink-0 text-meta text-ink-faint">
                {getChannelLabel(order.channel)}
              </span>
            ) : null}
          </div>
          <p className="truncate text-meta text-ink-faint" data-numeric>
            {formatWhatsAppPhone(order.customerPhone)}
          </p>
        </div>
      ),
      header: "Cliente",
      key: "cliente",
      primary: true,
      width: "2fr"
    },
    {
      cell: (order) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <ZoneStamp>{getDeliveryAreaLabel(order.deliveryArea)}</ZoneStamp>
          {order.locality ? (
            <span className="truncate text-meta text-ink-faint">{order.locality}</span>
          ) : null}
        </div>
      ),
      header: "Zona",
      key: "zona",
      width: "1fr"
    },
    {
      cell: (order) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Badge tone={orderStatusTone(order.status)}>{getOrderStatusLabel(order.status)}</Badge>
          {order.trip ? (
            <Link
              className="text-meta text-ink-faint underline underline-offset-2 hover:text-ink"
              href={`/panel/logistics/delivery/${order.trip.id}`}
            >
              {formatTripNumber(order.trip.number)}
            </Link>
          ) : null}
        </div>
      ),
      header: "Estado",
      interactive: true,
      key: "estado",
      width: "1fr"
    },
    {
      cell: (order) => <span className="line-clamp-2 text-ink-soft">{order.itemsSummary}</span>,
      header: "Ítems",
      hideOnMobile: true,
      key: "items",
      width: "1.6fr"
    },
    {
      align: "right",
      cell: (order) => (
        <div className="min-w-0">
          <p className="text-ink" data-numeric>
            {formatCurrency(order.totalAmount)}
          </p>
          {order.paymentBalanceAmount > 0 && order.paidAmount > 0 ? (
            <p className="text-meta text-warn-fg" data-numeric>
              Saldo {formatCurrency(order.paymentBalanceAmount)}
            </p>
          ) : null}
        </div>
      ),
      header: "Total",
      key: "total",
      width: "0.9fr"
    },
    {
      align: "right",
      cell: (order) => (
        <span className="text-ink-faint" data-numeric>
          {formatDateShort(order.created_at)}
        </span>
      ),
      header: "Alta",
      hideOnMobile: true,
      key: "alta",
      width: "0.6fr"
    },
    {
      align: "right",
      cell: (order) =>
        order.isEditable ? (
          <Link
            className="text-meta text-ink-faint underline underline-offset-2 hover:text-ink"
            href={`/panel/orders/${order.id}/edit`}
          >
            Editar
          </Link>
        ) : null,
      header: "",
      hideOnMobile: true,
      interactive: true,
      key: "acciones",
      width: "0.4fr"
    }
  ];

  return (
    <PageShell>
      <PageHeader
        action={
          <ButtonLink href="/panel/orders/new" icon={faPlus} variant="primary">
            Nuevo pedido
          </ButtonLink>
        }
        description={`${visibleOrderRows.length} ${normalizedQuery ? "resultados" : "pedidos"}`}
        title="Pedidos"
      />

      {/* El tono de cada metrica es el mismo que el del badge del estado que
          filtra. Antes no coincidian: "Esperando viaje" salia ambar arriba y
          celeste en la tabla de abajo, para el mismo estado. */}
      <MetricGrid>
        <MetricCard
          detail="Confirmados sin viaje"
          href="/panel/orders?status=confirmed"
          label="Esperando viaje"
          tone="warn"
          value={awaitingTripCount}
        />
        <MetricCard
          href="/panel/orders?status=in_route"
          label="En ruta"
          tone="info"
          value={inRouteOrders ?? 0}
        />
        <MetricCard
          href="/panel/orders?status=pending_confirmation"
          label="A confirmar"
          tone="warn"
          value={pendingOrders ?? 0}
        />
        <MetricCard href="/panel/orders" label="Total" value={totalOrders ?? 0} />
      </MetricGrid>

      {ordersError ? (
        <Notice tone="danger">
          No se pudieron cargar los pedidos, así que la lista de abajo está vacía por el error y no
          porque no haya pedidos. Detalle: {ordersError.message}
        </Notice>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Suspense>
            <OrderFilters activeStatus={normalizedStatusFilter} />
          </Suspense>
          <Suspense>
            <OrderSearch defaultValue={normalizedQuery} />
          </Suspense>
        </div>

        <DataTable
          columns={columns}
          empty={
            <EmptyState
              action={
                normalizedQuery || normalizedStatusFilter ? (
                  <ButtonLink href="/panel/orders" variant="secondary">
                    Ver todos los pedidos
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/panel/orders/new" icon={faPlus} variant="primary">
                    Nuevo pedido
                  </ButtonLink>
                )
              }
              description={
                ordersError
                  ? "Revisá el detalle del error de arriba y volvé a cargar la página."
                  : normalizedQuery
                    ? `Ningún pedido coincide con "${normalizedQuery}".`
                    : "Cuando entre el primer pedido del día va a aparecer acá."
              }
              icon={faInbox}
              title={
                ordersError
                  ? "No se pudo cargar la lista"
                  : normalizedQuery || normalizedStatusFilter
                    ? "Sin resultados"
                    : "Todavía no hay pedidos"
              }
            />
          }
          getKey={(order) => order.id}
          href={(order) => `/panel/orders/${order.id}`}
          rowLabel={(order) => `Ver pedido ${formatOrderNumber(order.orderNumber)} de ${order.customerName}`}
          rows={pagedOrderRows}
        />

        <Pagination buildHref={buildPageHref} page={currentPage} totalPages={totalPages} />
      </div>
    </PageShell>
  );
}
