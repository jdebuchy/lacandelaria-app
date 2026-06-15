import { NextResponse } from "next/server";
import { z } from "zod";
import { toStructuredAddressColumns, structuredAddressSchema } from "@/lib/address";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { normalizeArgentinaPhoneInput, normalizeInstagramUsername } from "@/lib/contact";
import { getActiveTripOrder } from "@/lib/delivery-trip-ops";
import { canEditOrder } from "@/lib/delivery-trips";
import { recordOrderActivity } from "@/lib/order-activities";
import {
  buildVariantLookup,
  buildOrderItems,
  calculateItemsCount,
  calculateOrderTotal,
  loadCatalog,
  orderItemsInputSchema,
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const updateManualOrderSchema = structuredAddressSchema
  .extend({
    customerId: z.string().uuid().optional().or(z.literal("")),
    firstName: z.string().max(120).optional().or(z.literal("")),
    lastName: z.string().max(120).optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    instagram: z.string().max(100).optional().or(z.literal("")),
    addressLine1: z.string().min(5, "Ingresa una dirección."),
    locality: z.string().min(2, "Ingresa una localidad."),
    administrativeAreaLevel1: z.string().min(2, "Ingresa una provincia."),
    postalCode: z.string().min(3, "Ingresa un código postal."),
    deliveryNotes: z.string().max(500).optional().or(z.literal("")),
    items: orderItemsInputSchema,
    paymentMethodExpected: z.enum(["unknown", "cash", "transfer"]),
    deliveryDate: z.string().optional().or(z.literal("")),
    deliveryWindowStart: z.string().optional().or(z.literal("")),
    deliveryWindowEnd: z.string().optional().or(z.literal("")),
    notes: z.string().max(500).optional().or(z.literal(""))
  })
  .superRefine((data, ctx) => {
    if (!data.firstName?.trim() && !data.lastName?.trim() && !data.instagram?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa nombre, apellido o Instagram.",
        path: ["firstName"]
      });
    }

    const deliveryWindowStart = data.deliveryWindowStart?.trim() ?? "";
    const deliveryWindowEnd = data.deliveryWindowEnd?.trim() ?? "";
    const hasWindowStart = Boolean(deliveryWindowStart);
    const hasWindowEnd = Boolean(deliveryWindowEnd);

    if (hasWindowStart !== hasWindowEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Completa ambas horas de entrega o deja ambas vacías.",
        path: ["deliveryWindowStart"]
      });
    }

    if (hasWindowStart && hasWindowEnd && deliveryWindowStart > deliveryWindowEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La franja horaria es inválida.",
        path: ["deliveryWindowStart"]
      });
    }
  });

function isDuplicateInstagramError(error?: { code?: string | null; message?: string | null } | null) {
  return error?.code === "23505" && (error.message?.includes("customers_instagram_normalized_unique_idx") ?? false);
}

