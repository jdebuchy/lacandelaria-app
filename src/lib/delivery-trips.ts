import type { DeliveryStatus, DeliveryTripStatus, OrderStatus } from "@/lib/types";

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

export function canEditOrder(orderStatus: OrderStatus, hasActiveTrip: boolean) {
  if (hasActiveTrip) {
    return false;
  }

  return orderStatus !== "delivered" && orderStatus !== "cancelled";
}
