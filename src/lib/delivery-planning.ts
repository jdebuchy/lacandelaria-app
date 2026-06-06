import type { SupabaseClient } from "@supabase/supabase-js";
import { formatStructuredAddressSummary } from "@/lib/address";
import { formatPersonName } from "@/lib/contact";
import type { LogisticsDepot } from "@/lib/logistics-depots";
import { DEFAULT_LOGISTICS_DEPOT_CODE, DEFAULT_LOGISTICS_DEPOT_FALLBACK } from "@/lib/logistics-depots";
import {
  getLogisticsFlowGuidance,
  getLogisticsFlowLabel,
  getLogisticsFlowTone,
  inferLogisticsFlow
} from "@/lib/logistics";
import { formatItemsSummary } from "@/lib/products";
import type {
  DeliveryStatus,
  DeliveryTripStatus,
  PaymentMethod,
  PaymentStatus,
  SalesChannel
} from "@/lib/types";

type RelatedCustomer = {
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  administrative_area_level_1?: string | null;
  delivery_area?: string | null;
  delivery_notes?: string | null;
  first_name?: string | null;
  google_place_id?: string | null;
  gated_community_name?: string | null;
  last_name?: string | null;
  locality?: string | null;
  phone?: string | null;
};

type RelatedDelivery = {
  delivery_status?: DeliveryStatus | null;
  proof_note?: string | null;
};

type RelatedOrderItem = {
  product_name_snapshot: string;
  quantity: number;
  sales_unit_label_snapshot: string;
};

type RelatedReseller = {
  full_name?: string | null;
  phone?: string | null;
};

type TripDriverRow = {
  full_name: string;
  id: string;
};

type RelatedDepotRow = {
  address_line_1: string;
  administrative_area_level_1: string;
  code: string;
  google_place_id?: string | null;
  id: string;
  label: string;
  locality: string;
};

type TripRow = {
  completed_at?: string | null;
  created_at?: string;
  depot_id: string;
  driver_user_id: string | null;
  id: string;
  logistics_depots?: RelatedDepotRow | RelatedDepotRow[] | null;
  notes?: string | null;
  scheduled_date: string;
  started_at?: string | null;
  status: DeliveryTripStatus;
};

type TripOrderRow = {
  id: string;
  order_id: string;
  released_at?: string | null;
  sequence_number: number;
};

type TripOrderWithRelations = {
  customers?: RelatedCustomer | RelatedCustomer[] | null;
  deliveries?: RelatedDelivery | RelatedDelivery[] | null;
  delivery_area?: string | null;
  delivery_date?: string | null;
  delivery_window_end?: string | null;
  delivery_window_start?: string | null;
  id: string;
  items_count?: number | null;
  notes?: string | null;
  order_items?: RelatedOrderItem[] | null;
  payment_method_expected: PaymentMethod;
  payment_status: PaymentStatus;
  reseller_id?: string | null;
  resellers?: RelatedReseller | RelatedReseller[] | null;
  sales_channel?: SalesChannel | null;
  status: string;
  total_amount?: number | string | null;
};

export type DeliveryPlanningDriver = {
  id: string;
  name: string;
};

export type DeliveryPlanningStop = {
  addressLine1: string;
  addressSummary: string;
  administrativeAreaLevel1: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  deliveryDate: string | null;
  deliveryStatus: DeliveryStatus;
  deliveryWindowEnd: string | null;
  deliveryWindowStart: string | null;
  flowGuidance: string;
  flowLabel: string;
  flowTone: "amber" | "emerald" | "sky";
  googlePlaceId: string | null;
  itemsCount: number;
  itemsSummary: string;
  locality: string;
  notes: string | null;
  orderId: string;
  orderStatus: string;
  paymentMethodExpected: PaymentMethod;
  paymentStatus: PaymentStatus;
  resellerName: string | null;
  sequenceNumber: number;
  totalAmount: number;
  tripOrderId: string;
};

export type DeliveryPlanningAvailableOrder = {
  addressLine1: string;
  addressSummary: string;
  administrativeAreaLevel1: string;
  customerName: string;
  deliveryArea: string;
  deliveryDate: string | null;
  deliveryWindowEnd: string | null;
  deliveryWindowStart: string | null;
  googlePlaceId: string | null;
  itemsCount: number;
  itemsSummary: string;
  locality: string;
  orderId: string;
  totalAmount: number;
};