type Params = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function PATCH(request: Request, context: Params) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const { orderId } = await context.params;
  const body = await request.json();
  const parsed = updateManualOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone ?? "");
  const instagram = normalizeInstagramUsername(parsed.data.instagram) || null;
  const addressColumns = toStructuredAddressColumns(parsed.data);
  const firstName = parsed.data.firstName?.trim() || instagram || "Cliente";
  const lastName = parsed.data.lastName?.trim() || null;

  if (normalizedPhone && (normalizedPhone.length < 11 || normalizedPhone.length > 14)) {
    return NextResponse.json(
      { success: false, message: "Ingresa un telefono valido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: existingOrder, error: orderFetchError } = await supabase
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", orderId)
    .single();

  if (orderFetchError || !existingOrder) {
    return NextResponse.json(
      { success: false, message: "No se encontro el pedido." },
      { status: 404 }
    );
  }

  const activeTripOrder = await getActiveTripOrder(supabase, orderId);

  if (!canEditOrder(existingOrder.status, Boolean(activeTripOrder))) {
    return NextResponse.json(
      { success: false, message: "Ese pedido ya no admite edicion." },
      { status: 409 }
    );
  }

  let customerId = parsed.data.customerId || existingOrder.customer_id || null;

  if (!customerId && normalizedPhone) {
    const { data: matchedCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    customerId = matchedCustomer?.id ?? null;
  }

  if (!customerId && instagram) {
    const { data: matchedCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("instagram", instagram)
      .limit(1)
      .maybeSingle();

    customerId = matchedCustomer?.id ?? null;
  }

  if (customerId) {
    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone || null,
        instagram,
        ...addressColumns,
        delivery_notes: parsed.data.deliveryNotes || null
      })
      .eq("id", customerId);

    if (customerUpdateError) {
      if (isDuplicateInstagramError(customerUpdateError)) {
        return NextResponse.json(
          { success: false, message: "Ya existe un cliente con ese Instagram." },
          { status: 409 }
        );
      }

      console.error("customer update failed", customerUpdateError);
      return NextResponse.json(
        { success: false, message: "No se pudo actualizar el cliente." },
        { status: 500 }
      );
    }
  } else {
    const { data: newCustomer, error: customerInsertError } = await supabase
      .from("customers")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone || null,
        instagram,
        ...addressColumns,
        delivery_notes: parsed.data.deliveryNotes || null,
        source: "repeat"
      })
      .select("id")
      .single();

    if (customerInsertError || !newCustomer) {
      if (isDuplicateInstagramError(customerInsertError)) {
        return NextResponse.json(
          { success: false, message: "Ya existe un cliente con ese Instagram." },
          { status: 409 }
        );
      }

      console.error("customer insert failed", customerInsertError);
      return NextResponse.json(
        { success: false, message: "No se pudo crear el cliente." },
        { status: 500 }
      );
    }

    customerId = newCustomer.id;
  }

  const { data: catalog, error: productsError } = await loadCatalog(supabase, {
    onlyActiveFamilies: true,
    onlySellableVariants: true,
    onlyActiveVariants: true
  });

  if (productsError) {
    console.error("products fetch failed", productsError);
    return NextResponse.json(
      { success: false, message: "No se pudieron validar los productos del pedido." },
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
        message: error instanceof Error ? error.message : "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  const itemsCount = calculateItemsCount(orderItems);
  const totalAmount = calculateOrderTotal(orderItems);

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({
      customer_id: customerId,
      items_count: itemsCount,
      total_amount: totalAmount,
      payment_method_expected: parsed.data.paymentMethodExpected,
      delivery_date: parsed.data.deliveryDate || null,
      delivery_window_start: parsed.data.deliveryWindowStart || null,
      delivery_window_end: parsed.data.deliveryWindowEnd || null,
      delivery_area: addressColumns.delivery_area,
      notes: parsed.data.notes || null
    })
    .eq("id", orderId);

  if (orderUpdateError) {
    console.error("order update failed", orderUpdateError);
    return NextResponse.json(
      { success: false, message: "No se pudo actualizar el pedido." },
      { status: 500 }
    );
  }

  const { error: deleteItemsError } = await supabase.from("order_items").delete().eq("order_id", orderId);

  if (deleteItemsError) {
    console.error("order_items delete failed", deleteItemsError);
    return NextResponse.json(
      { success: false, message: "No se pudo actualizar el detalle del pedido." },
      { status: 500 }
    );
  }

  const { error: itemsInsertError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      order_id: orderId,
      ...item
    }))
  );

  if (itemsInsertError) {
    console.error("order_items insert failed", itemsInsertError);
    return NextResponse.json(
      { success: false, message: "No se pudo guardar el detalle del pedido." },
      { status: 500 }
    );
  }

  await recordOrderActivity(supabase, {
    actorUserId: authResult.auth.profile.id,
    metadata: {
      itemsCount,
      paymentMethodExpected: parsed.data.paymentMethodExpected,
      totalAmount
    },
    orderId,
    summary: "Pedido editado.",
    type: "order_updated"
  });

  return NextResponse.json({
    success: true,
    message: "Pedido actualizado correctamente."
  });
}
