import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateFriendly,
  formatDateShort,
  formatDateTime,
  formatDateTimeFriendly,
  formatDistance,
  formatDuration,
  formatNumber,
  formatTime,
  formatTimeRange,
  formatTimestampCompact,
  toDateInputValue
} from "./format";

describe("formatCurrency", () => {
  // Intl separa el simbolo con espacio duro (U+00A0), no con espacio normal.
  // Es lo correcto tipograficamente: evita que "$" quede colgado al final de
  // una linea. Los tests lo escriben explicito para que nadie lo "arregle".
  const NBSP = " ";

  it("formatea pesos sin centavos", () => {
    expect(formatCurrency(25000)).toBe(`$${NBSP}25.000`);
  });

  it("usa separador de miles argentino", () => {
    expect(formatCurrency(1026000)).toBe(`$${NBSP}1.026.000`);
  });

  it("devuelve guion cuando no hay valor", () => {
    expect(formatCurrency(null)).toBe("-");
    expect(formatCurrency(undefined)).toBe("-");
  });

  it("no rompe con cero", () => {
    expect(formatCurrency(0)).toBe(`$${NBSP}0`);
  });
});

describe("formatNumber", () => {
  it("formatea sin simbolo de moneda", () => {
    expect(formatNumber(1234)).toBe("1.234");
  });
});

describe("fechas", () => {
  // Mediodia UTC para que el dia sea el mismo en UTC y en Buenos Aires (UTC-3),
  // y el test no dependa de donde corre.
  const midday = "2026-08-15T12:00:00.000Z";

  it("formatDateShort da dia y mes", () => {
    expect(formatDateShort(midday)).toBe("15 ago");
  });

  it("formatDate agrega el año", () => {
    expect(formatDate(midday)).toBe("15 ago 2026");
  });

  it("formatDateTime agrega la hora", () => {
    expect(formatDateTime(midday)).toBe("15 ago 2026, 09:00");
  });

  it("formatTime convierte a hora argentina en reloj de 24 horas", () => {
    expect(formatTime(midday)).toBe("09:00");
  });

  it("formatTime no usa a. m. / p. m. en la tarde", () => {
    expect(formatTime("2026-08-15T20:30:00.000Z")).toBe("17:30");
  });

  it("formatTimestampCompact deja fuera el año", () => {
    expect(formatTimestampCompact(midday)).toBe("15-08 09:00");
  });

  it("toDateInputValue da YYYY-MM-DD en hora argentina", () => {
    expect(toDateInputValue(midday)).toBe("2026-08-15");
  });

  it("toDateInputValue respeta la zona horaria en el borde del dia", () => {
    // 02:00 UTC del 16 son todavia las 23:00 del 15 en Buenos Aires.
    expect(toDateInputValue("2026-08-16T02:00:00.000Z")).toBe("2026-08-15");
  });

  it("no corre un dia las fechas sin hora que vienen de Postgres", () => {
    // "2026-06-04" leido como medianoche UTC son las 21:00 del 3 en Buenos
    // Aires. Si esto se rompe, los viajes se muestran un dia antes.
    expect(formatDateShort("2026-06-04")).toBe("4 jun");
    expect(formatDate("2026-06-04")).toBe("4 jun 2026");
    expect(toDateInputValue("2026-06-04")).toBe("2026-06-04");
  });

  it("devuelve guion cuando no hay valor", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
  });

  it("devuelve guion cuando la fecha es invalida", () => {
    expect(formatDate("no es una fecha")).toBe("-");
  });

  it("toDateInputValue devuelve vacio cuando no hay valor", () => {
    expect(toDateInputValue(null)).toBe("");
  });
});

