import type {
  DeliveryFailureReason,
  DeliveryStatus,
  DeliveryTripStatus,
  OrderStatus
} from "@/lib/types";

export function getDeliveryTripStatusLabel(status: DeliveryTripStatus) {
  switch (status) {
    case "draft":
      return "Borrador";
    case "assigned":
      return "Asignado";
    case "in_route":
      return "En ruta";
    case "completed":
      return "Completado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export function getOrderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "pending_confirmation":
      return "Pendiente";
    case "confirmed":
      return "Confirmado";
    case "assigned":
      return "Asignado";
    case "in_route":
      return "En ruta";
    case "delivered":
      return "Entregado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export function getDeliveryStatusLabel(status: DeliveryStatus) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "in_route":
      return "En reparto";
    case "delivered":
      return "Entregado";
    case "failed":
      return "Rechazado";
    default:
      return status;
  }
}

export function getDeliveryFailureReasonLabel(reason: DeliveryFailureReason | string | null | undefined) {
  switch (reason) {
    case "customer_absent":
      return "Cliente ausente";
    case "incorrect_address":
      return "Direccion incorrecta";
    case "rejected":
      return "Rechazado";
    case "closed":
      return "Cerrado";
    case "other":
      return "Otro";
    default:
      return reason ?? "Sin motivo";
  }
}

export function canEditOrder(orderStatus: OrderStatus, hasActiveTrip: boolean) {
  if (orderStatus === "in_route" || orderStatus === "delivered" || orderStatus === "cancelled") {
    return false;
  }

  if (orderStatus === "assigned") {
    return true;
  }

  return !hasActiveTrip;
}
