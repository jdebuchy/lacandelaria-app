import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AddressKind,
  formatStructuredAddressLine,
  formatStructuredAddressSummary
} from "@/lib/address";
import { formatPersonName } from "@/lib/contact";
import { RECEIVED_PAYMENT_STATUS } from "@/lib/payments";
import type { DeliveryFailureReason, DeliveryStatus, PaymentMethod } from "@/lib/types";

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
  address_kind?: AddressKind | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  administrative_area_level_1?: string | null;
  delivery_notes?: string | null;
  first_name?: string | null;
  gated_community_name?: string | null;
  google_place_id?: string | null;
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
  id: string;
  method: PaymentMethod | string;
  received_by_user_id: string | null;
  status: string;
};

type RelatedProductVariant = {
  cash_price?: number | string | null;
  transfer_price?: number | string | null;
};

type RelatedOrderItem = {
  product_name_snapshot?: string | null;
  product_variants?: RelatedProductVariant | RelatedProductVariant[] | null;
  quantity: number | string | null;
};

type OrderRow = {
  customers?: RelatedCustomer | RelatedCustomer[] | null;
  deliveries?: RelatedDelivery | RelatedDelivery[] | null;
  delivery_window_end?: string | null;
  delivery_window_start?: string | null;
  id: string;
  items_count?: number | null;
  notes?: string | null;
  order_items?: RelatedOrderItem[] | null;
  order_number?: number | string | null;
  payment_method_expected: string;
  payment_status: string;
  payments?: RelatedPayment[] | null;
  resellers?: RelatedReseller | RelatedReseller[] | null;
  status: string;
  total_amount?: number | string | null;
};

export type DeliveryExecutionPayment = {
  amount: number;
  id: string;
  method: string;
  receivedByUserId: string | null;
};

export type DeliveryExecutionStop = {
  addressKind: AddressKind;
  addressLine: string;
  addressLine1: string;
  addressSummary: string;
  cashPaymentBalanceAmount: number;
  customerName: string;
  customerPhone: string;
  deliveryFailureReason: DeliveryFailureReason | null;
  deliveryNotes: string | null;
  deliveryStatus: DeliveryStatus;
  deliveryWindow: string | null;
  googlePlaceId: string | null;
  id: string;
  itemsCount: number;
  itemsSummary: string;
  locality: string;
  notes: string | null;
  orderNumber: number | string | null;
  orderStatus: string;
  paidAmount: number;
  paymentBalanceAmount: number;
  paymentMethodExpected: string;
  paymentStatus: string;
  payments: DeliveryExecutionPayment[];
  releasedAt: string | null;
  resolvedAt: string | null;
  sequenceNumber: number;
  totalAmount: number;
  transferPaymentBalanceAmount: number;
  /** Id de la fila de `delivery_trip_orders`: un pedido puede tener mas de una parada en el viaje. */
  tripOrderId: string;
};

const TRIP_ORDER_COLUMNS =
  "id, order_id, released_at, resolved_at, sequence_number, stop_status, stop_failure_reason, stop_note";

const ORDER_COLUMNS = `
  id,
  order_number,
  status,
  notes,
  items_count,
  total_amount,
  delivery_window_start,
  delivery_window_end,
  payment_method_expected,
  payment_status,
  customers (
    first_name,
    last_name,
    phone,
    address_kind,
    address_line_1,
    address_line_2,
    locality,
    administrative_area_level_1,
    gated_community_name,
    google_place_id,
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
    id,
    amount,
    method,
    status,
    received_by_user_id
  ),
  order_items (
    quantity,
    product_name_snapshot,
    product_variants (
      cash_price,
      transfer_price
    )
  )
`;

export function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * Una parada liberada conserva el resultado que tuvo en ese viaje. Mientras sigue activa,
 * `deliveries` es la fuente de verdad porque es lo que el repartidor actualiza.
 */
export function getEffectiveStopStatus(
  row: Pick<TripOrderRow, "released_at" | "stop_status">,
  order: Pick<OrderRow, "deliveries"> | undefined
): DeliveryStatus {
  if (row.released_at) {
    return row.stop_status ?? "failed";
  }

  const delivery = takeSingleRelation(order?.deliveries);
  return delivery?.delivery_status ?? row.stop_status ?? "pending";
}

function priceFor(item: RelatedOrderItem, key: "cash_price" | "transfer_price") {
  const variant = takeSingleRelation(item.product_variants);
  return Number(variant?.[key] ?? 0);
}

export function calculateItemsTotal(
  items: RelatedOrderItem[] | null | undefined,
  key: "cash_price" | "transfer_price"
) {
  return (items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity ?? 0) * priceFor(item, key),
    0
  );
}

/** Las columnas `time` de Postgres llegan como "HH:MM:SS"; al repartidor le alcanza HH:MM. */
export function formatDeliveryWindow(start?: string | null, end?: string | null) {
  const from = start?.slice(0, 5);
  const to = end?.slice(0, 5);

  if (!from || !to) {
    return null;
  }

  return `${from} a ${to}`;
}

