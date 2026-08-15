import { describe, expect, it } from "vitest";
import {
  buildDeliveryExecutionStops,
  buildNavigationHref,
  formatDeliveryWindow,
  getEffectiveStopStatus,
  summarizeTripProgress
} from "@/lib/delivery-execution";

function tripOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "stop-1",
    order_id: "order-1",
    released_at: null,
    resolved_at: null,
    sequence_number: 1,
    stop_failure_reason: null,
    stop_note: null,
    stop_status: null,
    ...overrides
  } as never;
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    customers: {
      address_kind: "standard",
      address_line_1: "Belgrano 890",
      address_line_2: "2B",
      administrative_area_level_1: "CABA",
      delivery_notes: "Dejar en portería",
      first_name: "Carlos",
      google_place_id: "place-belgrano",
      last_name: "López",
      locality: "Palermo",
      phone: "1145678901"
    },
    deliveries: null,
    id: "order-1",
    items_count: 2,
    order_items: [
      {
        product_name_snapshot: "Palta Hass 5kg",
        product_variants: { cash_price: 20000, transfer_price: 24000 },
        quantity: 2
      }
    ],
    order_number: 128,
    payment_method_expected: "cash",
    payment_status: "pending",
    payments: [],
    status: "assigned",
    total_amount: 40000,
    ...overrides
  } as never;
}

describe("buildDeliveryExecutionStops", () => {
  it("expone un saldo distinto por metodo cuando el pedido todavia no fijo el precio", () => {
    const [stop] = buildDeliveryExecutionStops(
      [tripOrder()],
      [order({ payment_method_expected: "unknown", total_amount: 0 })]
    );

    expect(stop.cashPaymentBalanceAmount).toBe(40000);
    expect(stop.transferPaymentBalanceAmount).toBe(48000);
  });

  it("usa el total del pedido cuando el metodo ya esta definido", () => {
    const [stop] = buildDeliveryExecutionStops([tripOrder()], [order()]);

    expect(stop.cashPaymentBalanceAmount).toBe(40000);
    expect(stop.transferPaymentBalanceAmount).toBe(40000);
  });

  it("descuenta los pagos recibidos e ignora los anulados", () => {
    const [stop] = buildDeliveryExecutionStops(
      [tripOrder()],
      [
        order({
          payments: [
            { amount: 15000, id: "pay-1", method: "cash", received_by_user_id: "user-1", status: "received" },
            { amount: 25000, id: "pay-2", method: "cash", received_by_user_id: "user-1", status: "rejected" }
          ]
        })
      ]
    );

    expect(stop.paidAmount).toBe(15000);
    expect(stop.paymentBalanceAmount).toBe(25000);
    expect(stop.payments).toHaveLength(1);
    expect(stop.payments[0].id).toBe("pay-1");
  });

  it("nunca devuelve saldo negativo si se cobro de mas", () => {
    const [stop] = buildDeliveryExecutionStops(
      [tripOrder()],
      [
        order({
          payments: [
            { amount: 50000, id: "pay-1", method: "cash", received_by_user_id: "user-1", status: "received" }
          ]
        })
      ]
    );

    expect(stop.paymentBalanceAmount).toBe(0);
    expect(stop.cashPaymentBalanceAmount).toBe(0);
  });

  it("arma la direccion, el resumen de items y el numero de pedido", () => {
    const [stop] = buildDeliveryExecutionStops([tripOrder()], [order()]);

    expect(stop.addressLine).toBe("Belgrano 890, 2B");
    expect(stop.itemsSummary).toBe("2 × Palta Hass 5kg");
    expect(stop.orderNumber).toBe(128);
    expect(stop.customerName).toBe("Carlos López");
    expect(stop.deliveryNotes).toBe("Dejar en portería");
  });

  it("identifica la parada por su fila del viaje, no por el pedido", () => {
    const stops = buildDeliveryExecutionStops(
      [
        tripOrder({ id: "stop-a", released_at: "2026-08-15T10:00:00Z", stop_status: "failed" }),
        tripOrder({ id: "stop-b", sequence_number: 7 })
      ],
      [order()]
    );

    expect(stops.map((stop) => stop.tripOrderId)).toEqual(["stop-a", "stop-b"]);
    expect(stops.map((stop) => stop.deliveryStatus)).toEqual(["failed", "pending"]);
  });

  it("descarta paradas cuyo pedido no vino en la consulta", () => {
    expect(buildDeliveryExecutionStops([tripOrder({ order_id: "otro" })], [order()])).toEqual([]);
  });
});

describe("getEffectiveStopStatus", () => {
  it("conserva el resultado historico de una parada liberada", () => {
    expect(
      getEffectiveStopStatus(
        { released_at: "2026-08-15T12:00:00Z", stop_status: "failed" },
        { deliveries: { delivery_status: "pending" } } as never
      )
    ).toBe("failed");
  });

  it("asume no entregada si la parada se libero sin resultado", () => {
    expect(getEffectiveStopStatus({ released_at: "2026-08-15T12:00:00Z", stop_status: null }, undefined)).toBe(
      "failed"
    );
  });

  it("prioriza deliveries mientras la parada sigue activa", () => {
    expect(
      getEffectiveStopStatus(
        { released_at: null, stop_status: "pending" },
        { deliveries: { delivery_status: "delivered" } } as never
      )
    ).toBe("delivered");
  });
});

describe("summarizeTripProgress", () => {
  it("cuenta resueltas y total cobrado", () => {
    const stops = buildDeliveryExecutionStops(
      [tripOrder(), tripOrder({ id: "stop-2", order_id: "order-2", sequence_number: 2 })],
      [
        order({
          deliveries: { delivery_status: "delivered" },
          payments: [
            { amount: 40000, id: "pay-1", method: "cash", received_by_user_id: "user-1", status: "received" }
          ]
        }),
        order({ id: "order-2" })
      ]
    );

    expect(summarizeTripProgress(stops)).toMatchObject({
      collectedAmount: 40000,
      delivered: 1,
      failed: 0,
      pending: 1,
      resolved: 1,
      total: 2
    });
  });
});

describe("buildNavigationHref", () => {
  it("usa el place id cuando existe", () => {
    const href = buildNavigationHref({
      addressLine1: "Belgrano 890",
      addressSummary: "Belgrano 890 · Palermo",
      googlePlaceId: "place-belgrano",
      locality: "Palermo, CABA"
    });

    expect(href).toContain("destination_place_id=place-belgrano");
    expect(href).toContain("destination=Belgrano+890%2C+Palermo%2C+CABA");
  });

  it("cae al texto de la direccion sin place id", () => {
    const href = buildNavigationHref({
      addressLine1: "Belgrano 890",
      addressSummary: "Belgrano 890 · Palermo",
      googlePlaceId: null,
      locality: "Palermo"
    });

    expect(href).not.toContain("destination_place_id");
  });
});

describe("formatDeliveryWindow", () => {
  it("recorta los segundos de las columnas time", () => {
    expect(formatDeliveryWindow("10:00:00", "13:00:00")).toBe("10:00 a 13:00");
  });

  it("devuelve null si falta alguna punta", () => {
    expect(formatDeliveryWindow("10:00:00", null)).toBeNull();
    expect(formatDeliveryWindow(null, null)).toBeNull();
  });
});
