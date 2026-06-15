import { describe, expect, it } from "vitest";
import {
  buildPaymentSummary,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  resolvePaymentStatus
} from "@/lib/payments";

describe("payments", () => {
  describe("resolvePaymentStatus", () => {
    it("marks unpaid orders as pending", () => {
      expect(resolvePaymentStatus(10000, 0)).toBe("pending");
      expect(resolvePaymentStatus(10000, -100)).toBe("pending");
    });

    it("marks underpaid orders as partial", () => {
      expect(resolvePaymentStatus(10000, 9999)).toBe("partial");
    });

    it("marks fully paid or overpaid orders as paid", () => {
      expect(resolvePaymentStatus(10000, 10000)).toBe("paid");
      expect(resolvePaymentStatus(10000, 12000)).toBe("paid");
    });
  });

  describe("buildPaymentSummary", () => {
    it("rounds amounts and calculates the remaining balance", () => {
      expect(buildPaymentSummary(1000.105, 250.104)).toEqual({
        balanceAmount: 750.01,
        paidAmount: 250.1,
        paymentStatus: "partial",
        totalAmount: 1000.11
      });
    });

    it("does not return a negative balance when the order is overpaid", () => {
      expect(buildPaymentSummary(1000, 1200)).toEqual({
        balanceAmount: 0,
        paidAmount: 1200,
        paymentStatus: "paid",
        totalAmount: 1000
      });
    });
  });

  it("returns payment method labels and falls back to unknown values", () => {
    expect(getPaymentMethodLabel("transfer")).toBe("Transferencia");
    expect(getPaymentMethodLabel("cash")).toBe("Efectivo");
    expect(getPaymentMethodLabel("unknown")).toBe("No definido");
    expect(getPaymentMethodLabel("crypto")).toBe("crypto");
  });

  it("returns payment status labels and falls back to unknown values", () => {
    expect(getPaymentStatusLabel("paid")).toBe("Pagado");
    expect(getPaymentStatusLabel("partial")).toBe("Parcial");
    expect(getPaymentStatusLabel("pending")).toBe("Pendiente");
    expect(getPaymentStatusLabel("refunded")).toBe("refunded");
  });
});
