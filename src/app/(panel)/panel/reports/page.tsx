import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { REPORTS_ALLOWED_ROLES, REPORTS_COLLECTION_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName } from "@/lib/contact";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  buildReportsData,
  resolveDateRange,
  resolveReportFilters,
  type ReportDelivery,
  type ReportFilters,
  type ReportKpi,
  type ReportMetric,
  type ReportOrder,
  type ReportOrderItem,
  type ReportPayment,
  type ReportPoint,
  type ReportPublicRequest,
  type ReportRankRow,
  type ReportSegment,
  type ReportTrip
} from "@/lib/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExpectedPaymentMethod, OrderStatus, PaymentMethod, PaymentStatus, SalesChannel } from "@/lib/types";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ProductOption = {
  familyName: string;
  id: string;
  label: string;
};

type RelatedCustomer = {
  delivery_area?: string | null;
  first_name?: string | null;
  id?: string | null;
  last_name?: string | null;
};

type RelatedProfile = {
  full_name?: string | null;
};

type RelatedReseller = {
  full_name?: string | null;
};

type RelatedProduct = {
  label?: string | null;
  product_families?: { name?: string | null } | { name?: string | null }[] | null;
};

type RelatedOrderItem = {
  line_total?: number | string | null;
  product_id?: string | null;
  product_name_snapshot?: string | null;
  product_variants?: RelatedProduct | RelatedProduct[] | null;
  quantity?: number | string | null;
  sales_unit_label_snapshot?: string | null;
};

type RawOrder = {
  created_at: string;
  customers?: RelatedCustomer | RelatedCustomer[] | null;
  delivery_area?: string | null;
  id: string;
  is_complimentary?: boolean | null;
  order_items?: RelatedOrderItem[] | null;
  payment_method_expected: ExpectedPaymentMethod;
  payment_status: PaymentStatus;
  resellers?: RelatedReseller | RelatedReseller[] | null;
  sales_channel: SalesChannel;
  seller?: RelatedProfile | RelatedProfile[] | null;
  status: OrderStatus;
  total_amount?: number | string | null;
};

type RawPayment = {
  amount?: number | string | null;
  method: PaymentMethod;
  order_id: string;
  received_at: string | null;
  status?: string | null;
  voided_at?: string | null;
};

type RawRequest = {
  converted_order_id?: string | null;
  created_at: string;
  status: string;
};

type RawDelivery = {
  assigned_date?: string | null;
  delivered_at?: string | null;
  delivery_status: string;
  driver?: RelatedProfile | RelatedProfile[] | null;
};

type RawTrip = {
  delivery_trip_orders?: Array<{ order_id?: string | null }> | null;
  driver?: RelatedProfile | RelatedProfile[] | null;
  scheduled_date: string;
  status: string;
};

