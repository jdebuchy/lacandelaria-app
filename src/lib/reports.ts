import type { OrderStatus, PaymentMethod, PaymentStatus, SalesChannel } from "@/lib/types";

export type ReportPreset = "today" | "7d" | "30d" | "month" | "last_month" | "custom";
export type ReportGroupBy = "day" | "week" | "month";

export type ReportFilters = {
  channel: "all" | SalesChannel;
  endDate: string;
  groupBy: ReportGroupBy;
  method: "all" | PaymentMethod;
  productId: string;
  preset: ReportPreset;
  startDate: string;
  status: "all" | OrderStatus;
  zone: string;
};

export type ReportDateRange = {
  endDate: string;
  endExclusiveIso: string;
  previousEndDate: string;
  previousEndExclusiveIso: string;
  previousStartDate: string;
  previousStartIso: string;
  startDate: string;
  startIso: string;
};

export type ReportOrderItem = {
  familyName: string;
  lineTotal: number;
  productId: string;
  productName: string;
  quantity: number;
  unitLabel: string;
  variantLabel: string;
};

export type ReportOrder = {
  channel: SalesChannel;
  createdAt: string;
  customerId: string | null;
  customerName: string;
  deliveryArea: string;
  id: string;
  isComplimentary: boolean;
  items: ReportOrderItem[];
  paymentMethodExpected: PaymentMethod;
  paymentStatus: PaymentStatus;
  resellerName: string | null;
  sellerName: string | null;
  status: OrderStatus;
  totalAmount: number;
};

export type ReportPayment = {
  amount: number;
  method: PaymentMethod;
  orderId: string;
  receivedAt: string;
};

export type ReportPublicRequest = {
  convertedOrderId: string | null;
  createdAt: string;
  status: string;
};

export type ReportDelivery = {
  assignedDate: string | null;
  deliveredAt: string | null;
  driverName: string | null;
  status: string;
};

export type ReportTrip = {
  driverName: string | null;
  orderCount: number;
  scheduledDate: string;
  status: string;
};

export type ReportMetric = {
  detail: string;
  label: string;
  tone: "amber" | "emerald" | "rose" | "sky" | "stone";
  value: string;
};

export type ReportDelta = {
  percent: number | null;
  trend: "down" | "flat" | "up";
  value: number;
};

export type ReportKpi = ReportMetric & {
  delta: ReportDelta;
};

export type ReportPoint = {
  label: string;
  orders: number;
  paid: number;
  revenue: number;
  units: number;
};

export type ReportSegment = {
  colorClass: string;
  label: string;
  value: number;
};

export type ReportRankRow = {
  detail: string;
  label: string;
  metric: number;
  secondary: string;
  share: number;
};

export type ReportsData = {
  aging: ReportMetric[];
  channelMix: ReportSegment[];
  customerRows: ReportRankRow[];
  deliveryRows: ReportRankRow[];
  kpis: ReportKpi[];
  logisticsMetrics: ReportMetric[];
  methodMix: ReportSegment[];
  operationMetrics: ReportMetric[];
  paymentStatusMix: ReportSegment[];
  productRows: ReportRankRow[];
  range: ReportDateRange;
  series: ReportPoint[];
  stockPreview: ReportMetric[];
  zoneRows: ReportRankRow[];
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const DAY_MS = 24 * 60 * 60 * 1000;

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  internal: "Interno",
  public_form: "Formulario",
  reseller: "Revendedor"
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  assigned: "Asignado",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
  delivered: "Entregado",
  in_route: "En ruta",
  pending_confirmation: "Pendiente"
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia"
};

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric"
  }).format(date);
}

function localDateToUtc(date: string) {
  return new Date(`${date}T03:00:00.000Z`);
}

function addDays(date: string, days: number) {
  return dateKey(new Date(localDateToUtc(date).getTime() + days * DAY_MS));
}

function diffDaysInclusive(startDate: string, endDate: string) {
  return Math.max(1, Math.round((localDateToUtc(endDate).getTime() - localDateToUtc(startDate).getTime()) / DAY_MS) + 1);
}

function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function endOfMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return dateKey(new Date(Date.UTC(year, month, 0, 3)));
}

function previousMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return dateKey(new Date(Date.UTC(year, month - 2, 1, 3)));
}

function toIsoStart(date: string) {
  return `${date}T03:00:00.000Z`;
}

function toIsoEndExclusive(date: string) {
  return toIsoStart(addDays(date, 1));
}

