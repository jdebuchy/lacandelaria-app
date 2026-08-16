import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/lib/types";
import {
  TONE_CLASS,
  deliveryStatusTone,
  deliveryTripStatusTone,
  orderStatusTone,
  paymentStatusTone,
  publicRequestStatusTone
} from "./status-tone";

describe("orderStatusTone", () => {
  it("marca como warn lo que espera a una persona", () => {
    expect(orderStatusTone("pending_confirmation")).toBe("warn");
  });

  it("marca como info todo lo que esta en movimiento", () => {
    expect(orderStatusTone("confirmed")).toBe("info");
    expect(orderStatusTone("assigned")).toBe("info");
    expect(orderStatusTone("in_route")).toBe("info");
  });

  it("separa el cierre bueno del malo", () => {
    expect(orderStatusTone("delivered")).toBe("success");
    expect(orderStatusTone("cancelled")).toBe("danger");
  });

  it("cae en neutral ante un estado desconocido", () => {
    expect(orderStatusTone("un_estado_nuevo")).toBe("neutral");
  });

  it("cubre todos los estados del enum", () => {
    const all: OrderStatus[] = [
      "pending_confirmation",
      "confirmed",
      "assigned",
      "in_route",
      "delivered",
      "cancelled"
    ];

    for (const status of all) {
      expect(orderStatusTone(status)).not.toBe("neutral");
    }
  });
});

describe("paymentStatusTone", () => {
  it("trata el pago parcial como pendiente: todavia falta plata", () => {
    expect(paymentStatusTone("pending")).toBe("warn");
    expect(paymentStatusTone("partial")).toBe("warn");
  });

  it("solo paid es success", () => {
    expect(paymentStatusTone("paid")).toBe("success");
  });
});

describe("deliveryTripStatusTone", () => {
  it("draft no reclama atencion todavia", () => {
    expect(deliveryTripStatusTone("draft")).toBe("neutral");
  });

  it("assigned e in_route estan en movimiento", () => {
    expect(deliveryTripStatusTone("assigned")).toBe("info");
    expect(deliveryTripStatusTone("in_route")).toBe("info");
  });

  it("completed y cancelled cierran", () => {
    expect(deliveryTripStatusTone("completed")).toBe("success");
    expect(deliveryTripStatusTone("cancelled")).toBe("danger");
  });
});

describe("deliveryStatusTone", () => {
  it("una parada fallida es danger, no neutral", () => {
    expect(deliveryStatusTone("failed")).toBe("danger");
  });

  it("una parada pendiente no alarma", () => {
    expect(deliveryStatusTone("pending")).toBe("neutral");
  });
});

describe("publicRequestStatusTone", () => {
  it("una solicitud nueva pide accion", () => {
    expect(publicRequestStatusTone("new")).toBe("warn");
  });

  it("convertida es el final feliz", () => {
    expect(publicRequestStatusTone("converted")).toBe("success");
  });
});

describe("TONE_CLASS", () => {
  it("define los cinco tonos", () => {
    expect(Object.keys(TONE_CLASS)).toEqual(["neutral", "warn", "info", "success", "danger"]);
  });

  it("cada tono trae borde, fondo y texto", () => {
    for (const classes of Object.values(TONE_CLASS)) {
      expect(classes).toMatch(/border-/);
      expect(classes).toMatch(/bg-/);
      expect(classes).toMatch(/text-/);
    }
  });
});