type RawVariant = {
  id: string;
  label: string;
  product_families?: { name?: string | null } | { name?: string | null }[] | null;
};

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatShortDate(value: string) {
  return new Date(`${value}T03:00:00.000Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function formatDelta(delta: ReportKpi["delta"]) {
  if (delta.percent === null) {
    return delta.value === 0 ? "Sin cambio" : "Nuevo";
  }

  const sign = delta.percent > 0 ? "+" : "";
  return `${sign}${delta.percent.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function toneClasses(tone: ReportMetric["tone"]) {
  switch (tone) {
    case "amber":
      return "text-amber-300";
    case "emerald":
      return "text-emerald-300";
    case "rose":
      return "text-rose-300";
    case "sky":
      return "text-sky-300";
    default:
      return "text-stone-100";
  }
}

function MetricCard({ metric }: { metric: ReportMetric }) {
  return (
    <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
      <p className="text-sm text-stone-400">{metric.label}</p>
      <p className={`mt-2 text-2xl font-semibold sm:text-3xl ${toneClasses(metric.tone)}`}>{metric.value}</p>
      <p className="mt-2 text-sm text-stone-500">{metric.detail}</p>
    </article>
  );
}

function KpiCard({ metric }: { metric: ReportKpi }) {
  const trendClass =
    metric.delta.trend === "up"
      ? "text-emerald-300"
      : metric.delta.trend === "down"
        ? "text-rose-300"
        : "text-stone-400";

  return (
    <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-stone-400">{metric.label}</p>
        <span className={`rounded-full border border-stone-700 bg-stone-950/80 px-2.5 py-1 text-xs ${trendClass}`}>
          {formatDelta(metric.delta)}
        </span>
      </div>
      <p className={`mt-3 text-2xl font-semibold sm:text-3xl ${toneClasses(metric.tone)}`}>{metric.value}</p>
      <p className="mt-2 text-sm text-stone-500">{metric.detail}</p>
    </article>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-stone-800 bg-stone-900/40 px-4 py-8 text-center text-sm text-stone-500">
      <span className="max-w-sm">{label}</span>
    </div>
  );
}

function LineChart({ points }: { points: ReportPoint[] }) {
  const width = 720;
  const height = 240;
  const padding = 28;
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.revenue, point.paid)));
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const hasData = points.some((point) => point.revenue > 0 || point.paid > 0);
  const visibleLabels = points.filter((_, index) => {
    if (points.length <= 8) {
      return true;
    }

    return index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0;
  });

  function pathFor(key: "paid" | "revenue") {
    return points
      .map((point, index) => {
        const x = padding + index * step;
        const y = height - padding - (point[key] / maxValue) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  if (!points.length || !hasData) {
    return <EmptyPanel label="No hay ventas ni cobranzas para graficar en este rango. Probá ampliar el período o quitar filtros." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-stone-300">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          Ventas
        </span>
        <span className="inline-flex items-center gap-2 text-stone-300">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
          Cobrado
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de ventas y cobranza" className="h-72 w-full">
        <path d={`M ${padding} ${height - padding} H ${width - padding}`} className="stroke-stone-700" fill="none" />
        <path d={pathFor("revenue")} className="stroke-emerald-300" fill="none" strokeWidth="3" />
        <path d={pathFor("paid")} className="stroke-sky-300" fill="none" strokeWidth="3" />
        {points.map((point, index) => {
          const x = padding + index * step;
          const y = height - padding - (point.revenue / maxValue) * (height - padding * 2);
          return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="3.5" className="fill-emerald-200" />;
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-stone-500">
        {visibleLabels.map((point) => (
          <div key={point.label} className="truncate">
            {point.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ points }: { points: ReportPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => point.orders));
  const activePoints = points.filter((point) => point.orders > 0);

  if (!activePoints.length) {
    return <EmptyPanel label="No hay pedidos para comparar en este rango." />;
  }

  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
      <div className="flex h-56 items-end gap-2">
        {activePoints.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-44 w-full items-end rounded-xl bg-stone-950/80 px-1">
              <div
                className="w-full rounded-t-lg bg-amber-300"
                style={{ height: `${Math.max(4, (point.orders / maxValue) * 100)}%` }}
                title={`${point.orders} pedidos`}
              />
            </div>
            <span className="w-full truncate text-center text-xs text-stone-500">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ segments }: { segments: ReportSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;

  function strokeClass(colorClass: string) {
    switch (colorClass) {
      case "bg-amber-300":
        return "stroke-amber-300";
      case "bg-emerald-300":
        return "stroke-emerald-300";
      case "bg-rose-300":
        return "stroke-rose-300";
      case "bg-sky-300":
        return "stroke-sky-300";
      default:
        return "stroke-stone-300";
    }
  }

  if (!segments.length || total <= 0) {
    return <EmptyPanel label="No hay valores para este mix." />;
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-stone-800 bg-stone-900/60 p-4 sm:grid-cols-[10rem_1fr] sm:items-center">
      <svg viewBox="0 0 120 120" role="img" aria-label="Distribución" className="mx-auto h-40 w-40 -rotate-90">
        <circle cx="60" cy="60" r="42" className="fill-none stroke-stone-800" strokeWidth="18" />
        {segments.map((segment) => {
          const dash = (segment.value / total) * 263.89;
          const circle = (
            <circle
              key={segment.label}
              cx="60"
              cy="60"
              r="42"
              className={`fill-none ${strokeClass(segment.colorClass)}`}
              strokeDasharray={`${dash} ${263.89 - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              strokeWidth="18"
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 text-stone-300">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.colorClass}`} />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="text-stone-500">
                {((segment.value / total) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-800">
              <div className={`h-full ${segment.colorClass}`} style={{ width: `${(segment.value / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingTable({
  emptyLabel,
  metricFormat = "number",
  metricLabel,
  rows,
  secondaryLabel
}: {
  emptyLabel: string;
  metricFormat?: "currency" | "number";
  metricLabel: string;
  rows: ReportRankRow[];
  secondaryLabel: string;
}) {
  if (!rows.length) {
    return <EmptyPanel label={emptyLabel} />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/60">
      <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr] border-b border-stone-800 bg-stone-900 px-4 py-3 text-xs uppercase tracking-[0.18em] text-stone-400">
        <div>Nombre</div>
        <div>{metricLabel}</div>
        <div>{secondaryLabel}</div>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[1.4fr_0.8fr_0.8fr] items-center gap-3 border-b border-stone-800/70 px-4 py-3 last:border-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-100">{row.label}</p>
            <p className="mt-1 truncate text-xs text-stone-500">{row.detail}</p>
          </div>
          <div className="text-sm text-stone-200">
            {metricFormat === "currency"
              ? new Intl.NumberFormat("es-AR", {
                  currency: "ARS",
                  maximumFractionDigits: 0,
                  style: "currency"
                }).format(row.metric)
              : row.metric.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
          </div>
          <div>
            <p className="text-sm text-stone-300">{row.secondary}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-800">
              <div className="h-full bg-sky-300" style={{ width: `${Math.max(4, row.share)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function searchValue(filters: ReportFilters, key: keyof ReportFilters) {
  return String(filters[key] ?? "");
}

function mapOrderItem(item: RelatedOrderItem): ReportOrderItem {
  const product = takeSingleRelation(item.product_variants);
  const family = takeSingleRelation(product?.product_families);
  const productName = item.product_name_snapshot || family?.name || "Producto";
  const variantLabel = product?.label || item.sales_unit_label_snapshot || "Variante";

  return {
    familyName: family?.name || productName,
    lineTotal: Number(item.line_total ?? 0),
    productId: item.product_id || "",
    productName,
    quantity: Number(item.quantity ?? 0),
    unitLabel: item.sales_unit_label_snapshot || "Unidad",
    variantLabel
  };
}

function mapOrder(order: RawOrder): ReportOrder {
  const customer = takeSingleRelation(order.customers);
  const reseller = takeSingleRelation(order.resellers);
  const seller = takeSingleRelation(order.seller);

  return {
    channel: order.sales_channel,
    createdAt: order.created_at,
    customerId: customer?.id ?? null,
    customerName: customer ? formatPersonName(customer.first_name, customer.last_name) : reseller?.full_name || "Cliente sin nombre",
    deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
    id: order.id,
    isComplimentary: Boolean(order.is_complimentary),
    items: (order.order_items ?? []).map(mapOrderItem),
    paymentMethodExpected: order.payment_method_expected,
    paymentStatus: order.payment_status,
    resellerName: reseller?.full_name ?? null,
    sellerName: seller?.full_name ?? null,
    status: order.status,
    totalAmount: Number(order.total_amount ?? 0)
  };
}

function buildFilterHref(filters: ReportFilters, patch: Partial<ReportFilters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  params.set("preset", next.preset);
  params.set("groupBy", next.groupBy);
  params.set("start", next.startDate);
  params.set("end", next.endDate);
  params.set("channel", next.channel);
  params.set("status", next.status);
  params.set("method", next.method);
  params.set("zone", next.zone);
  params.set("product", next.productId);
  return `/panel/reports?${params.toString()}`;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const auth = await requirePageRole(REPORTS_ALLOWED_ROLES, "/panel/reports");
  const canSeeCollections = REPORTS_COLLECTION_ALLOWED_ROLES.includes(auth.profile.role);
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = resolveReportFilters(resolvedSearchParams);
  const range = resolveDateRange(filters);
  const supabase = createAdminClient();

  const [
    { data: orders, error: ordersError },
    { data: payments, error: paymentsError },
    { data: requests, error: requestsError },
    { data: deliveries, error: deliveriesError },
    { data: trips, error: tripsError },
    { data: variants, error: variantsError },
    { data: zones, error: zonesError }
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `
          id,
          created_at,
          sales_channel,
          total_amount,
          payment_method_expected,
          payment_status,
          is_complimentary,
          status,
          delivery_area,
          customers (
            id,
            first_name,
            last_name,
            delivery_area
          ),
          resellers (
            full_name
          ),
          seller:profiles!orders_seller_user_id_fkey (
            full_name
          ),
          order_items (
            product_id,
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity,
            line_total,
            product_variants (
              label,
              product_families!product_variants_product_family_id_fkey (
                name
              )
            )
          )
        `
      )
      .gte("created_at", range.previousStartIso)
      .lt("created_at", range.endExclusiveIso)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("order_id, amount, method, received_at, status, voided_at")
      .eq("status", "received")
      .is("voided_at", null)
      .gte("received_at", range.previousStartIso)
      .lt("received_at", range.endExclusiveIso),
    supabase
      .from("public_order_requests")
      .select("created_at, status, converted_order_id")
      .gte("created_at", range.previousStartIso)
      .lt("created_at", range.endExclusiveIso),
    supabase
      .from("deliveries")
      .select(
        `
          assigned_date,
          delivered_at,
          delivery_status,
          driver:profiles!deliveries_driver_user_id_fkey (
            full_name
          )
        `
      ),
    supabase
      .from("delivery_trips")
      .select(
        `
          scheduled_date,
          status,
          driver:profiles!delivery_trips_driver_user_id_fkey (
            full_name
          ),
          delivery_trip_orders (
            order_id
          )
        `
      )
      .gte("scheduled_date", range.startDate)
      .lte("scheduled_date", range.endDate),
    supabase
      .from("product_variants")
      .select(
        `
          id,
          label,
          product_families!product_variants_product_family_id_fkey (
            name
          )
        `
      )
      .eq("active", true)
      .order("label", { ascending: true }),
    supabase.from("orders").select("delivery_area").order("delivery_area", { ascending: true })
  ]);

  const reportErrors = {
    deliveries: deliveriesError,
    orders: ordersError,
    payments: paymentsError,
    requests: requestsError,
    trips: tripsError,
    variants: variantsError,
    zones: zonesError
  };

  for (const [key, error] of Object.entries(reportErrors)) {
    if (error) {
      console.error(`reports ${key} fetch failed`, error);
    }
  }

  const reportOrders = ((orders ?? []) as RawOrder[]).map(mapOrder);
  const reportPayments = ((payments ?? []) as RawPayment[])
    .filter((payment) => payment.received_at)
    .map(
      (payment): ReportPayment => ({
        amount: Number(payment.amount ?? 0),
        method: payment.method,
        orderId: payment.order_id,
        receivedAt: payment.received_at ?? ""
      })
    );
  const reportRequests = ((requests ?? []) as RawRequest[]).map(
    (request): ReportPublicRequest => ({
      convertedOrderId: request.converted_order_id ?? null,
      createdAt: request.created_at,
      status: request.status
    })
  );
  const reportDeliveries = ((deliveries ?? []) as RawDelivery[]).map(
    (delivery): ReportDelivery => ({
      assignedDate: delivery.assigned_date ?? null,
      deliveredAt: delivery.delivered_at ?? null,
      driverName: takeSingleRelation(delivery.driver)?.full_name ?? null,
      status: delivery.delivery_status
    })
  );
  const reportTrips = ((trips ?? []) as RawTrip[]).map(
    (trip): ReportTrip => ({
      driverName: takeSingleRelation(trip.driver)?.full_name ?? null,
      orderCount: trip.delivery_trip_orders?.length ?? 0,
      scheduledDate: trip.scheduled_date,
      status: trip.status
    })
  );
  const productOptions: ProductOption[] = ((variants ?? []) as RawVariant[]).map((variant) => ({
    familyName: takeSingleRelation(variant.product_families)?.name ?? "Producto",
    id: variant.id,
    label: variant.label
  }));
  const zoneOptions = Array.from(
    new Set(
      ((zones ?? []) as Array<{ delivery_area?: string | null }>)
        .map((row) => row.delivery_area)
        .filter((zone): zone is string => Boolean(zone))
    )
  );
  const reports = buildReportsData({
    deliveries: reportDeliveries,
    filters,
    orders: reportOrders,
    payments: reportPayments,
    publicRequests: reportRequests,
    trips: reportTrips
  });

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
            Reportes
          </span>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Reportes comerciales y operativos
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
                {formatShortDate(filters.startDate)} - {formatShortDate(filters.endDate)} comparado contra{" "}
                {formatShortDate(range.previousStartDate)} - {formatShortDate(range.previousEndDate)}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["today", "Hoy"],
                ["7d", "7 días"],
                ["30d", "30 días"],
                ["month", "Mes actual"],
                ["last_month", "Mes anterior"]
              ].map(([preset, label]) => (
                <Link
                  key={preset}
                  href={buildFilterHref(filters, { preset: preset as ReportFilters["preset"] })}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    filters.preset === preset
                      ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                      : "border-stone-800 bg-stone-900/70 text-stone-400 hover:border-stone-700 hover:text-stone-100"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <form className="grid gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 p-4 md:grid-cols-2 xl:grid-cols-8">
          <input type="hidden" name="preset" value="custom" />
          <label className="grid gap-1 text-xs text-stone-400">
            Desde
            <input
              name="start"
              type="date"
              defaultValue={filters.startDate}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Hasta
            <input
              name="end"
              type="date"
              defaultValue={filters.endDate}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Agrupar
            <select
              name="groupBy"
              defaultValue={searchValue(filters, "groupBy")}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Canal
            <select
              name="channel"
              defaultValue={searchValue(filters, "channel")}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="all">Todos</option>
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Estado
            <select
              name="status"
              defaultValue={searchValue(filters, "status")}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="all">Todos</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Pago
            <select
              name="method"
              defaultValue={searchValue(filters, "method")}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="all">Todos</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Zona
            <select
              name="zone"
              defaultValue={searchValue(filters, "zone")}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="all">Todas</option>
              {zoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Producto
            <select
              name="product"
              defaultValue={filters.productId}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="all">Todos</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.familyName} · {product.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 md:col-span-2 xl:col-span-8">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400"
            >
              Aplicar filtros
            </button>
            <Link
              href="/panel/reports"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-medium text-stone-300 transition hover:border-stone-600 hover:text-stone-100"
            >
              Limpiar
            </Link>
          </div>
        </form>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {reports.kpis.map((metric) => (
            <KpiCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-50">Tendencia de ventas y cobranza</h2>
              <p className="mt-1 text-sm text-stone-500">
                Agrupado por {filters.groupBy === "day" ? "día" : filters.groupBy === "week" ? "semana" : "mes"}
              </p>
            </div>
            <span className="text-sm text-stone-500">{reports.series.length} períodos</span>
          </div>
          <LineChart points={reports.series} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-stone-50">Pedidos por período</h2>
              <p className="mt-1 text-sm text-stone-500">Solo se muestran períodos con pedidos.</p>
            </div>
            <BarChart points={reports.series} />
          </div>
          <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-stone-50">Ventas por canal</h2>
            <DonutChart segments={reports.channelMix} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-stone-50">Método esperado</h2>
            <DonutChart segments={reports.methodMix} />
          </div>
          <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-stone-50">Estado de cobranza</h2>
            <DonutChart segments={reports.paymentStatusMix} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Productos</h2>
            <RankingTable
              emptyLabel="No hay productos vendidos en el rango."
              metricLabel="Unidades"
              rows={reports.productRows}
              secondaryLabel="Venta"
            />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Zonas</h2>
            <RankingTable
              emptyLabel="No hay zonas para este rango."
              metricFormat="currency"
              metricLabel="Venta"
              rows={reports.zoneRows}
              secondaryLabel="Pedidos"
            />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Clientes</h2>
            <RankingTable
              emptyLabel="No hay clientes para este rango."
              metricFormat="currency"
              metricLabel="Venta"
              rows={reports.customerRows}
              secondaryLabel="Pedidos"
            />
          </div>
        </section>

        {canSeeCollections ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-stone-50">Antigüedad de deuda</h2>
              <div className="grid grid-cols-2 gap-3">
                {reports.aging.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-lg font-semibold text-stone-50">Cobranza completa</h2>
              <div className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5 text-sm leading-6 text-stone-400">
                El detalle sensible de cobranza queda visible para administración y cobranza. Los pagos anulados quedan excluidos y el saldo se calcula contra pedidos no cancelados del rango.
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-stone-800 bg-stone-900/60 p-5 text-sm text-stone-400">
            El detalle completo de cobranza está restringido a administración y cobranza.
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Operación</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {reports.operationMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Logística</h2>
            <div className="grid grid-cols-2 gap-3">
              {reports.logisticsMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Reparto por chofer</h2>
            <RankingTable
              emptyLabel="No hay entregas por repartidor en el rango."
              metricLabel="Entregas"
              rows={reports.deliveryRows}
              secondaryLabel="Fallidas"
            />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-50">Stock futuro</h2>
            <div className="grid grid-cols-2 gap-3">
              {reports.stockPreview.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
