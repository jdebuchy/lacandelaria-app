import { describe, expect, it } from "vitest";
import {
  buildWhatsAppHref,
  composeFullName,
  formatPersonName,
  formatWhatsAppPhone,
  normalizeArgentinaPhoneInput,
  normalizeArgentinaWhatsAppPhone,
  normalizeInstagramUsername
} from "@/lib/contact";

describe("contact", () => {
  it("composes and formats person names", () => {
    expect(composeFullName(" Juan ", "  Perez ")).toBe("Juan Perez");
    expect(formatPersonName("", "", "lacandelaria")).toBe("lacandelaria");
    expect(formatPersonName("", "", "")).toBe("Cliente sin nombre");
  });

  it("normalizes Argentina WhatsApp phones from area and local numbers", () => {
    expect(normalizeArgentinaWhatsAppPhone("011", "15-1234-5678")).toBe("5490111512345678");
  });

  it("normalizes Argentina phone inputs to WhatsApp format", () => {
    expect(normalizeArgentinaPhoneInput("(11) 1234-5678")).toBe("5491112345678");
    expect(normalizeArgentinaPhoneInput("011 1234-5678")).toBe("5491112345678");
    expect(normalizeArgentinaPhoneInput("+54 11 1234-5678")).toBe("5491112345678");
    expect(normalizeArgentinaPhoneInput("+54 9 11 1234-5678")).toBe("5491112345678");
    expect(normalizeArgentinaPhoneInput("")).toBe("");
  });

  it("formats WhatsApp phones for display", () => {
    expect(formatWhatsAppPhone("5491112345678")).toBe("+54 9 11 1234-5678");
    expect(formatWhatsAppPhone("541112345678")).toBe("+54 11 1234-5678");
    expect(formatWhatsAppPhone(null)).toBe("-");
    expect(formatWhatsAppPhone("abc")).toBe("abc");
  });

  it("builds WhatsApp links with encoded messages", () => {
    expect(buildWhatsAppHref("11 1234-5678")).toBe("https://wa.me/5491112345678");
    expect(buildWhatsAppHref("11 1234-5678", "Hola, quiero comprar")).toBe(
      "https://wa.me/5491112345678?text=Hola%2C%20quiero%20comprar"
    );
    expect(buildWhatsAppHref("")).toBeNull();
  });

  it("normalizes Instagram usernames", () => {
    expect(normalizeInstagramUsername("  @@LaCandelaria  ")).toBe("lacandelaria");
    expect(normalizeInstagramUsername(null)).toBe("");
  });
});