export type DeliveryPlanningTrip = {
  availableOrders: DeliveryPlanningAvailableOrder[];
  completedAt: string | null;
  createdAt: string | null;
  depot: LogisticsDepot;
  driverUserId: string | null;
  id: string;
  notes: string;
  scheduledDate: string;
  startedAt: string | null;
  status: DeliveryTripStatus;
  stops: DeliveryPlanningStop[];
};

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatRouteAddress(customer: RelatedCustomer | null) {
  if (!customer) {
    return "-";
  }

  return formatStructuredAddressSummary({
    addressKind: customer.address_kind ?? "standard",
    addressLine1: customer.address_line_1 ?? "",
    gatedCommunityName: customer.gated_community_name ?? "",
    locality: customer.locality ?? ""
  });
}

function buildPlanningDepot(depot: RelatedDepotRow | null): LogisticsDepot {
  if (!depot) {
    return DEFAULT_LOGISTICS_DEPOT_FALLBACK;
  }

  return {
    addressLine1: depot.address_line_1,
    administrativeAreaLevel1: depot.administrative_area_level_1,
    code: depot.code,
    googlePlaceId: depot.google_place_id ?? null,
    id: depot.id,
    label: depot.label,
    locality: depot.locality
  };
}

function buildPlanningStop(tripOrder: TripOrderRow, order: TripOrderWithRelations): DeliveryPlanningStop {
  const customer = takeSingleRelation(order.customers);
  const reseller = takeSingleRelation(order.resellers);
  const delivery = takeSingleRelation(order.deliveries);
  const items = order.order_items ?? [];
  const flow = inferLogisticsFlow({
    addressLine1: customer?.address_line_1,
    administrativeAreaLevel1: customer?.administrative_area_level_1,
    deliveryArea: order.delivery_area || customer?.delivery_area,
    locality: customer?.locality,
    resellerId: order.reseller_id,
    salesChannel: order.sales_channel
  });

  return {
    addressLine1: customer?.address_line_1 ?? "",
    addressSummary: formatRouteAddress(customer),
    administrativeAreaLevel1: customer?.administrative_area_level_1 ?? "",
    customerName: customer
      ? formatPersonName(customer.first_name, customer.last_name)
      : reseller?.full_name || "Cliente sin nombre",
    customerPhone: customer?.phone || reseller?.phone || "-",
    deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
    deliveryDate: order.delivery_date ?? null,
    deliveryStatus: delivery?.delivery_status || (order.status === "in_route" ? "in_route" : "pending"),
    deliveryWindowEnd: order.delivery_window_end ?? null,
    deliveryWindowStart: order.delivery_window_start ?? null,
    flowGuidance: getLogisticsFlowGuidance(flow),
    flowLabel: getLogisticsFlowLabel(flow),
    flowTone: getLogisticsFlowTone(flow),
    googlePlaceId: customer?.google_place_id ?? null,
    itemsCount: Number(order.items_count ?? 0),
    itemsSummary: formatItemsSummary(items, 3),
    locality: customer?.locality ?? "",
    notes: delivery?.proof_note || order.notes || customer?.delivery_notes || null,
    orderId: order.id,
    orderStatus: order.status,
    paymentMethodExpected: order.payment_method_expected,
    paymentStatus: order.payment_status,
    resellerName: reseller?.full_name || null,
    sequenceNumber: tripOrder.sequence_number,
    totalAmount: Number(order.total_amount ?? 0),
    tripOrderId: tripOrder.id
  };
}

