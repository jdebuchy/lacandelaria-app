import { NextResponse } from "next/server";
import { z } from "zod";
import { structuredAddressSchema, toStructuredAddressColumns } from "@/lib/address";
import { appConfig } from "@/lib/config";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import {
  buildOrderItems,
  buildVariantLookup,
  calculateItemsCount,
  calculateOrderTotal,
  loadCatalog,
  orderItemsInputSchema
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const createWhatsappOrderSchema = structuredAddressSchema
  .extend({
    conversationId: z.string().uuid(),
    idempotencyKey: z.string().min(8).max(160),
    customerId: z.string().uuid().optional().or(z.literal("")),
    firstName: z.string().optional().or(z.literal("")),
    lastName: z.string().optional().or(z.literal("")),
    phone: z.string().min(8),
    instagram: z.string().max(100).optional().or(z.literal("")),
    deliveryNotes: z.string().max(500).optional().or(z.literal("")),
    items: orderItemsInputSchema,
    paymentMethodExpected: z.enum(["cash", "transfer"]),
    deliveryDate: z.string().optional().or(z.literal("")),
    deliveryWindowStart: z.string().optional().or(z.literal("")),
    deliveryWindowEnd: z.string().optional().or(z.literal("")),
    notes: z.string().max(500).optional().or(z.literal(""))
  })
  .superRefine((data, ctx) => {
    if (!data.firstName?.trim() && !data.lastName?.trim() && !data.instagram?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing customer identity.",
        path: ["firstName"]
      });
    }

    if (!data.addressLine1?.trim() || !data.locality?.trim() || !data.administrativeAreaLevel1?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing confirmed delivery address.",
        path: ["addressLine1"]
      });
    }
  });

function hasValidInternalSecret(request: Request) {
  const provided = request.headers.get("x-internal-api-secret") ?? "";
  return Boolean(appConfig.internalApiSecret && provided && provided === appConfig.internalApiSecret);
}

function getCreatedOrderIdFromDraft(draft: unknown, idempotencyKey: string) {
  if (!draft || typeof draft !== "object") {
    return null;
  }

  const value = draft as { createdOrderId?: unknown; idempotencyKey?: unknown };

  if (value.idempotencyKey === idempotencyKey && typeof value.createdOrderId === "string") {
    return value.createdOrderId;
  }

  return null;
}

export async function POST(request: Request) {
  if (!hasValidInternalSecret(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized internal request." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const parsed = createWhatsappOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid WhatsApp order payload."
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("whatsapp_conversations")
    .select("id, customer_id, draft_order")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json(
      { success: false, message: "Conversation not found." },
      { status: 404 }
    );
  }

  const existingOrderId = getCreatedOrderIdFromDraft(conversation.draft_order, parsed.data.idempotencyKey);

  if (existingOrderId) {
    return NextResponse.json({
      success: true,
      orderId: existingOrderId,
      message: "Order already created for this confirmation."
    });
  }

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone);
  const instagram = parsed.data.instagram?.trim().replace(/^@+/, "") || null;
  const firstName = parsed.data.firstName?.trim() || instagram || "Cliente";
  const lastName = parsed.data.lastName?.trim() || null;
  const addressColumns = toStructuredAddressColumns(parsed.data);

  if (normalizedPhone.length < 11 || normalizedPhone.length > 14) {
    return NextResponse.json(
      { success: false, message: "Invalid customer phone." },
      { status: 400 }
    );
  }

  let customerId = parsed.data.customerId || conversation.customer_id || null;

  if (!customerId) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .or(`phone.eq.${normalizedPhone},whatsapp_phone.eq.${normalizedPhone}`)
      .limit(1)
      .maybeSingle();

    customerId = existingCustomer?.id ?? null;
  }

  if (customerId) {
    const { error: updateCustomerError } = await supabase
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone,
        whatsapp_phone: normalizedPhone,
        instagram,
        ...addressColumns,
        delivery_notes: parsed.data.deliveryNotes || null,
        last_whatsapp_interaction_at: new Date().toISOString(),
        preferred_contact_channel: "whatsapp"
      })
      .eq("id", customerId);

    if (updateCustomerError) {
      console.error("whatsapp customer update failed", updateCustomerError);
      return NextResponse.json(
        { success: false, message: "Could not update customer." },
        { status: 500 }
      );
    }
  } else {
    const { data: newCustomer, error: insertCustomerError } = await supabase
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone,
        whatsapp_phone: normalizedPhone,
        instagram,
        ...addressColumns,
        delivery_notes: parsed.data.deliveryNotes || null,
        source: "repeat",
        last_whatsapp_interaction_at: new Date().toISOString(),
        preferred_contact_channel: "whatsapp"
      })
      .select("id")
      .single();

    if (insertCustomerError || !newCustomer) {
      console.error("whatsapp customer insert failed", insertCustomerError);
      return NextResponse.json(
        { success: false, message: "Could not create customer." },
        { status: 500 }
      );
    }

    customerId = newCustomer.id;
  }

  const { data: catalog, error: catalogError } = await loadCatalog(supabase, {
    onlyActiveFamilies: true,
    onlySellableVariants: true,
    onlyActiveVariants: true
  });

  if (catalogError) {
    console.error("whatsapp catalog fetch failed", catalogError);
    return NextResponse.json(
      { success: false, message: "Could not validate catalog." },
      { status: 500 }
    );
  }

  const productsById = buildVariantLookup(catalog ?? []);
  let orderItems;

  try {
    orderItems = buildOrderItems(productsById, parsed.data.items, parsed.data.paymentMethodExpected);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Invalid order items."
      },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      sales_channel: "whatsapp_ai",
      items_count: calculateItemsCount(orderItems),
      total_amount: calculateOrderTotal(orderItems),
      payment_method_expected: parsed.data.paymentMethodExpected,
      status: "confirmed",
      payment_status: "pending",
      delivery_date: parsed.data.deliveryDate || null,
      delivery_window_start: parsed.data.deliveryWindowStart || null,
      delivery_window_end: parsed.data.deliveryWindowEnd || null,
      delivery_area: addressColumns.delivery_area,
      notes: parsed.data.notes || null
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("whatsapp order insert failed", orderError);
    return NextResponse.json(
      { success: false, message: "Could not create order." },
      { status: 500 }
    );
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      order_id: order.id,
      ...item
    }))
  );

  if (itemsError) {
    console.error("whatsapp order_items insert failed", itemsError);
    await supabase.from("orders").delete().eq("id", order.id);

    return NextResponse.json(
      { success: false, message: "Could not save order items." },
      { status: 500 }
    );
  }

  await supabase
    .from("whatsapp_conversations")
    .update({
      customer_id: customerId,
      status: "order_created",
      draft_order: {
        ...(conversation.draft_order && typeof conversation.draft_order === "object" ? conversation.draft_order : {}),
        createdOrderId: order.id,
        idempotencyKey: parsed.data.idempotencyKey
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.conversationId);

  return NextResponse.json({
    success: true,
    orderId: order.id,
    message: "WhatsApp order created."
  });
}
