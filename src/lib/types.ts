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

export type ProductVariantVisibility = "sellable" | "internal";

export type ProductVariantCompositionType = "simple" | "bundle";

export type ProductVariantComponent = {
  componentVariantId: string;
  componentFamilyName: string;
  componentLabel: string;
  quantity: number;
};

export type ProductVariant = {
  id: string;
  familyId: string;
  familyName: string;
  familySlug: string;
  label: string;
  slug: string;
  description?: string | null;
  cashPrice: number;
  transferPrice: number;
  active: boolean;
  displayOrder: number;
  visibility: ProductVariantVisibility;
  compositionType: ProductVariantCompositionType;
  isDefault: boolean;
  components: ProductVariantComponent[];
};

export type ProductFamily = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  displayOrder: number;
  defaultVariantId?: string | null;
  variants: ProductVariant[];
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