function normalizePreset(value?: string): ReportPreset {
  if (value === "today" || value === "7d" || value === "30d" || value === "month" || value === "last_month") {
    return value;
  }

  return value === "custom" ? "custom" : "30d";
}

function normalizeGroupBy(value?: string): ReportGroupBy {
  return value === "week" || value === "month" ? value : "day";
}

function normalizeDate(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export function resolveReportFilters(params: Record<string, string | string[] | undefined>): ReportFilters {
  const today = dateKey(new Date());
  const preset = normalizePreset(singleParam(params.preset));
  let startDate = addDays(today, -29);
  let endDate = today;

  if (preset === "today") {
    startDate = today;
  } else if (preset === "7d") {
    startDate = addDays(today, -6);
  } else if (preset === "month") {
    startDate = startOfMonth(today);
  } else if (preset === "last_month") {
    const previous = previousMonth(today);
    startDate = startOfMonth(previous);
    endDate = endOfMonth(previous);
  } else if (preset === "custom") {
    startDate = normalizeDate(singleParam(params.start), startDate);
    endDate = normalizeDate(singleParam(params.end), endDate);
  }

  if (localDateToUtc(startDate).getTime() > localDateToUtc(endDate).getTime()) {
    [startDate, endDate] = [endDate, startDate];
  }

  const channel = singleParam(params.channel);
  const status = singleParam(params.status);
  const method = singleParam(params.method);

  return {
    channel: channel === "internal" || channel === "public_form" || channel === "reseller" ? channel : "all",
    endDate,
    groupBy: normalizeGroupBy(singleParam(params.groupBy)),
    method: method === "cash" || method === "transfer" ? method : "all",
    productId: singleParam(params.product) ?? "all",
    preset,
    startDate,
    status:
      status === "pending_confirmation" ||
      status === "confirmed" ||
      status === "assigned" ||
      status === "in_route" ||
      status === "delivered" ||
      status === "cancelled"
        ? status
        : "all",
    zone: singleParam(params.zone) ?? "all"
  };
}

export function resolveDateRange(filters: ReportFilters): ReportDateRange {
  const dayCount = diffDaysInclusive(filters.startDate, filters.endDate);
  const previousEndDate = addDays(filters.startDate, -1);
  const previousStartDate = addDays(previousEndDate, -(dayCount - 1));

  return {
    endDate: filters.endDate,
    endExclusiveIso: toIsoEndExclusive(filters.endDate),
    previousEndDate,
    previousEndExclusiveIso: toIsoEndExclusive(previousEndDate),
    previousStartDate,
    previousStartIso: toIsoStart(previousStartDate),
    startDate: filters.startDate,
    startIso: toIsoStart(filters.startDate)
  };
}

export function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isInDateRange(value: string | null | undefined, startDate: string, endDate: string) {
  if (!value) {
    return false;
  }

  const key = dateKey(new Date(value));
  return key >= startDate && key <= endDate;
}

function orderMatchesFilters(order: ReportOrder, filters: ReportFilters) {
  if (filters.channel !== "all" && order.channel !== filters.channel) {
    return false;
  }

  if (filters.status !== "all" && order.status !== filters.status) {
    return false;
  }

  if (filters.method !== "all" && order.paymentMethodExpected !== filters.method) {
    return false;
  }

  if (filters.zone !== "all" && order.deliveryArea !== filters.zone) {
    return false;
  }

  if (filters.productId !== "all" && !order.items.some((item) => item.productId === filters.productId)) {
    return false;
  }

  return true;
}

function currentOrders(orders: ReportOrder[], filters: ReportFilters, range: ReportDateRange) {
  return orders.filter(
    (order) => isInDateRange(order.createdAt, range.startDate, range.endDate) && orderMatchesFilters(order, filters)
  );
}

function previousOrders(orders: ReportOrder[], filters: ReportFilters, range: ReportDateRange) {
  return orders.filter(
    (order) =>
      isInDateRange(order.createdAt, range.previousStartDate, range.previousEndDate) &&
      orderMatchesFilters(order, filters)
  );
}

function nonCancelled(orders: ReportOrder[]) {
  return orders.filter((order) => order.status !== "cancelled");
}

function revenueFor(orders: ReportOrder[]) {
  return nonCancelled(orders).reduce((sum, order) => sum + (order.isComplimentary ? 0 : order.totalAmount), 0);
}

function unitsFor(orders: ReportOrder[]) {
  return nonCancelled(orders).reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
}

function delta(current: number, previous: number): ReportDelta {
  const value = current - previous;

  return {
    percent: previous === 0 ? null : (value / previous) * 100,
    trend: value > 0 ? "up" : value < 0 ? "down" : "flat",
    value
  };
}

function currency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    currency: "ARS",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function bucketLabel(value: string, groupBy: ReportGroupBy) {
  const date = localDateToUtc(value);

  if (groupBy === "month") {
    return new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: TIME_ZONE }).format(date);
  }

  if (groupBy === "week") {
    return `Sem. ${new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      timeZone: TIME_ZONE
    }).format(date)}`;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE
  }).format(date);
}

