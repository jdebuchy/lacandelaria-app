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

export type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  salesUnitLabel: string;
  cashPrice: number;
  transferPrice: number;
  active: boolean;
  displayOrder?: number;
};

export type OrderItemInput = {
  productId: string;
  quantity: number;
};

export type OrderItem = {
  id?: string;
  productId: string;
  productName: string;
  salesUnitLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PublicOrderRequestItem = {
  id?: string;
  productId: string;
  productName: string;
  salesUnitLabel: string;
  quantity: number;
  unitPriceSnapshot: number | null;
};

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}
