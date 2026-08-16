/**
 * Formato de fecha, hora y plata para toda la app.
 *
 * Antes habia 21 formateadores de fecha locales repartidos en 15 archivos, la
 * zona horaria escrita a mano ~15 veces, y siete formas distintas de escribir
 * un precio: unas daban "$1.234" y otras "$ 1.234", asi que el mismo monto se
 * veia distinto segun la pantalla. Todo eso vive aca ahora.
 *
 * El modelo a seguir era src/lib/contact.ts, que ya estaba resuelto asi.
 */

export const TIME_ZONE = "America/Argentina/Buenos_Aires";
export const LOCALE = "es-AR";

/** Lo que se muestra cuando un dato opcional no vino. */
const EMPTY = "-";

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Una pieza suelta de la fecha, ya convertida a hora argentina.
 *
 * Existe porque los defaults de es-AR no sirven para un panel denso: mete "de"
 * entre dia, mes y año, y usa reloj de 12 horas con "a. m.". Armar por partes
 * deja el formato en nuestras manos y no en las del locale.
 */
function datePart(
  date: Date,
  type: "day" | "month" | "year" | "hour" | "minute",
  options: Intl.DateTimeFormatOptions = {}
) {
  const base: Intl.DateTimeFormatOptions = {
    hour12: false,
    timeZone: TIME_ZONE,
    ...options
  };
  const config: Intl.DateTimeFormatOptions =
    type === "hour" || type === "minute"
      ? { ...base, hour: "2-digit", minute: "2-digit" }
      : { ...base, [type]: type === "year" ? "numeric" : "2-digit" };

  const parts = new Intl.DateTimeFormat(LOCALE, config).formatToParts(date);

  return parts.find((part) => part.type === type)?.value ?? "";
}

/* -------------------------------------------------------------------------- */
/* Plata                                                                       */
/* -------------------------------------------------------------------------- */

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  currency: "ARS",
  maximumFractionDigits: 0,
  style: "currency"
});

/** Montos en pesos, sin centavos. Ej: "$ 25.000". */
export function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return EMPTY;
  }

  return currencyFormatter.format(value);
}

const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** Cantidades sin simbolo de moneda. Ej: "1.234". */
export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return EMPTY;
  }

  return numberFormatter.format(value);
}

/* -------------------------------------------------------------------------- */
/* Fechas                                                                      */
/* -------------------------------------------------------------------------- */

/** Dia y mes, para columnas de tabla donde el año se sobreentiende. Ej: "15 ago". */
export function formatDateShort(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return EMPTY;
  }

  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE
  });
}

/**
 * Fecha completa, para detalle. Ej: "15 ago 2026".
 *
 * Se arma por partes a proposito: es-AR con año resuelve a "15 de ago de 2026",
 * que en una tabla densa gasta el doble de ancho para decir lo mismo.
 */
export function formatDate(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return EMPTY;
  }

  return `${formatDateShort(date)} ${datePart(date, "year")}`;
}

/** Fecha con dia de la semana, para encabezados de viaje. Ej: "mié, 15 ago". */
export function formatDateWithWeekday(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return EMPTY;
  }

  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
    weekday: "short"
  });
}

/** Fecha y hora. Ej: "15 ago 2026, 14:30". */
export function formatDateTime(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return EMPTY;
  }

  return `${formatDate(date)}, ${formatTime(date)}`;
}

/**
 * Solo la hora, en reloj de 24 horas. Ej: "14:30".
 *
 * es-AR por default devuelve "02:30 p. m.". Nadie en un galpon lee eso: los
 * horarios de reparto se hablan en 24 horas.
 */
export function formatTime(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return EMPTY;
  }

  return `${datePart(date, "hour")}:${datePart(date, "minute")}`;
}

/**
 * Compacto para timelines, donde entran muchas lineas y el año sobra.
 * Ej: "15-08 14:30".
 */
export function formatTimestampCompact(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return EMPTY;
  }

  return `${datePart(date, "day")}-${datePart(date, "month")} ${formatTime(date)}`;
}

/**
 * Ventana de entrega a partir de dos horas sueltas de Postgres ("14:00:00").
 * Ej: "14:00 a 18:00".
 */
export function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return EMPTY;
  }

  return `${start.slice(0, 5)} a ${end.slice(0, 5)}`;
}

/**
 * Fecha en formato ISO corto (YYYY-MM-DD) en hora argentina, para inputs de
 * tipo date y para comparar dias.
 *
 * Reemplaza los trucos que habia dando vueltas de usar los locales "en-CA" y
 * "sv-SE" solo para conseguir este formato.
 */
export function toDateInputValue(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) {
    return "";
  }

  return `${datePart(date, "year")}-${datePart(date, "month")}-${datePart(date, "day")}`;
}

/** El dia de hoy en hora argentina, como YYYY-MM-DD. */
export function todayInputValue() {
  return toDateInputValue(new Date());
}

/* -------------------------------------------------------------------------- */
/* Distancia y duracion (planificacion de rutas)                               */
/* -------------------------------------------------------------------------- */

/** Metros a texto legible. Ej: "850 m", "12,4 km". */
export function formatDistance(meters: number | null | undefined) {
  if (meters == null || Number.isNaN(meters)) {
    return EMPTY;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} km`;
}

/** Segundos a texto legible. Ej: "45 min", "2 h 15 min". */
export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) {
    return EMPTY;
  }

  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
