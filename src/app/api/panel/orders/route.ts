import { NextResponse } from "next/server";
import { z } from "zod";
import {
  structuredAddressSchema,
  toStructuredAddressColumns
} from "@/lib/address";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import {
  buildVariantLookup,
  buildOrderItems,
  calculateItemsCount,
  calculateOrderTotal,
  loadCatalog,
  orderItemsInputSchema,
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const createManualOrderSchema = structuredAddressSchema
  .extend({
    customerId: z.string().uuid().optional().or(z.literal("")),
    firstName: z.string().optional().or(z.literal("")),
    lastName: z.string().optional().or(z.literal("")),
    phone: z.string().min(8, "Ingresa un WhatsApp valido."),
    instagram: z.string().max(100).optional().or(z.literal("")),
    addressLine1: z.string().min(5, "Ingresa una dirección."),
    locality: z.string().min(2, "Ingresa una localidad."),
    administrativeAreaLevel1: z.string().min(2, "Ingresa una provincia."),
    postalCode: z.string().min(3, "Ingresa un código postal."),
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

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = createManualOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone);
  const instagram = parsed.data.instagram?.trim().replace(/^@+/, "") || null;
  const addressColumns = toStructuredAddressColumns(parsed.data);
  const firstName = parsed.data.firstName?.trim() || null;
  const lastName = parsed.data.lastName?.trim() || null;
  const fallbackFirstName = firstName || instagram || "Cliente";

  if (normalizedPhone.length < 11 || normalizedPhone.length > 14) {
    return NextResponse.json(
      { success: false, message: "Ingresa un telefono valido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let customerId = parsed.data.customerId || null;

  if (!customerId) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();

    customerId = existingCustomer?.id ?? null;
  }

  if (customerId) {
    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        first_name: fallbackFirstName,
        last_name: lastName || null,
        phone: normalizedPhone,
        instagram,
        ...addressColumns,
        delivery_notes: parsed.data.deliveryNotes || null
      })
      .eq("id", customerId);

    if (customerUpdateError) {
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
        first_name: fallbackFirstName,
        last_name: lastName || null,
        phone: normalizedPhone,
        instagram,
        ...addressColumns,
        delivery_notes: parsed.data.deliveryNotes || null,
        source: "repeat"
      })
      .select("id")
      .single();

    if (customerInsertError || !newCustomer) {
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

  const { data: newOrder, error: orderInsertError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      seller_user_id: authResult.auth.profile.id,
      sales_channel: "internal",
      items_count: itemsCount,
      total_amount: totalAmount,
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

  if (orderInsertError || !newOrder) {
    console.error("manual order insert failed", orderInsertError);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el pedido." },
      { status: 500 }
    );
  }

  const { error: itemsInsertError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      order_id: newOrder.id,
      ...item
    }))
  );

  if (itemsInsertError) {
    console.error("order_items insert failed", itemsInsertError);
    await supabase.from("orders").delete().eq("id", newOrder.id);

    return NextResponse.json(
      { success: false, message: "No se pudo guardar el detalle del pedido." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Pedido manual creado correctamente."
  });
}