describe("formatDateFriendly", () => {
  // Todo se mide contra este "ahora" fijo para que el test no dependa del reloj.
  const ahora = new Date("2026-08-15T12:00:00.000Z");
  const aLasNueve = (fecha: string) => `${fecha}T12:00:00.000Z`;

  it("nombra hoy, ayer y mañana", () => {
    expect(formatDateFriendly(aLasNueve("2026-08-15"), ahora)).toBe("Hoy");
    expect(formatDateFriendly(aLasNueve("2026-08-14"), ahora)).toBe("Ayer");
    expect(formatDateFriendly(aLasNueve("2026-08-16"), ahora)).toBe("Mañana");
  });

  it("cuenta los dias dentro de la semana", () => {
    expect(formatDateFriendly(aLasNueve("2026-08-12"), ahora)).toBe("Hace 3 días");
    expect(formatDateFriendly(aLasNueve("2026-08-18"), ahora)).toBe("En 3 días");
  });

  it("cuenta hasta seis dias y despues pasa a fecha calendario", () => {
    expect(formatDateFriendly(aLasNueve("2026-08-09"), ahora)).toBe("Hace 6 días");
    expect(formatDateFriendly(aLasNueve("2026-08-08"), ahora)).toBe("8 ago");
    expect(formatDateFriendly(aLasNueve("2026-06-23"), ahora)).toBe("23 jun");
  });

  it("omite el año cuando es el corriente y lo agrega cuando no", () => {
    expect(formatDateFriendly(aLasNueve("2026-01-04"), ahora)).toBe("4 ene");
    expect(formatDateFriendly(aLasNueve("2025-08-04"), ahora)).toBe("4 ago 2025");
  });

  it("trata las fechas sin hora como el dia que dicen ser", () => {
    expect(formatDateFriendly("2026-08-15", ahora)).toBe("Hoy");
    expect(formatDateFriendly("2026-08-16", ahora)).toBe("Mañana");
    expect(formatDateFriendly("2026-06-04", ahora)).toBe("4 jun");
  });

  it("compara dias y no horas", () => {
    // 02:00 UTC del 15 son las 23:00 del 14 en Buenos Aires: sigue siendo ayer,
    // aunque falten diez horas para el "ahora" de referencia.
    expect(formatDateFriendly("2026-08-15T02:00:00.000Z", ahora)).toBe("Ayer");
  });

  it("devuelve guion cuando no hay valor", () => {
    expect(formatDateFriendly(null, ahora)).toBe("-");
    expect(formatDateFriendly("no es una fecha", ahora)).toBe("-");
  });

  it("formatDateTimeFriendly conserva la hora", () => {
    expect(formatDateTimeFriendly(aLasNueve("2026-08-15"), ahora)).toBe("Hoy, 09:00");
    expect(formatDateTimeFriendly(aLasNueve("2026-06-23"), ahora)).toBe("23 jun, 09:00");
  });
});

describe("formatTimeRange", () => {
  it("recorta los segundos de las horas de Postgres", () => {
    expect(formatTimeRange("14:00:00", "18:00:00")).toBe("14:00 a 18:00");
  });

  it("devuelve guion si falta una punta", () => {
    expect(formatTimeRange("14:00:00", null)).toBe("-");
    expect(formatTimeRange(null, "18:00:00")).toBe("-");
  });
});

describe("formatDistance", () => {
  it("usa metros abajo de un kilometro", () => {
    expect(formatDistance(850)).toBe("850 m");
  });

  it("pasa a kilometros con un decimal", () => {
    expect(formatDistance(12400)).toBe("12,4 km");
  });

  it("devuelve guion cuando no hay valor", () => {
    expect(formatDistance(null)).toBe("-");
  });
});

describe("formatDuration", () => {
  it("usa minutos abajo de una hora", () => {
    expect(formatDuration(2700)).toBe("45 min");
  });

  it("combina horas y minutos", () => {
    expect(formatDuration(8100)).toBe("2 h 15 min");
  });

  it("omite los minutos cuando dan cero", () => {
    expect(formatDuration(7200)).toBe("2 h");
  });

  it("devuelve guion cuando no hay valor", () => {
    expect(formatDuration(undefined)).toBe("-");
  });
});
