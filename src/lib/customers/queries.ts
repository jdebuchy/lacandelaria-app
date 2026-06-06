import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus, PaymentMethod, PaymentStatus, SalesChannel } from "@/lib/types";

export type CustomerDetail = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  whatsapp_opt_in?: boolean | null;
  whatsapp_opt_out_at?: string | null;
  last_whatsapp_interaction_at?: string | null;
  preferred_contact_channel?: string | null;
  instagram?: string | null;
  address_kind?: "standard" | "gated" | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  gated_community_name?: string | null;
  locality?: string | null;
  administrative_area_level_1?: string | null;
  postal_code?: string | null;
  google_place_id?: string | null;
  google_place_label?: string | null;
  address_source?: "manual" | "google_places" | null;
  delivery_area?: string | null;
  delivery_notes?: string | null;
  source: string;
  created_at: string;
  updated_at?: string | null;
};

export type CustomerOrderRow = {
  id: string;
  sales_channel: SalesChannel;
  items_count: number | string | null;
  total_amount: number | string | null;
  payment_method_expected: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  delivery_date: string | null;
  delivery_area: string | null;
  notes: string | null;
  created_at: string;
  order_items?: Array<{
    product_name_snapshot: string;
    sales_unit_label_snapshot: string;
    quantity: number;
  }> | null;
  payments?: Array<{
    amount: number | string;
    status: string;
  }> | null;
};

function isMissingWhatsappColumns(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42703" || error.code === "PGRST204" || error.message?.includes("schema cache");
}

const CUSTOMER_DETAIL_BASE_SELECT =
  "id, first_name, last_name, phone, instagram, address_kind, address_line_1, address_line_2, gated_community_name, locality, administrative_area_level_1, postal_code, google_place_id, google_place_label, address_source, delivery_area, delivery_notes, source, created_at, updated_at";

const CUSTOMER_DETAIL_WHATSAPP_SELECT = `${CUSTOMER_DETAIL_BASE_SELECT}, whatsapp_phone, whatsapp_opt_in, whatsapp_opt_out_at, last_whatsapp_interaction_at, preferred_contact_channel`;

export async function getCustomerDetail(customerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_DETAIL_WHATSAPP_SELECT)
    .eq("id", customerId)
    .maybeSingle();

  if (isMissingWhatsappColumns(error)) {
    const fallback = await supabase
      .from("customers")
      .select(CUSTOMER_DETAIL_BASE_SELECT)
      .eq("id", customerId)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    if (!fallback.data) {
      return null;
    }

    return {
      ...fallback.data,
      whatsapp_phone: null,
      whatsapp_opt_in: null,
      whatsapp_opt_out_at: null,
      last_whatsapp_interaction_at: null,
      preferred_contact_channel: null,
    } as CustomerDetail;
  }

  if (error) {
    throw error;
  }

  return data as CustomerDetail | null;
}

export async function listOrdersByCustomer(customerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        sales_channel,
        items_count,
        total_amount,
        payment_method_expected,
        payment_status,
        status,
        delivery_date,
        delivery_area,
        notes,
        created_at,
        order_items (
          product_name_snapshot,
          sales_unit_label_snapshot,
          quantity
        ),
        payments (
          amount,
          status
        )
      `
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CustomerOrderRow[];
}
