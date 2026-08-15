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