function summarizeItems(items: RelatedOrderItem[] | null | undefined) {
  const parts = (items ?? [])
    .map((item) => {
      const name = item.product_name_snapshot?.trim();
      const quantity = Number(item.quantity ?? 0);

      if (!name || !quantity) {
        return null;
      }

      return `${quantity} × ${name}`;
    })
    .filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

export function buildDeliveryExecutionStops(
  tripOrders: TripOrderRow[],
  orders: OrderRow[]
): DeliveryExecutionStop[] {
  const orderById = new Map(orders.map((order) => [order.id, order]));

  return tripOrders
    .map((row) => {
      const order = orderById.get(row.order_id);

      if (!order) {
        return null;
      }

      const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
      const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
      const delivery = takeSingleRelation<RelatedDelivery>(order.deliveries ?? null);
      const receivedPayments = ((order.payments ?? []) as RelatedPayment[]).filter(
        (payment) => payment.status === RECEIVED_PAYMENT_STATUS
      );
      const paidAmount = receivedPayments.reduce(
        (sum, payment) => sum + Number(payment.amount ?? 0),
        0
      );
      const totalAmount = Number(order.total_amount ?? 0);
      // Con `payment_method_expected = "unknown"` el precio depende del metodo, asi que
      // cada boton de cobro tiene que precargar su propio saldo.
      const isUnknownMethod = order.payment_method_expected === "unknown";
      const cashTotalAmount = isUnknownMethod
        ? calculateItemsTotal(order.order_items, "cash_price")
        : totalAmount;
      const transferTotalAmount = isUnknownMethod
        ? calculateItemsTotal(order.order_items, "transfer_price")
        : totalAmount;
      const addressInput = {
        addressKind: customer?.address_kind ?? "standard",
        addressLine1: customer?.address_line_1 ?? "",
        addressLine2: customer?.address_line_2 ?? "",
        gatedCommunityName: customer?.gated_community_name ?? "",
        locality: customer?.locality ?? ""
      };

      return {
        addressKind: customer?.address_kind ?? "standard",
        addressLine: formatStructuredAddressLine(addressInput),
        addressLine1: customer?.address_line_1 ?? "",
        addressSummary: customer ? formatStructuredAddressSummary(addressInput) : "-",
        cashPaymentBalanceAmount: Math.max(0, cashTotalAmount - paidAmount),
        customerName: customer
          ? formatPersonName(customer.first_name, customer.last_name)
          : reseller?.full_name || "Cliente sin nombre",
        customerPhone: customer?.phone || reseller?.phone || "-",
        deliveryFailureReason: row.released_at
          ? row.stop_failure_reason ?? null
          : delivery?.failure_reason ?? row.stop_failure_reason ?? null,
        deliveryNotes: customer?.delivery_notes || null,
        deliveryStatus: getEffectiveStopStatus(row, order),
        deliveryWindow: formatDeliveryWindow(
          order.delivery_window_start,
          order.delivery_window_end
        ),
        googlePlaceId: customer?.google_place_id || null,
        id: order.id,
        itemsCount: Number(order.items_count ?? 0),
        itemsSummary: summarizeItems(order.order_items),
        locality: [customer?.locality, customer?.administrative_area_level_1]
          .filter(Boolean)
          .join(", "),
        notes: row.released_at
          ? row.stop_note ?? null
          : delivery?.proof_note || row.stop_note || order.notes || null,
        orderNumber: order.order_number ?? null,
        orderStatus: order.status,
        paidAmount,
        paymentBalanceAmount: Math.max(0, totalAmount - paidAmount),
        paymentMethodExpected: order.payment_method_expected,
        paymentStatus: order.payment_status,
        payments: receivedPayments.map((payment) => ({
          amount: Number(payment.amount ?? 0),
          id: payment.id,
          method: String(payment.method),
          receivedByUserId: payment.received_by_user_id ?? null
        })),
        releasedAt: row.released_at,
        resolvedAt: row.resolved_at,
        sequenceNumber: row.sequence_number,
        totalAmount,
        transferPaymentBalanceAmount: Math.max(0, transferTotalAmount - paidAmount),
        tripOrderId: row.id
      } satisfies DeliveryExecutionStop;
    })
    .filter((stop): stop is DeliveryExecutionStop => Boolean(stop));
}

export async function loadDeliveryTripStops(supabase: SupabaseClient, tripId: string) {
  const { data: tripOrders } = await supabase
    .from("delivery_trip_orders")
    .select(TRIP_ORDER_COLUMNS)
    .eq("delivery_trip_id", tripId)
    .order("sequence_number", { ascending: true });

  const rows = (tripOrders ?? []) as TripOrderRow[];
  const orderIds = rows.map((row) => row.order_id);

  if (!orderIds.length) {
    return [];
  }

  const { data: orders } = await supabase.from("orders").select(ORDER_COLUMNS).in("id", orderIds);

  return buildDeliveryExecutionStops(rows, (orders ?? []) as unknown as OrderRow[]);
}

export function summarizeTripProgress(stops: DeliveryExecutionStop[]) {
  const delivered = stops.filter((stop) => stop.deliveryStatus === "delivered").length;
  const failed = stops.filter((stop) => stop.deliveryStatus === "failed").length;
  const pending = stops.filter(
    (stop) => stop.deliveryStatus === "pending" || stop.deliveryStatus === "in_route"
  ).length;

  return {
    collectedAmount: stops.reduce((sum, stop) => sum + stop.paidAmount, 0),
    delivered,
    failed,
    pending,
    resolved: delivered + failed,
    total: stops.length
  };
}

/**
 * Link universal de Google Maps. Con `place_id` el destino es exacto; sin el cae al texto
 * de la direccion, que es donde hoy fallan los domicilios raros.
 */
export function buildNavigationHref(stop: {
  addressLine1: string;
  addressSummary: string;
  googlePlaceId: string | null;
  locality: string;
}) {
  const destination = [stop.addressLine1 || stop.addressSummary, stop.locality]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    api: "1",
    destination: destination || stop.addressSummary
  });

  if (stop.googlePlaceId) {
    params.set("destination_place_id", stop.googlePlaceId);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
