import { createOrderFromConversation } from "./orders/createOrderFromConversation.js";
import { supabase } from "./supabase.js";

const AUTO_REPLY_LIMIT_PER_HOUR = 5;

async function automaticRepliesLastHour(conversationId) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("whatsapp_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .gte("created_at", since);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function shouldHandoff(analysis) {
  return (
    analysis.should_handoff_to_human ||
    analysis.confidence < 0.75 ||
    analysis.intent === "complaint" ||
    analysis.intent === "ask_price" ||
    analysis.intent === "ask_delivery" ||
    analysis.intent === "ask_products"
  );
}

function isClosingIntent(intent) {
  return intent === "not_interested" || intent === "not_now" || intent === "cancel_order";
}

async function buildRepeatOrderPayload(customerId) {
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, whatsapp_phone, instagram, address_kind, address_line_1, address_line_2, gated_community_name, locality, administrative_area_level_1, postal_code, google_place_id, google_place_label, address_source, delivery_notes")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return null;
  }

  const { data: lastOrder, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_method_expected, order_items ( product_id, quantity, product_name_snapshot, sales_unit_label_snapshot )")
    .eq("customer_id", customerId)
    .eq("status", "delivered")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError || !lastOrder?.order_items?.length) {
    return null;
  }

  return {
    payload: {
      addressKind: customer.address_kind ?? "standard",
      addressLine1: customer.address_line_1 ?? "",
      addressLine2: customer.address_line_2 ?? "",
      addressSource: customer.address_source ?? "manual",
      administrativeAreaLevel1: customer.administrative_area_level_1 ?? "",
      customerId: customer.id,
      deliveryDate: "",
      deliveryNotes: customer.delivery_notes ?? "",
      deliveryWindowEnd: "",
      deliveryWindowStart: "",
      firstName: customer.first_name ?? "",
      gatedCommunityName: customer.gated_community_name ?? "",
      googlePlaceId: customer.google_place_id ?? "",
      googlePlaceLabel: customer.google_place_label ?? "",
      instagram: customer.instagram ?? "",
      items: lastOrder.order_items.map((item) => ({
        productId: item.product_id,
        quantity: Number(item.quantity ?? 1)
      })),
      lastName: customer.last_name ?? "",
      locality: customer.locality ?? "",
      notes: "Pedido creado desde WhatsApp con confirmación explícita del cliente.",
      paymentMethodExpected: lastOrder.payment_method_expected,
      phone: customer.whatsapp_phone || customer.phone || "",
      postalCode: customer.postal_code ?? ""
    },
    summary: {
      address: [customer.address_line_1, customer.locality].filter(Boolean).join(", "),
      items: lastOrder.order_items
        .map((item) => `${item.quantity} x ${item.product_name_snapshot} ${item.sales_unit_label_snapshot}`)
        .join(", "),
      paymentMethod:
        lastOrder.payment_method_expected === "transfer"
          ? "transferencia"
          : lastOrder.payment_method_expected === "cash"
            ? "efectivo"
            : "no definido"
    }
  };
}

export async function applyConversationRules({ analysis, conversation, inboundMessageId, sendReply }) {
  const now = new Date().toISOString();

  if (analysis.intent === "opt_out") {
    await supabase
      .from("customers")
      .update({
        last_whatsapp_interaction_at: now,
        whatsapp_opt_in: false,
        whatsapp_opt_out_at: now
      })
      .eq("id", conversation.customer_id);

    await supabase
      .from("whatsapp_message_queue")
      .update({ status: "cancelled", updated_at: now, last_error: "Customer opted out." })
      .eq("customer_id", conversation.customer_id)
      .in("status", ["pending", "processing"]);

    await supabase
      .from("whatsapp_conversations")
      .update({
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        requires_human: false,
        status: "opted_out",
        updated_at: now
      })
      .eq("id", conversation.id);

    const body = "Listo, ya registramos tu baja para no enviarte más mensajes por WhatsApp.";
    await sendReply(body, "opt_out_confirmation");
    return { action: "opted_out", body };
  }

  if (shouldHandoff(analysis)) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        requires_human: true,
        status: "needs_human",
        updated_at: now
      })
      .eq("id", conversation.id);

    return { action: "needs_human" };
  }

  if (isClosingIntent(analysis.intent)) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        requires_human: false,
        status: "closed",
        updated_at: now
      })
      .eq("id", conversation.id);

    return { action: "closed" };
  }

  if ((await automaticRepliesLastHour(conversation.id)) >= AUTO_REPLY_LIMIT_PER_HOUR) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        requires_human: true,
        status: "needs_human",
        updated_at: now
      })
      .eq("id", conversation.id);

    return { action: "rate_limited_handoff" };
  }

  const draftOrder = conversation.draft_order && typeof conversation.draft_order === "object"
    ? conversation.draft_order
    : {};

  if (analysis.intent === "confirm_order" && draftOrder.confirmed_payload) {
    const result = await createOrderFromConversation({
      conversationId: conversation.id,
      confirmedPayload: draftOrder.confirmed_payload,
      idempotencyKey: inboundMessageId
    });

    await supabase
      .from("whatsapp_conversations")
      .update({
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        requires_human: false,
        status: "order_created",
        updated_at: now
      })
      .eq("id", conversation.id);

    const body = "Tu pedido quedó registrado. Te vamos a contactar si necesitamos coordinar algún detalle.";
    await sendReply(body, "order_confirmation", result.orderId);
    return { action: "order_created", orderId: result.orderId };
  }

  if (analysis.intent === "buy" && conversation.customer_id) {
    const repeatOrder = await buildRepeatOrderPayload(conversation.customer_id);

    if (repeatOrder) {
      const reply = `Te puedo repetir el último pedido:\n\n${repeatOrder.summary.items}\nDirección: ${repeatOrder.summary.address}\nPago: ${repeatOrder.summary.paymentMethod}\n\n¿Confirmás que registre este pedido?`;

      await supabase
        .from("whatsapp_conversations")
        .update({
          current_intent: analysis.intent,
          ai_confidence: analysis.confidence,
          draft_order: {
            ...draftOrder,
            confirmed_payload: repeatOrder.payload,
            summary: repeatOrder.summary
          },
          requires_human: false,
          status: "waiting_for_confirmation",
          updated_at: now
        })
        .eq("id", conversation.id);

      await sendReply(reply, "transactional_reply");
      return { action: "waiting_for_confirmation", body: reply };
    }
  }

  const nextStatus = analysis.intent === "buy" ? "collecting_order_data" : "satisfaction_answered";
  const reply = analysis.suggested_reply || "Gracias por responder. Te seguimos por acá si necesitás algo.";

  await supabase
    .from("whatsapp_conversations")
    .update({
      current_intent: analysis.intent,
      ai_confidence: analysis.confidence,
      requires_human: false,
      status: nextStatus,
      updated_at: now
    })
    .eq("id", conversation.id);

  await sendReply(reply, "transactional_reply");
  return { action: "replied", body: reply };
}
