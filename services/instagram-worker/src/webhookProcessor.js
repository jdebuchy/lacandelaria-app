import crypto from "node:crypto";
import { config } from "./config.js";
import { supabase } from "./supabase.js";

function headersToObject(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : String(value ?? "")
    ])
  );
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getEventId(entry, messagingEvent) {
  return (
    messagingEvent?.message?.mid ??
    messagingEvent?.postback?.mid ??
    messagingEvent?.read?.watermark ??
    messagingEvent?.delivery?.watermark ??
    `${entry?.id ?? "entry"}:${messagingEvent?.sender?.id ?? "unknown"}:${messagingEvent?.timestamp ?? stableHash(messagingEvent)}`
  );
}

function getReferral(messagingEvent) {
  return messagingEvent?.referral ?? messagingEvent?.message?.referral ?? messagingEvent?.postback?.referral ?? null;
}

function getCampaignValue(referral, key) {
  if (!referral || typeof referral !== "object") {
    return null;
  }

  const value = referral[key] ?? referral[`${key}s`] ?? null;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function getMessageType(messagingEvent) {
  if (messagingEvent?.postback) {
    return "postback";
  }

  if (messagingEvent?.message?.attachments?.length) {
    return "attachment";
  }

  return "text";
}

function getMessageText(messagingEvent) {
  return messagingEvent?.message?.text ?? messagingEvent?.postback?.title ?? messagingEvent?.postback?.payload ?? null;
}

function isInboundMessage(messagingEvent) {
  if (!messagingEvent?.sender?.id) {
    return false;
  }

  if (messagingEvent?.message?.is_echo) {
    return false;
  }

  if (config.metaInstagramAccountId && messagingEvent.sender.id === config.metaInstagramAccountId) {
    return false;
  }

  return Boolean(messagingEvent.message || messagingEvent.postback);
}

async function findCustomer(scopedUserId) {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("instagram_scoped_user_id", scopedUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function markCustomerInstagramInteraction(customerId, interactedAt) {
  const { error } = await supabase
    .from("customers")
    .update({
      last_instagram_interaction_at: interactedAt,
      preferred_contact_channel: "instagram"
    })
    .eq("id", customerId);

  if (error) {
    throw error;
  }
}

async function upsertConversation({ customerId, messagingEvent, referral }) {
  const scopedUserId = messagingEvent.sender.id;
  const now = new Date(Number(messagingEvent.timestamp ?? Date.now())).toISOString();
  const campaignId = getCampaignValue(referral, "campaign_id");
  const adsetId = getCampaignValue(referral, "adset_id");
  const adId = getCampaignValue(referral, "ad_id");

  const { data: existing, error: existingError } = await supabase
    .from("instagram_conversations")
    .select("id, customer_id")
    .eq("instagram_scoped_user_id", scopedUserId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const patch = {
      ad_id: adId,
      adset_id: adsetId,
      campaign_id: campaignId,
      last_inbound_at: now,
      last_message_at: now,
      referral,
      updated_at: now
    };

    if (!existing.customer_id && customerId) {
      patch.customer_id = customerId;
    }

    const { data, error } = await supabase
      .from("instagram_conversations")
      .update(patch)
      .eq("id", existing.id)
      .select("id, customer_id")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("instagram_conversations")
    .insert({
      ad_id: adId,
      adset_id: adsetId,
      campaign_id: campaignId,
      customer_id: customerId,
      instagram_scoped_user_id: scopedUserId,
      last_inbound_at: now,
      last_message_at: now,
      referral,
      source: "instagram",
      source_detail: "instagram_ad",
      status: "new",
      updated_at: now
    })
    .select("id, customer_id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function insertInboundMessage({ conversation, eventId, messagingEvent }) {
  const createdAt = new Date(Number(messagingEvent.timestamp ?? Date.now())).toISOString();
  const { error } = await supabase
    .from("instagram_messages")
    .upsert(
      {
        attachments: messagingEvent?.message?.attachments ?? null,
        conversation_id: conversation.id,
        created_at: createdAt,
        customer_id: conversation.customer_id,
        direction: "inbound",
        external_message_id: eventId,
        message_type: getMessageType(messagingEvent),
        raw_payload: messagingEvent,
        text: getMessageText(messagingEvent)
      },
      {
        ignoreDuplicates: true,
        onConflict: "external_message_id"
      }
    );

  if (error) {
    throw error;
  }
}

async function markWebhookEvent(eventId, patch) {
  const { error } = await supabase
    .from("instagram_webhook_events")
    .update(patch)
    .eq("event_id", eventId);

  if (error) {
    throw error;
  }
}

async function saveWebhookEvent({ eventId, headers, payload }) {
  const { data, error } = await supabase
    .from("instagram_webhook_events")
    .upsert(
      {
        event_id: eventId,
        headers,
        raw_payload: payload
      },
      {
        ignoreDuplicates: true,
        onConflict: "event_id"
      }
    )
    .select("id, processed")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function processMetaWebhook({ body, headers }) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const savedHeaders = headersToObject(headers);
  const results = [];

  for (const entry of entries) {
    const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];

    for (const messagingEvent of messagingEvents) {
      const eventId = getEventId(entry, messagingEvent);
      const savedEvent = await saveWebhookEvent({
        eventId,
        headers: savedHeaders,
        payload: { entry, event: messagingEvent, object: body?.object ?? null }
      });

      if (savedEvent?.processed) {
        results.push({ eventId, skipped: true });
        continue;
      }

      try {
        if (isInboundMessage(messagingEvent)) {
          const customer = await findCustomer(messagingEvent.sender.id);
          const referral = getReferral(messagingEvent);
          const conversation = await upsertConversation({
            customerId: customer?.id ?? null,
            messagingEvent,
            referral
          });

          if (customer?.id) {
            await markCustomerInstagramInteraction(
              customer.id,
              new Date(Number(messagingEvent.timestamp ?? Date.now())).toISOString()
            );
          }

          await insertInboundMessage({
            conversation,
            eventId,
            messagingEvent
          });
        }

        await markWebhookEvent(eventId, {
          processed: true,
          processing_error: null
        });
        results.push({ eventId, processed: true });
      } catch (error) {
        await markWebhookEvent(eventId, {
          processed: false,
          processing_error: error instanceof Error ? error.message : "Unknown processing error"
        });
        results.push({ eventId, error: error instanceof Error ? error.message : "Unknown processing error" });
      }
    }
  }

  if (!results.length) {
    const eventId = `payload:${stableHash(body)}`;
    await saveWebhookEvent({
      eventId,
      headers: savedHeaders,
      payload: body
    });
    results.push({ eventId, processed: false, skipped: true });
  }

  return {
    automationEnabled: config.enableInstagramAutomation,
    results,
    success: true
  };
}
