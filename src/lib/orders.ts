const MISSING_ORDER_NUMBER_LABEL = "#—";
const MISSING_TRIP_NUMBER_LABEL = "Viaje sin número";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type DeliveryWindowResult =
  | { end: string | null; ok: true; start: string | null }
  | { message: string; ok: false };

/**
 * PostgREST devuelve bigint como string cuando el valor no entra en un number
 * seguro, asi que aceptamos las dos formas.
 */
function toPositiveInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function formatOrderNumber(value: number | string | null | undefined) {
  const orderNumber = toPositiveInteger(value);

  return orderNumber === null ? MISSING_ORDER_NUMBER_LABEL : `#${orderNumber}`;
}

export function formatTripNumber(value: number | string | null | undefined) {
  const tripNumber = toPositiveInteger(value);

  return tripNumber === null ? MISSING_TRIP_NUMBER_LABEL : `Viaje ${tripNumber}`;
}

/**
 * Busca por numero exacto: escribir "1" no debe traer el pedido 12.
 */
export function matchesOrderNumberQuery(
  query: string,
  orderNumber: number | string | null | undefined
) {
  const target = toPositiveInteger(orderNumber);

  if (target === null) {
    return false;
  }

  const normalizedQuery = query.trim().replace(/^#/, "");

  if (!/^\d+$/.test(normalizedQuery)) {
    return false;
  }

  return Number(normalizedQuery) === target;
}

/**
 * Regla unica de la franja de entrega, alineada con el check constraint
 * orders_delivery_window_range_check: ambas horas o ninguna, y start <= end.
 */
export function normalizeDeliveryWindow(
  start: string | null | undefined,
  end: string | null | undefined
): DeliveryWindowResult {
  const normalizedStart = (start ?? "").trim();
  const normalizedEnd = (end ?? "").trim();

  if (!normalizedStart && !normalizedEnd) {
    return { end: null, ok: true, start: null };
  }

  if (!normalizedStart || !normalizedEnd) {
    return {
      message: "Completa ambas horas de entrega o deja ambas vacías.",
      ok: false
    };
  }

  if (!TIME_PATTERN.test(normalizedStart) || !TIME_PATTERN.test(normalizedEnd)) {
    return {
      message: "Ingresa las horas de entrega en formato HH:MM.",
      ok: false
    };
  }

  if (normalizedStart > normalizedEnd) {
    return {
      message: "La franja horaria es inválida.",
      ok: false
    };
  }

  return { end: normalizedEnd, ok: true, start: normalizedStart };
}
