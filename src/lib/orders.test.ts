import { describe, expect, it } from "vitest";
import {
  formatOrderNumber,
  formatTripNumber,
  matchesOrderNumberQuery,
  normalizeDeliveryWindow
} from "@/lib/orders";

describe("formatOrderNumber", () => {
  it("prefixes the number with a hash", () => {
    expect(formatOrderNumber(1)).toBe("#1");
    expect(formatOrderNumber(42)).toBe("#42");
    expect(formatOrderNumber(1234)).toBe("#1234");
  });

  it("accepts the string that PostgREST returns for bigint", () => {
    expect(formatOrderNumber("12")).toBe("#12");
  });

  it("falls back to a placeholder when there is no number", () => {
    expect(formatOrderNumber(null)).toBe("#—");
    expect(formatOrderNumber(undefined)).toBe("#—");
    expect(formatOrderNumber("")).toBe("#—");
    expect(formatOrderNumber("abc")).toBe("#—");
  });
});

describe("formatTripNumber", () => {
  it("labels the trip with its number", () => {
    expect(formatTripNumber(7)).toBe("Viaje 7");
  });

  it("falls back when the trip has no number", () => {
    expect(formatTripNumber(null)).toBe("Viaje sin número");
  });
});

describe("matchesOrderNumberQuery", () => {
  it("matches the exact number with or without the hash", () => {
    expect(matchesOrderNumberQuery("12", 12)).toBe(true);
    expect(matchesOrderNumberQuery("#12", 12)).toBe(true);
    expect(matchesOrderNumberQuery("  12  ", 12)).toBe(true);
  });

  it("does not match on prefixes", () => {
    expect(matchesOrderNumberQuery("1", 12)).toBe(false);
    expect(matchesOrderNumberQuery("2", 12)).toBe(false);
  });

  it("ignores queries that are not numbers", () => {
    expect(matchesOrderNumberQuery("ana", 12)).toBe(false);
    expect(matchesOrderNumberQuery("", 12)).toBe(false);
    expect(matchesOrderNumberQuery("#", 12)).toBe(false);
  });

  it("never matches when the order has no number", () => {
    expect(matchesOrderNumberQuery("12", null)).toBe(false);
  });
});

describe("normalizeDeliveryWindow", () => {
  it("accepts both values empty", () => {
    expect(normalizeDeliveryWindow("", "")).toEqual({ end: null, ok: true, start: null });
    expect(normalizeDeliveryWindow(undefined, undefined)).toEqual({ end: null, ok: true, start: null });
  });

  it("accepts a valid range", () => {
    expect(normalizeDeliveryWindow("10:00", "14:00")).toEqual({
      end: "14:00",
      ok: true,
      start: "10:00"
    });
  });

  it("accepts a range that starts and ends at the same time", () => {
    expect(normalizeDeliveryWindow("10:00", "10:00")).toEqual({
      end: "10:00",
      ok: true,
      start: "10:00"
    });
  });

  it("rejects filling only one of the two values", () => {
    expect(normalizeDeliveryWindow("10:00", "")).toEqual({
      message: "Completa ambas horas de entrega o deja ambas vacías.",
      ok: false
    });
    expect(normalizeDeliveryWindow("", "14:00")).toEqual({
      message: "Completa ambas horas de entrega o deja ambas vacías.",
      ok: false
    });
  });

  it("rejects an inverted range", () => {
    expect(normalizeDeliveryWindow("14:00", "10:00")).toEqual({
      message: "La franja horaria es inválida.",
      ok: false
    });
  });

  it("rejects values that are not HH:MM", () => {
    expect(normalizeDeliveryWindow("25:00", "26:00").ok).toBe(false);
    expect(normalizeDeliveryWindow("9:5", "10:00").ok).toBe(false);
    expect(normalizeDeliveryWindow("manana", "tarde").ok).toBe(false);
    expect(normalizeDeliveryWindow("10:60", "11:00").ok).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(normalizeDeliveryWindow(" 10:00 ", " 14:00 ")).toEqual({
      end: "14:00",
      ok: true,
      start: "10:00"
    });
  });
});
