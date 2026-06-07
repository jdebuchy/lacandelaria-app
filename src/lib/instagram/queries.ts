import { createAdminClient } from "@/lib/supabase/admin";

export type InstagramConversationRow = {
  id: string;
  external_thread_id: string | null;
  instagram_scoped_user_id: string;
  instagram_username: string | null;
  customer_id: string | null;
  lead_id: string | null;
  source: string;
  source_detail: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  referral: unknown;
  status: string;
  automation_enabled: boolean;
  assigned_to: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_intent: string | null;
  last_ai_confidence: number | string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    first_name?: string | null;
    instagram?: string | null;
    last_name?: string | null;
    phone?: string | null;
    whatsapp_phone?: string | null;
  } | Array<{
    first_name?: string | null;
    instagram?: string | null;
    last_name?: string | null;
    phone?: string | null;
    whatsapp_phone?: string | null;
  }> | null;
  instagram_messages?: Array<{
    created_at: string;
    direction: string;
    message_type: string;
    text: string | null;
  }> | null;
};

export type InstagramMessageRow = {
  id: string;
  conversation_id: string | null;
  customer_id: string | null;
  external_message_id: string | null;
  direction: string;
  message_type: string;
  text: string | null;
  attachments: unknown;
  raw_payload: unknown;
  meta_response: unknown;
  error: unknown;
  created_at: string;
};

function isMissingInstagramTable(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.code === "42703" || error.message?.includes("schema cache");
}

export async function listInstagramConversations(limit = 100) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("instagram_conversations")
    .select(
      `
        id,
        external_thread_id,
        instagram_scoped_user_id,
        instagram_username,
        customer_id,
        lead_id,
        source,
        source_detail,
        campaign_id,
        adset_id,
        ad_id,
        referral,
        status,
        automation_enabled,
        assigned_to,
        last_message_at,
        last_inbound_at,
        last_outbound_at,
        last_intent,
        last_ai_confidence,
        created_at,
        updated_at,
        customers (
          first_name,
          last_name,
          instagram,
          phone,
          whatsapp_phone
        ),
        instagram_messages (
          text,
          created_at,
          direction,
          message_type
        )
      `
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (isMissingInstagramTable(error)) {
    return [] as InstagramConversationRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as InstagramConversationRow[];
}

export async function listInstagramMessagesByConversation(conversationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("instagram_messages")
    .select("id, conversation_id, customer_id, external_message_id, direction, message_type, text, attachments, raw_payload, meta_response, error, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (isMissingInstagramTable(error)) {
    return [] as InstagramMessageRow[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as InstagramMessageRow[];
}
