function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function splitArgentinaNationalNumber(value: string) {
  const national = value.startsWith("9") && value.length === 11 ? value.slice(1) : value;

  if (national.startsWith("11")) {
    return { area: national.slice(0, 2), local: national.slice(2) };
  }

  if (national.length === 10) {
    return { area: national.slice(0, 4), local: national.slice(4) };
  }

  if (national.length === 9) {
    return { area: national.slice(0, 3), local: national.slice(3) };
  }

  return { area: national.slice(0, 2), local: national.slice(2) };
}

function formatLocalNumber(local: string) {
  if (local.length <= 4) {
    return local;
  }

  return `${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
}

export function composeFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

export function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
  instagram?: string | null
) {
  return composeFullName(firstName ?? "", lastName ?? "") || instagram || "Cliente sin nombre";
}

export function normalizeArgentinaWhatsAppPhone(areaCode: string, localNumber: string) {
  const areaDigits = digitsOnly(areaCode);
  const localDigits = digitsOnly(localNumber);

  return `549${areaDigits}${localDigits}`;
}

export function normalizeArgentinaPhoneInput(value: string) {
  let digits = digitsOnly(value);

  if (!digits) {
    return "";
  }

  if (digits.startsWith("549")) {
    digits = `549${digits.slice(3).replace(/^0+/, "")}`;
  } else if (digits.startsWith("54")) {
    const rest = digits.slice(2).replace(/^0+/, "");
    digits = `54${rest.startsWith("9") ? rest : `9${rest}`}`;
  } else {
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("9") && digits.length === 11) {
      digits = digits.slice(1);
    }
    digits = `549${digits}`;
  }

  return digits;
}

export function formatWhatsAppPhone(phone?: string | null) {
  if (!phone) {
    return "-";
  }

  const digits = digitsOnly(phone);

  if (digits.startsWith("549") && digits.length >= 12) {
    const { area, local } = splitArgentinaNationalNumber(digits.slice(2));
    return `+54 9 ${area} ${formatLocalNumber(local)}`;
  }

  if (digits.startsWith("54") && digits.length >= 11) {
    const { area, local } = splitArgentinaNationalNumber(digits.slice(2));
    return `+54 ${area} ${formatLocalNumber(local)}`;
  }

  if (digits.startsWith("54")) {
    return `+${digits}`;
  }

  return phone;
}

export function buildWhatsAppHref(phone?: string | null, message?: string | null) {
  const normalized = normalizeArgentinaPhoneInput(phone ?? "");

  if (!normalized) {
    return null;
  }

  const text = message?.trim();
  return text
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${normalized}`;
}
