export const APP_NAME = "Paltas La Candelaria";

export const BUSINESS_RULES = {
  cashPrice: 25000,
  transferPrice: 30000,
  resellerCommissionRate: 0.15,
  salesUnit: "Caja de 4 kg"
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