export async function loadDeliveryTripPlanning(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ drivers: DeliveryPlanningDriver[]; trip: DeliveryPlanningTrip | null }> {
  const [driversResult, tripResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["driver", "admin"])
      .eq("active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("delivery_trips")
      .select(
        `
          id,
          depot_id,
          scheduled_date,
          driver_user_id,
          status,
          notes,
          started_at,
          completed_at,
          created_at,
          logistics_depots (
            id,
            code,
            label,
            address_line_1,
            locality,
            administrative_area_level_1,
            google_place_id
          )
        `
      )
      .eq("id", tripId)
      .single()
  ]);
  const drivers = driversResult.data;
  let trip: TripRow | null = tripResult.data ?? null;

  if (tripResult.error) {
    const fallbackTripResult = await supabase
      .from("delivery_trips")
      .select("id, scheduled_date, driver_user_id, status, notes, started_at, completed_at, created_at")
      .eq("id", tripId)
      .single();

    if (!fallbackTripResult.error && fallbackTripResult.data) {
      trip = {
        ...fallbackTripResult.data,
        depot_id: DEFAULT_LOGISTICS_DEPOT_FALLBACK.id,
        logistics_depots: null
      } satisfies TripRow;
    }
  }

  if (!trip) {
    return {
      drivers: (drivers ?? []).map((driver: TripDriverRow) => ({ id: driver.id, name: driver.full_name })),
      trip: null
    };
  }

  const { data: tripOrders } = await supabase
    .from("delivery_trip_orders")
    .select("id, order_id, sequence_number, released_at")
    .eq("delivery_trip_id", tripId)
    .is("released_at", null)
    .order("sequence_number", { ascending: true });

  const orderIds = (tripOrders ?? []).map((item: TripOrderRow) => item.order_id);
  const { data: orders } = orderIds.length
    ? await supabase
        .from("orders")
        .select(
          `
            id,
            sales_channel,
            reseller_id,
            items_count,
            total_amount,
            payment_method_expected,
            payment_status,
            status,
            delivery_date,
            delivery_area,
            delivery_window_start,
            delivery_window_end,
            notes,
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
              delivery_notes,
              google_place_id
            ),
            resellers (
              full_name,
              phone
            ),
            deliveries (
              delivery_status,
              proof_note
            ),
            order_items (
              product_name_snapshot,
              sales_unit_label_snapshot,
              quantity
            )
          `
        )
        .in("id", orderIds)
    : { data: [] };

  const orderById = new Map((orders ?? []).map((order: TripOrderWithRelations) => [order.id, order]));
  const stops = (tripOrders ?? [])
    .map((tripOrder: TripOrderRow) => {
      const order = orderById.get(tripOrder.order_id);
      return order ? buildPlanningStop(tripOrder, order) : null;
    })
    .filter((stop): stop is DeliveryPlanningStop => Boolean(stop));

  const activeOrderIds = new Set((tripOrders ?? []).map((row: TripOrderRow) => row.order_id));
  const [{ data: otherActiveAssignments }, { data: availableOrderRows }] = await Promise.all([
    supabase
      .from("delivery_trip_orders")
      .select("order_id")
      .neq("delivery_trip_id", tripId)
      .is("released_at", null),
    supabase
      .from("orders")
      .select(
        `
          id,
          status,
          total_amount,
          items_count,
          delivery_date,
          delivery_area,
          delivery_window_start,
          delivery_window_end,
          customers (
            first_name,
            last_name,
            address_kind,
            address_line_1,
            locality,
            administrative_area_level_1,
            gated_community_name,
            delivery_area,
            google_place_id
          ),
          resellers (
            full_name
          ),
          order_items (
            product_name_snapshot,
            sales_unit_label_snapshot,
            quantity
          )
        `
      )
      .eq("status", "confirmed")
      .order("delivery_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
  ]);
  const assignedElsewhere = new Set((otherActiveAssignments ?? []).map((row) => row.order_id));
  const availableOrders = (availableOrderRows ?? [])
    .filter((order) => !activeOrderIds.has(order.id) && !assignedElsewhere.has(order.id))
    .map((order) => {
      const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
      const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
      const items = (order.order_items ?? []) as RelatedOrderItem[];

      return {
        addressLine1: customer?.address_line_1 ?? "",
        addressSummary: customer
          ? formatStructuredAddressSummary({
              addressKind: customer.address_kind ?? "standard",
              addressLine1: customer.address_line_1 ?? "",
              gatedCommunityName: customer.gated_community_name ?? "",
              locality: customer.locality ?? ""
            })
          : "-",
        administrativeAreaLevel1: customer?.administrative_area_level_1 ?? "",
        customerName: customer
          ? formatPersonName(customer.first_name, customer.last_name)
          : reseller?.full_name || "Cliente sin nombre",
        deliveryArea: order.delivery_area || customer?.delivery_area || "pending_review",
        deliveryDate: order.delivery_date ?? null,
        deliveryWindowEnd: order.delivery_window_end ?? null,
        deliveryWindowStart: order.delivery_window_start ?? null,
        googlePlaceId: customer?.google_place_id ?? null,
        itemsCount: Number(order.items_count ?? 0),
        itemsSummary: formatItemsSummary(items, 2),
        locality: customer?.locality ?? "",
        orderId: order.id,
        totalAmount: Number(order.total_amount ?? 0)
      } satisfies DeliveryPlanningAvailableOrder;
    });

  return {
    drivers: (drivers ?? []).map((driver: TripDriverRow) => ({ id: driver.id, name: driver.full_name })),
    trip: {
      availableOrders,
      completedAt: trip.completed_at ?? null,
      createdAt: trip.created_at ?? null,
      depot: buildPlanningDepot(takeSingleRelation<RelatedDepotRow>(trip.logistics_depots ?? null)),
      driverUserId: trip.driver_user_id,
      id: trip.id,
      notes: trip.notes ?? "",
      scheduledDate: trip.scheduled_date,
      startedAt: trip.started_at ?? null,
      status: trip.status,
      stops
    }
  };
}

