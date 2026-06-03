import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import {
  buildOrderItems,
  calculateItemsCount,
  calculateOrderTotal,
  mapProductRow,
  productSchema
} from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";

const confirmSchema = z.object({
  requestId: z.string().uuid()
});

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = confirmSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Solicitud invalida." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: publicRequest, error: requestError } = await supabase
    .from("public_order_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .single();

  if (requestError || !publicRequest) {
    return NextResponse.json(
      { success: false, message: "No se encontro la solicitud." },
      { status: 404 }
    );
  }

  if (publicRequest.converted_order_id) {
    return NextResponse.json({
      success: true,
      message: "La solicitud ya estaba convertida."
    });
  }

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", publicRequest.phone)
    .limit(1)
    .maybeSingle();

  let customerId = existingCustomer?.id ?? null;

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        first_name: publicRequest.first_name,
        last_name: publicRequest.last_name || null,
        phone: publicRequest.phone,
        instagram: publicRequest.instagram || null,
        address_kind: publicRequest.address_kind,
        address_line_1: publicRequest.address_line_1,
        address_line_2: publicRequest.address_line_2,
        gated_community_name: publicRequest.gated_community_name,
        locality: publicRequest.locality,
        administrative_area_level_1: publicRequest.administrative_area_level_1,
        postal_code: publicRequest.postal_code,
        google_place_id: publicRequest.google_place_id,
        google_place_label: publicRequest.google_place_label,
        address_source: publicRequest.address_source,
        delivery_area: publicRequest.delivery_area,
        source: publicRequest.lead_source
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      console.error("customer insert failed", customerError);
      return NextResponse.json(
        { success: false, message: "No se pudo crear el cliente." },
        { status: 500 }
      );
    }

    customerId = newCustomer.id;
  }

  const { data: requestItems, error: requestItemsError } = await supabase
    .from("public_order_request_items")
    .select("product_id, quantity")
    .eq("public_order_request_id", publicRequest.id);

  if (requestItemsError || !requestItems?.length) {
    console.error("public_order_request_items fetch failed", requestItemsError);
    return NextResponse.json(
      { success: false, message: "No se encontraron productos para convertir la solicitud." },
      { status: 400 }
    );
  }

  const { data: productRows, error: productsError } = await supabase
    .from("products")
    .select("id, name, slug, description, sales_unit_label, cash_price, transfer_price, active, display_order")
    .in(
      "id",
      requestItems.map((item) => item.product_id)
    );

  if (productsError) {
    console.error("products fetch failed", productsError);
    return NextResponse.json(
      { success: false, message: "No se pudieron validar los productos de la solicitud." },
      { status: 500 }
    );
  }

  const productsById = new Map(
    (productRows ?? []).map((row) => {
      const parsedProduct = productSchema.parse(row);
      return [parsedProduct.id, mapProductRow(parsedProduct)] as const;
    })
  );

  let orderItems;

  try {
    orderItems = buildOrderItems(
      productsById,
      requestItems.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity
      })),
      publicRequest.payment_method_expected
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo confirmar la solicitud."
      },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      seller_user_id: authResult.auth.profile.id,
      sales_channel: "public_form",
      items_count: calculateItemsCount(orderItems),
      total_amount: calculateOrderTotal(orderItems),
      payment_method_expected: publicRequest.payment_method_expected,
      status: "confirmed",
      payment_status: "pending",
      delivery_area: publicRequest.delivery_area,
      notes: publicRequest.notes
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("order insert failed", orderError);
    return NextResponse.json(
      { success: false, message: "No se pudo crear el pedido interno." },
      { status: 500 }
    );
  }

  const { error: orderItemsError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      order_id: order.id,
      ...item
    }))
  );

  if (orderItemsError) {
    console.error("order_items insert failed", orderItemsError);
    await supabase.from("orders").delete().eq("id", order.id);

    return NextResponse.json(
      { success: false, message: "Se creo el pedido pero no se pudo guardar el detalle." },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("public_order_requests")
    .update({
      status: "converted",
      converted_order_id: order.id
    })
    .eq("id", publicRequest.id);

  if (updateError) {
    console.error("public request update failed", updateError);
    return NextResponse.json(
      { success: false, message: "Se creo el pedido pero no se pudo cerrar la solicitud." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Solicitud confirmada y convertida en pedido."
  });
}
