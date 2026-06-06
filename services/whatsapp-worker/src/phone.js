export function normalizeWhatsappPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("549")) {
    return digits;
  }

  if (digits.startsWith("54")) {
    return `549${digits.slice(2)}`;
  }

  if (digits.startsWith("9") && digits.length >= 11) {
    return `54${digits}`;
  }

  return `549${digits}`;
}

export function toWhatsappChatId(phone) {
  const normalized = normalizeWhatsappPhone(phone);
  return normalized ? `${normalized}@c.us` : "";
}
