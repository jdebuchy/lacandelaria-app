export function normalizeWhatsappPhone(value) {
  const rawIdentifier = String(value ?? "")
    .split("@")[0]
    .split(":")[0]
    .split("-")[0];
  const digits = rawIdentifier.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("549")) {
    return normalizeArgentinaPhoneLength(digits);
  }

  if (digits.startsWith("54")) {
    return normalizeArgentinaPhoneLength(`549${digits.slice(2)}`);
  }

  if (digits.startsWith("9") && digits.length >= 11) {
    return normalizeArgentinaPhoneLength(`54${digits}`);
  }

  return normalizeArgentinaPhoneLength(`549${digits}`);
}

function normalizeArgentinaPhoneLength(phone) {
  // Argentine mobile numbers are normally 13 digits including 54 + 9.
  // Longer values are usually WhatsApp internal IDs or device suffixes.
  return phone.length >= 11 && phone.length <= 13 ? phone : "";
}

export function toWhatsappChatId(phone) {
  const normalized = normalizeWhatsappPhone(phone);
  return normalized ? `${normalized}@c.us` : "";
}

export function phonesMatch(left, right) {
  const normalizedLeft = normalizeWhatsappPhone(left);
  const normalizedRight = normalizeWhatsappPhone(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
