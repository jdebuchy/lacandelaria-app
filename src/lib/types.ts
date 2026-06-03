export type UserRole = "admin" | "seller" | "driver" | "collector";

export type PaymentMethod = "cash" | "transfer";

export type SalesChannel = "internal" | "public_form" | "reseller";

export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "assigned"
  | "in_route"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "partial" | "paid";

export type PublicOrderRequestStatus = "new" | "reviewed" | "converted" | "rejected";

export type DeliveryStatus = "pending" | "in_route" | "delivered" | "failed";

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}