function bucketKey(value: string, groupBy: ReportGroupBy) {
  const key = dateKey(new Date(value));

  if (groupBy === "month") {
    return startOfMonth(key);
  }

  if (groupBy === "week") {
    const date = localDateToUtc(key);
    const day = date.getUTCDay() || 7;
    return dateKey(new Date(date.getTime() - (day - 1) * DAY_MS));
  }

  return key;
}

function makeSeries(orders: ReportOrder[], payments: ReportPayment[], filters: ReportFilters, range: ReportDateRange) {
  const buckets = new Map<string, ReportPoint>();

  for (let date = range.startDate; date <= range.endDate; date = addDays(date, 1)) {
    const key = bucketKey(toIsoStart(date), filters.groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, { label: bucketLabel(key, filters.groupBy), orders: 0, paid: 0, revenue: 0, units: 0 });
    }
  }

  for (const order of orders) {
    const key = bucketKey(order.createdAt, filters.groupBy);
    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }

    bucket.orders += 1;
    if (order.status !== "cancelled") {
      bucket.revenue += order.isComplimentary ? 0 : order.totalAmount;
      bucket.units += order.items.reduce((sum, item) => sum + item.quantity, 0);
    }
  }

  for (const payment of payments) {
    const key = bucketKey(payment.receivedAt, filters.groupBy);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.paid += payment.amount;
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => point);
}

function increment(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function segmentsFromMap(map: Map<string, number>, labels: Partial<Record<string, string>>, colors: string[]) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([key, value], index) => ({
      colorClass: colors[index % colors.length],
      label: labels[key] ?? key,
      value
    }));
}

function rankRows(
  map: Map<string, { detail: string; metric: number; secondaryValue: number }>,
  total: number,
  limit = 6,
  secondaryFormatter = number
) {
  return [...map.entries()]
    .sort((left, right) => right[1].metric - left[1].metric)
    .slice(0, limit)
    .map(([label, row]) => ({
      detail: row.detail,
      label,
      metric: row.metric,
      secondary: secondaryFormatter(row.secondaryValue),
      share: total > 0 ? (row.metric / total) * 100 : 0
    }));
}

function buildAgingMetrics(orders: ReportOrder[]) {
  const openOrders = nonCancelled(orders).filter((order) => order.paymentStatus !== "paid");
  const today = dateKey(new Date());
  const groups = [
    { label: "0-7 días", max: 7, min: 0 },
    { label: "8-14 días", max: 14, min: 8 },
    { label: "15-30 días", max: 30, min: 15 },
    { label: "+30 días", max: Number.POSITIVE_INFINITY, min: 31 }
  ];

  return groups.map((group) => {
    const matching = openOrders.filter((order) => {
      const age = diffDaysInclusive(dateKey(new Date(order.createdAt)), today) - 1;
      return age >= group.min && age <= group.max;
    });

    return {
      detail: `${matching.length} pedido${matching.length === 1 ? "" : "s"}`,
      label: group.label,
      tone: "stone" as const,
      value: currency(matching.reduce((sum, order) => sum + order.totalAmount, 0))
    };
  });
}

