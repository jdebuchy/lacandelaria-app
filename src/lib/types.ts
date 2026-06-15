export type UserRole = "admin" | "seller" | "driver" | "collector";

export type PaymentMethod = "cash" | "transfer";
export type ExpectedPaymentMethod = PaymentMethod | "unknown";

export type SalesChannel = "internal" | "public_form" | "reseller" | "whatsapp_ai" | "instagram_ai";

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

export type DeliveryTripStatus = "draft" | "assigned" | "in_route" | "completed" | "cancelled";

export type DeliveryFailureReason =
  | "customer_absent"
  | "incorrect_address"
  | "rejected"
  | "closed"
  | "other";

export type WhatsappConversationStatus =
  | "idle"
  | "satisfaction_followup_sent"
  | "satisfaction_answered"
  | "reactivation_sent"
  | "interested_in_buying"
  | "collecting_order_data"
  | "waiting_for_confirmation"
  | "order_created"
  | "needs_human"
  | "opted_out"
  | "closed";

export type WhatsappMessageType =
  | "satisfaction_check"
  | "reactivation_offer"
  | "transactional_reply"
  | "order_confirmation"
  | "human_handoff"
  | "opt_out_confirmation";

export type WhatsappQueueStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

export type WhatsappMessageDirection = "inbound" | "outbound";

export type WhatsappAiIntent =
  | "satisfied"
  | "complaint"
  | "buy"
  | "ask_price"
  | "ask_delivery"
  | "ask_products"
  | "confirm_order"
  | "modify_order"
  | "cancel_order"
  | "not_interested"
  | "not_now"
  | "opt_out"
  | "unknown";

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