type SaveTripPlanInput = {
  driverUserId: string | null;
  notes: string;
  orderedStopIds: string[];
  scheduledDate: string;
  tripId: string;
};

export async function loadDefaultLogisticsDepot(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("logistics_depots")
    .select("id, code, label, address_line_1, locality, administrative_area_level_1, google_place_id")
    .eq("code", DEFAULT_LOGISTICS_DEPOT_CODE)
    .eq("active", true)
    .single();

  if (error || !data) {
    throw new Error("No se encontró el depósito por defecto.");
  }

  return buildPlanningDepot(data satisfies RelatedDepotRow);
}

export async function saveDeliveryTripPlan(supabase: SupabaseClient, input: SaveTripPlanInput) {
  const { data: trip, error: tripError } = await supabase
    .from("delivery_trips")
    .select("id, status")
    .eq("id", input.tripId)
    .single();

  if (tripError || !trip) {
    throw new Error("No se encontro el viaje.");
  }

  if (trip.status === "completed" || trip.status === "cancelled") {
    throw new Error("Ese viaje ya no admite cambios.");
  }

  if (trip.status !== "assigned") {
    throw new Error("Solo se puede replanificar un viaje antes de iniciarlo.");
  }

  const { data: activeTripOrders, error: activeTripOrdersError } = await supabase
    .from("delivery_trip_orders")
    .select("id, order_id")
    .eq("delivery_trip_id", input.tripId)
    .is("released_at", null);

  if (activeTripOrdersError) {
    throw new Error("No se pudo validar la secuencia del viaje.");
  }

  const activeOrderIds = new Set((activeTripOrders ?? []).map((item) => item.order_id));
  const requestedOrderIds = new Set(input.orderedStopIds);
  const removedOrderIds = [...activeOrderIds].filter((orderId) => !requestedOrderIds.has(orderId));
  const addedOrderIds = input.orderedStopIds.filter((orderId) => !activeOrderIds.has(orderId));

  if (requestedOrderIds.size !== input.orderedStopIds.length) {
    throw new Error("No se puede repetir un pedido en el viaje.");
  }

  if (addedOrderIds.length) {
    const [{ data: candidateOrders, error: candidateOrdersError }, { data: conflictingTrips, error: conflictingTripsError }] =
      await Promise.all([
        supabase.from("orders").select("id, status").in("id", addedOrderIds),
        supabase
          .from("delivery_trip_orders")
          .select("order_id")
          .in("order_id", addedOrderIds)
          .neq("delivery_trip_id", input.tripId)
          .is("released_at", null)
      ]);

    if (candidateOrdersError || conflictingTripsError) {
      throw new Error("No se pudieron validar los pedidos agregados.");
    }

    if ((candidateOrders ?? []).length !== addedOrderIds.length) {
      throw new Error("Hay pedidos agregados que ya no existen.");
    }

    if ((candidateOrders ?? []).some((order) => order.status !== "confirmed" && order.status !== "assigned")) {
      throw new Error("Solo se pueden sumar pedidos confirmados al viaje.");
    }

    if ((conflictingTrips ?? []).length) {
      throw new Error("Hay pedidos que ya pertenecen a otro viaje activo.");
    }
  }

  const { error: tripUpdateError } = await supabase
    .from("delivery_trips")
    .update({
      driver_user_id: input.driverUserId,
      notes: input.notes.trim() || null,
      scheduled_date: input.scheduledDate
    })
    .eq("id", input.tripId);

  if (tripUpdateError) {
    throw new Error("No se pudo actualizar el viaje.");
  }

  if (removedOrderIds.length) {
    const releasedAt = new Date().toISOString();
    const { error: releaseTripOrdersError } = await supabase
      .from("delivery_trip_orders")
      .update({ released_at: releasedAt })
      .eq("delivery_trip_id", input.tripId)
      .in("order_id", removedOrderIds)
      .is("released_at", null);

    if (releaseTripOrdersError) {
      throw new Error("No se pudieron quitar pedidos del viaje.");
    }

    const { error: releaseOrdersError } = await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .in("id", removedOrderIds);

    if (releaseOrdersError) {
      throw new Error("No se pudo devolver un pedido a disponibles.");
    }

    const { error: releaseDeliveriesError } = await supabase
      .from("deliveries")
      .update({
        assigned_date: null,
        driver_user_id: null,
        sequence_number: null
      })
      .in("order_id", removedOrderIds);

    if (releaseDeliveriesError) {
      throw new Error("No se pudo limpiar la asignación de una entrega.");
    }
  }

  if (addedOrderIds.length) {
    const tripRows = addedOrderIds.map((orderId) => ({
      delivery_trip_id: input.tripId,
      order_id: orderId,
      sequence_number: input.orderedStopIds.indexOf(orderId) + 1
    }));
    const { error: addTripOrdersError } = await supabase.from("delivery_trip_orders").insert(tripRows);

    if (addTripOrdersError) {
      throw new Error("No se pudieron agregar pedidos al viaje.");
    }

    const { error: addOrdersError } = await supabase
      .from("orders")
      .update({ status: "assigned" })
      .in("id", addedOrderIds);

    if (addOrdersError) {
      throw new Error("No se pudo actualizar el estado de los pedidos agregados.");
    }

    const { data: existingDeliveries, error: deliveriesFetchError } = await supabase
      .from("deliveries")
      .select("id, order_id")
      .in("order_id", addedOrderIds);

    if (deliveriesFetchError) {
      throw new Error("No se pudieron preparar las entregas nuevas.");
    }

    const deliveryByOrderId = new Map((existingDeliveries ?? []).map((delivery) => [delivery.order_id, delivery.id]));

    for (const orderId of addedOrderIds) {
      const deliveryPayload = {
        assigned_date: input.scheduledDate,
        delivery_status: "pending",
        failure_reason: null,
        driver_user_id: input.driverUserId,
        proof_note: null,
        sequence_number: input.orderedStopIds.indexOf(orderId) + 1
      };
      const deliveryId = deliveryByOrderId.get(orderId);
      const operation = deliveryId
        ? supabase.from("deliveries").update(deliveryPayload).eq("id", deliveryId)
        : supabase.from("deliveries").insert({ order_id: orderId, ...deliveryPayload });
      const { error } = await operation;

      if (error) {
        throw new Error("No se pudo preparar una entrega nueva.");
      }
    }
  }

  for (const [index, orderId] of input.orderedStopIds.entries()) {
    const sequenceNumber = index + 1;
    const { error: tripOrderError } = await supabase
      .from("delivery_trip_orders")
      .update({ sequence_number: sequenceNumber })
      .eq("delivery_trip_id", input.tripId)
      .eq("order_id", orderId)
      .is("released_at", null);

    if (tripOrderError) {
      throw new Error("No se pudo guardar la secuencia del viaje.");
    }

    const { error: deliveryError } = await supabase
      .from("deliveries")
      .update({
        assigned_date: input.scheduledDate,
        driver_user_id: input.driverUserId,
        sequence_number: sequenceNumber
      })
      .eq("order_id", orderId);

    if (deliveryError) {
      throw new Error("No se pudo sincronizar la secuencia de entrega.");
    }
  }
}
