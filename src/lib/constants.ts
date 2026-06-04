export const APP_NAME = "La Candelaria";

export const BUSINESS_RULES = {
  resellerCommissionRate: 0.15
} as const;

export const ORDER_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "assigned",
  "in_route",
  "delivered",
  "cancelled"
] as const;

export const PAYMENT_METHODS = ["cash", "transfer"] as const;

export const SALES_CHANNELS = ["internal", "public_form", "reseller"] as const;

export const DELIVERY_TRIP_STATUSES = [
  "draft",
  "assigned",
  "in_route",
  "completed",
  "cancelled"
] as const;