export function buildReportsData({
  deliveries,
  filters,
  orders,
  payments,
  publicRequests,
  trips
}: {
  deliveries: ReportDelivery[];
  filters: ReportFilters;
  orders: ReportOrder[];
  payments: ReportPayment[];
  publicRequests: ReportPublicRequest[];
  trips: ReportTrip[];
}): ReportsData {
  const range = resolveDateRange(filters);
  const ordersNow = currentOrders(orders, filters, range);
  const ordersBefore = previousOrders(orders, filters, range);
  const sellableOrdersNow = nonCancelled(ordersNow);
  const sellableOrdersBefore = nonCancelled(ordersBefore);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const currentPayments = payments.filter((payment) => {
    const order = orderById.get(payment.orderId);
    return isInDateRange(payment.receivedAt, range.startDate, range.endDate) && (!order || orderMatchesFilters(order, filters));
  });
  const previousPayments = payments.filter((payment) => {
    const order = orderById.get(payment.orderId);
    return (
      isInDateRange(payment.receivedAt, range.previousStartDate, range.previousEndDate) &&
      (!order || orderMatchesFilters(order, filters))
    );
  });
  const revenueNow = revenueFor(ordersNow);
  const revenueBefore = revenueFor(ordersBefore);
  const paidNow = currentPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const paidBefore = previousPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const unitsNow = unitsFor(ordersNow);
  const unitsBefore = unitsFor(ordersBefore);
  const openBalance = sellableOrdersNow
    .filter((order) => order.paymentStatus !== "paid")
    .reduce((sum, order) => {
      const paid = payments
        .filter((payment) => payment.orderId === order.id)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      return sum + Math.max(0, order.totalAmount - paid);
    }, 0);
  const requestsNow = publicRequests.filter((request) => isInDateRange(request.createdAt, range.startDate, range.endDate));
  const requestsBefore = publicRequests.filter((request) =>
    isInDateRange(request.createdAt, range.previousStartDate, range.previousEndDate)
  );
  const convertedNow = requestsNow.filter((request) => request.status === "converted" || request.convertedOrderId).length;
  const convertedBefore = requestsBefore.filter((request) => request.status === "converted" || request.convertedOrderId).length;
  const conversionRateNow = requestsNow.length ? (convertedNow / requestsNow.length) * 100 : 0;
  const conversionRateBefore = requestsBefore.length ? (convertedBefore / requestsBefore.length) * 100 : 0;
  const cancelledNow = ordersNow.filter((order) => order.status === "cancelled").length;
  const cancelledBefore = ordersBefore.filter((order) => order.status === "cancelled").length;
  const ticketNow = sellableOrdersNow.length ? revenueNow / sellableOrdersNow.length : 0;
  const ticketBefore = sellableOrdersBefore.length ? revenueBefore / sellableOrdersBefore.length : 0;

  const channelMap = new Map<string, number>();
  const methodMap = new Map<string, number>();
  const paymentStatusMap = new Map<string, number>();
  const productMap = new Map<string, { detail: string; metric: number; secondaryValue: number }>();
  const customerMap = new Map<string, { detail: string; metric: number; secondaryValue: number }>();
  const zoneMap = new Map<string, { detail: string; metric: number; secondaryValue: number }>();

  for (const order of sellableOrdersNow) {
    increment(channelMap, order.channel, order.isComplimentary ? 0 : order.totalAmount);
    increment(methodMap, order.paymentMethodExpected, order.isComplimentary ? 0 : order.totalAmount);
    increment(paymentStatusMap, order.paymentStatus, order.isComplimentary ? 0 : order.totalAmount);

    const customerKey = order.customerName || order.resellerName || "Cliente sin nombre";
    const customer = customerMap.get(customerKey) ?? { detail: order.deliveryArea, metric: 0, secondaryValue: 0 };
    customer.metric += order.isComplimentary ? 0 : order.totalAmount;
    customer.secondaryValue += 1;
    customerMap.set(customerKey, customer);

    const zone = zoneMap.get(order.deliveryArea) ?? { detail: "Zona de entrega", metric: 0, secondaryValue: 0 };
    zone.metric += order.isComplimentary ? 0 : order.totalAmount;
    zone.secondaryValue += 1;
    zoneMap.set(order.deliveryArea, zone);

    for (const item of order.items) {
      if (filters.productId !== "all" && item.productId !== filters.productId) {
        continue;
      }

      const label = `${item.familyName} · ${item.variantLabel}`;
      const product = productMap.get(label) ?? { detail: item.unitLabel, metric: 0, secondaryValue: 0 };
      product.metric += item.quantity;
      product.secondaryValue += item.lineTotal;
      productMap.set(label, product);
    }
  }

  const deliveredNow = deliveries.filter((delivery) => isInDateRange(delivery.deliveredAt ?? delivery.assignedDate, range.startDate, range.endDate));
  const tripsNow = trips.filter((trip) => trip.scheduledDate >= range.startDate && trip.scheduledDate <= range.endDate);
  const deliveriesByDriver = new Map<string, { detail: string; metric: number; secondaryValue: number }>();
  for (const delivery of deliveredNow) {
    const label = delivery.driverName || "Sin repartidor";
    const row = deliveriesByDriver.get(label) ?? { detail: "Entregas", metric: 0, secondaryValue: 0 };
    row.metric += delivery.status === "delivered" ? 1 : 0;
    row.secondaryValue += delivery.status === "failed" ? 1 : 0;
    deliveriesByDriver.set(label, row);
  }

  return {
    aging: buildAgingMetrics(sellableOrdersNow),
    channelMix: segmentsFromMap(channelMap, CHANNEL_LABELS, ["bg-sky-300", "bg-emerald-300", "bg-amber-300"]),
    customerRows: rankRows(customerMap, revenueNow),
    deliveryRows: rankRows(deliveriesByDriver, Math.max(1, deliveredNow.length)),
    kpis: [
      {
        delta: delta(revenueNow, revenueBefore),
        detail: "Pedidos no cancelados",
        label: "Ventas",
        tone: "emerald",
        value: currency(revenueNow)
      },
      {
        delta: delta(ordersNow.length, ordersBefore.length),
        detail: `${cancelledNow} cancelado${cancelledNow === 1 ? "" : "s"}`,
        label: "Pedidos",
        tone: "sky",
        value: number(ordersNow.length)
      },
      {
        delta: delta(unitsNow, unitsBefore),
        detail: "Unidades vendidas",
        label: "Unidades",
        tone: "amber",
        value: number(unitsNow)
      },
      {
        delta: delta(ticketNow, ticketBefore),
        detail: "Promedio por pedido",
        label: "Ticket promedio",
        tone: "stone",
        value: currency(ticketNow)
      },
      {
        delta: delta(paidNow, paidBefore),
        detail: "Pagos recibidos",
        label: "Cobrado",
        tone: "emerald",
        value: currency(paidNow)
      },
      {
        delta: delta(openBalance, 0),
        detail: "Saldo abierto del rango",
        label: "Saldo pendiente",
        tone: "rose",
        value: currency(openBalance)
      },
      {
        delta: delta(cancelledNow, cancelledBefore),
        detail: "Pedidos cancelados",
        label: "Cancelados",
        tone: "rose",
        value: number(cancelledNow)
      },
      {
        delta: delta(conversionRateNow, conversionRateBefore),
        detail: `${convertedNow}/${requestsNow.length} solicitudes`,
        label: "Conversión pública",
        tone: "sky",
        value: percent(conversionRateNow)
      }
    ],
    logisticsMetrics: [
      {
        detail: "Viajes programados",
        label: "Viajes",
        tone: "sky",
        value: number(tripsNow.length)
      },
      {
        detail: "Pedidos en viajes",
        label: "Volumen planificado",
        tone: "amber",
        value: number(tripsNow.reduce((sum, trip) => sum + trip.orderCount, 0))
      },
      {
        detail: "Marcadas como entregadas",
        label: "Entregas",
        tone: "emerald",
        value: number(deliveredNow.filter((delivery) => delivery.status === "delivered").length)
      },
      {
        detail: "Rechazadas o fallidas",
        label: "Fallidas",
        tone: "rose",
        value: number(deliveredNow.filter((delivery) => delivery.status === "failed").length)
      }
    ],
    methodMix: segmentsFromMap(methodMap, PAYMENT_METHOD_LABELS, ["bg-emerald-300", "bg-sky-300"]),
    operationMetrics: [
      "pending_confirmation",
      "confirmed",
      "assigned",
      "in_route",
      "delivered",
      "cancelled"
    ].map((status) => {
      const count = ordersNow.filter((order) => order.status === status).length;
      return {
        detail: "Estado de pedido",
        label: ORDER_STATUS_LABELS[status as OrderStatus],
        tone: status === "cancelled" ? ("rose" as const) : ("stone" as const),
        value: number(count)
      };
    }),
    paymentStatusMix: segmentsFromMap(
      paymentStatusMap,
      { paid: "Pagado", partial: "Parcial", pending: "Pendiente" },
      ["bg-emerald-300", "bg-amber-300", "bg-rose-300"]
    ),
    productRows: rankRows(productMap, Math.max(1, unitsNow), 6, currency),
    range,
    series: makeSeries(ordersNow, currentPayments, filters, range),
    stockPreview: [
      {
        detail: "Requiere stock por variante",
        label: "Rotación",
        tone: "stone",
        value: "Próximo"
      },
      {
        detail: "Mixes y componentes internos",
        label: "Consumo",
        tone: "stone",
        value: "Próximo"
      },
      {
        detail: "Merma por lote o variante",
        label: "Merma",
        tone: "stone",
        value: "Próximo"
      },
      {
        detail: "Días de cobertura",
        label: "Cobertura",
        tone: "stone",
        value: "Próximo"
      }
    ],
    zoneRows: rankRows(zoneMap, revenueNow)
  };
}
