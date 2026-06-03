function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function composeFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

export function normalizeArgentinaWhatsAppPhone(areaCode: string, localNumber: string) {
  const areaDigits = digitsOnly(areaCode);
  const localDigits = digitsOnly(localNumber);

  return `54${areaDigits}${localDigits}`;
}

export function normalizeArgentinaPhoneInput(value: string) {
  let digits = digitsOnly(value);

  if (!digits) {
    return "";
  }

  if (digits.startsWith("549")) {
    digits = `54${digits.slice(3)}`;
  } else if (digits.startsWith("54")) {
    digits = `54${digits.slice(2).replace(/^0+/, "")}`;
  } else {
    digits = `54${digits.replace(/^0+/, "")}`;
  }

  return digits;
}

export function formatWhatsAppPhone(phone: string) {
  const digits = digitsOnly(phone);

  if (digits.startsWith("54911") && digits.length === 13) {
    return `+54 9 11 ${digits.slice(5, 9)}-${digits.slice(9)}`;
  }

  if (digits.startsWith("54") && digits.length >= 11) {
    const area = digits.slice(2, digits.length - 8);
    const local = digits.slice(-8);
    return `+54 ${area} ${local.slice(0, 4)}-${local.slice(4)}`;
  }

  if (digits.startsWith("54")) {
    return `+${digits}`;
  }

  return phone;
}
