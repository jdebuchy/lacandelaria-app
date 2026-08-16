import type {
  DeliveryStatus,
  DeliveryTripStatus,
  OrderStatus,
  PaymentStatus,
  PublicOrderRequestStatus
} from "@/lib/types";

/**
 * Estado -> tono semantico.
 *
 * Antes habia ocho funciones locales haciendo este mapeo, cada una privada de
 * su archivo, con dos convenciones de color incompatibles y una divergencia
 * real: "Entregado" era stone-400 en el listado de pedidos y stone-300 en el
 * detalle del mismo pedido.
 *
 * La idea de fondo: no hay un color por estado, hay un tono por *significado*.
 * Cinco tonos alcanzan para los cinco enums de estado que tiene la app, y eso
 * es lo que hace que el sistema se sostenga cuando mañana aparezca un estado
 * nuevo. Los valores viven en globals.css.
 */
export type Tone = "neutral" | "warn" | "info" | "success" | "danger";

/**
 * Cuanto tiene que gritar un estado.
 *
 * Sale de mirar la tabla de pedidos con datos reales: 50 filas diciendo
 * "Entregado", cada una con su caja de color. Si todo esta resaltado, nada lo
 * esta, y el ojo termina barriendo 50 iguales para encontrar las tres que
 * necesitan algo.
 *
 *   loud  pide que alguien haga algo. Lleva caja.
 *   soft  esta pasando algo, no requiere accion. Punto de color y texto.
 *   flat  es el curso normal de las cosas. Texto y nada mas.
 *
 * Vive aca y no en cada pantalla, por la misma razon que los tonos: si esto se
 * decide pantalla por pantalla, en tres meses el mismo estado se ve de dos
 * formas distintas segun donde lo mires.
 */
export type Prominence = "loud" | "soft" | "flat";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-neutral-line bg-neutral-bg text-neutral-fg",
  warn: "border-warn-line bg-warn-bg text-warn-fg",
  info: "border-info-line bg-info-bg text-info-fg",
  success: "border-success-line bg-success-bg text-success-fg",
  danger: "border-danger-line bg-danger-bg text-danger-fg"
};

/** Solo el color de texto, para numeros de KPI y puntos de estado. */
export const TONE_TEXT_CLASS: Record<Tone, string> = {
  neutral: "text-ink",
  warn: "text-warn-fg",
  info: "text-info-fg",
  success: "text-success-fg",
  danger: "text-danger-fg"
};

/**
 * warn  = necesita que alguien haga algo
 * info  = esta en movimiento, no requiere accion
 * success = cerro bien
 * danger  = cerro mal
 */
export function orderStatusTone(status: OrderStatus | string): Tone {
  switch (status) {
    case "pending_confirmation":
      return "warn";
    case "confirmed":
    case "assigned":
    case "in_route":
      return "info";
    case "delivered":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function orderStatusProminence(status: OrderStatus | string): Prominence {
  switch (status) {
    // Esperan a una persona: son las filas que hay que encontrar.
    case "pending_confirmation":
    case "cancelled":
      return "loud";
    // Estan en movimiento solas.
    case "confirmed":
    case "assigned":
    case "in_route":
      return "soft";
    // El final feliz es el 90% de la tabla. No necesita anunciarse.
    case "delivered":
      return "flat";
    default:
      return "flat";
  }
}

export function paymentStatusProminence(status: PaymentStatus | string): Prominence {
  switch (status) {
    case "pending":
    case "partial":
      return "loud";
    default:
      return "flat";
  }
}

export function deliveryStatusProminence(status: DeliveryStatus | string): Prominence {
  switch (status) {
    case "failed":
      return "loud";
    case "in_route":
      return "soft";
    default:
      return "flat";
  }
}

export function deliveryTripStatusProminence(status: DeliveryTripStatus | string): Prominence {
  switch (status) {
    case "cancelled":
      return "loud";
    case "assigned":
    case "in_route":
      return "soft";
    default:
      return "flat";
  }
}

export function paymentStatusTone(status: PaymentStatus | string): Tone {
  switch (status) {
    case "pending":
    case "partial":
      return "warn";
    case "paid":
      return "success";
    default:
      return "neutral";
  }
}

export function deliveryTripStatusTone(status: DeliveryTripStatus | string): Tone {
  switch (status) {
    case "draft":
      return "neutral";
    case "assigned":
    case "in_route":
      return "info";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function deliveryStatusTone(status: DeliveryStatus | string): Tone {
  switch (status) {
    case "pending":
      return "neutral";
    case "in_route":
      return "info";
    case "delivered":
      return "success";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function publicRequestStatusTone(status: PublicOrderRequestStatus | string): Tone {
  switch (status) {
    case "new":
      return "warn";
    case "reviewed":
      return "info";
    case "converted":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}
