import { NextResponse } from "next/server";
import { z } from "zod";
import { structuredAddressSchema, toStructuredAddressColumns } from "@/lib/address";
import { normalizeArgentinaPhoneInput, normalizeInstagramUsername } from "@/lib/contact";
import {
  buildVariantLookup,
  buildPublicOrderRequestItems,
  calculateItemsCount,
  loadCatalog,
  orderItemsInputSchema,
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const publicOrderSchema = structuredAddressSchema
  .extend({
    firstName: z.string().optional().or(z.literal("")),
    lastName: z.string().optional().or(z.literal("")),
    phone: z.string().min(8, "Ingresa un WhatsApp valido."),
    instagram: z.string().max(100).optional().or(z.literal("")),
    addressLine1: z.string().min(5, "Ingresa una dirección."),
    locality: z.string().min(2, "Ingresa una localidad."),
    administrativeAreaLevel1: z.string().min(2, "Ingresa una provincia."),
    postalCode: z.string().min(3, "Ingresa un código postal."),
    items: orderItemsInputSchema,
    paymentMethodExpected: z.enum(["unknown", "cash", "transfer"]),
    notes: z.string().max(500).optional().or(z.literal("")),
    leadSource: z.enum(["instagram", "whatsapp", "direct_link", "reseller"]).default("direct_link"),
    website: z.string().optional().or(z.literal("")),
    startedAt: z.coerce.number().int().positive()
  })
  .superRefine((data, ctx) => {
    if (!data.firstName?.trim() && !data.lastName?.trim() && !data.instagram?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa nombre, apellido o Instagram.",
        path: ["firstName"]
      });
    }
  });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = publicOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: parsed.error.issues[0]?.message ?? "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  if (parsed.data.website) {
    return NextResponse.json(
      { success: false, message: "No se pudo enviar el pedido. Intenta nuevamente." },
      { status: 400 }
    );
  }

  const elapsedMs = Date.now() - parsed.data.startedAt;

  if (elapsedMs < 2500 || elapsedMs > 1000 * 60 * 60 * 12) {
    return NextResponse.json(
      { success: false, message: "No se pudo validar el envio del pedido." },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizeArgentinaPhoneInput(parsed.data.phone);
  const instagram = normalizeInstagramUsername(parsed.data.instagram) || null;
  const addressColumns = toStructuredAddressColumns(parsed.data);
  const fallbackFirstName = parsed.data.firstName?.trim() || instagram || "Cliente";
  const fallbackLastName = parsed.data.lastName?.trim() || null;

  if (normalizedPhone.length < 11 || normalizedPhone.length > 14) {
    return NextResponse.json(
      { success: false, message: "Ingresa un telefono de WhatsApp valido." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
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

  let requestItems;

  try {
    requestItems = buildPublicOrderRequestItems(
      productsById,
      parsed.data.items,
      parsed.data.paymentMethodExpected
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo validar el pedido."
      },
      { status: 400 }
    );
  }

  const itemsCount = calculateItemsCount(requestItems);

  const { data: newRequest, error } = await supabase
    .from("public_order_requests")
    .insert({
      first_name: fallbackFirstName,
      last_name: fallbackLastName,
      phone: normalizedPhone,
      instagram,
      ...addressColumns,
      items_count: itemsCount,
      payment_method_expected: parsed.data.paymentMethodExpected,
      lead_source: parsed.data.leadSource,
      notes: parsed.data.notes || null
    })
    .select("id")
    .single();

  if (error || !newRequest) {
    console.error("public_order_requests insert failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo enviar el pedido. Intenta nuevamente." },
      { status: 500 }
    );
  }

  const { error: itemsError } = await supabase.from("public_order_request_items").insert(
    requestItems.map((item) => ({
      public_order_request_id: newRequest.id,
      ...item
    }))
  );

  if (itemsError) {
    console.error("public_order_request_items insert failed", itemsError);
    await supabase.from("public_order_requests").delete().eq("id", newRequest.id);

    return NextResponse.json(
      { success: false, message: "No se pudo guardar el detalle del pedido. Intenta nuevamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Pedido enviado. Lo vamos a confirmar por WhatsApp."
  });
}
