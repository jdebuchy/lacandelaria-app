import { toStructuredAddressColumns } from "@/lib/address";
import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { recordOrderActivity } from "@/lib/order-activities";
import {
  buildOrderItems,
  buildVariantLookup,
  calculateItemsCount,
  calculateOrderTotal,
  flattenCatalogVariants,
  getDefaultSellableVariantId,
  loadCatalog
} from "@/lib/products";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { CatalogVariant } from "./catalog";
import type { OrderDraft } from "./order-draft";
import type { PedidoItem } from "./summary";
import type { ChannelId } from "./types";

type Client = ReturnType<typeof createAdminClient>;

// El catalogo real, no el contexto comercial: el contexto tiene precios para
// que el modelo los diga, pero no tiene ids, y un pedido sin id de variante no
// se puede cargar.
export async function loadBotCatalog(supabase: Client) {
  const { data, error } = await loadCatalog(supabase, {
    onlyActiveFamilies: true,
    onlySellableVariants: true,
    onlyActiveVariants: true
  });

  if (error || !data) {
    return { variantes: [] as CatalogVariant[], variantePorDefecto: null as string | null };
  }

  const variantes: CatalogVariant[] = flattenCatalogVariants(data).map((variante) => ({
    id: variante.id,
    familyId: variante.familyId,
    familyName: variante.familyName,
    label: variante.label,
    cashPrice: variante.cashPrice,
    transferPrice: variante.transferPrice
  }));

  // El producto principal es el de la familia que el panel muestra primero: hoy
  // la caja de paltas. Sale del catalogo y no de una constante para que cambiar
  // el orden en el panel alcance.
  const principal = [...data].sort((a, b) => a.displayOrder - b.displayOrder)[0];

  return {
    variantes,
    variantePorDefecto: principal ? getDefaultSellableVariantId(principal) : null
  };
}

export type CreateOrderInput = {
  conversationId: string;
  customerId: string | null;
  channel: ChannelId;
  threadId: string;
  senderName: string | null;
  draft: OrderDraft;
  items: PedidoItem[];
  isTest: boolean;
};

export type CreateOrderResult =
  | { tipo: "creado"; orderId: string; orderNumber: number | null; customerId: string }
  | { tipo: "ya_existia"; orderId: string; orderNumber: number | null }
  | { tipo: "error"; motivo: string };

function buildIdempotencyKey(conversationId: string, items: PedidoItem[]) {
  const detalle = items
    .map((item) => `${item.variante.id}x${item.cantidad}`)
    .sort()
    .join(",");

  return `${conversationId}:${detalle}`;
}

function nombreYApellido(draft: OrderDraft, senderName: string | null) {
  const completo = (draft.nombre ?? senderName ?? "").trim();

  if (!completo) {
    return { firstName: "Cliente", lastName: null as string | null };
  }

  const partes = completo.split(/\s+/);

  return {
    firstName: partes[0],
    lastName: partes.length > 1 ? partes.slice(1).join(" ") : null
  };
}

function direccionEstructurada(draft: OrderDraft) {
  const { direccion } = draft;

  return toStructuredAddressColumns({
    addressKind: direccion.addressKind ?? "standard",
    addressLine1: direccion.addressLine1 ?? direccion.texto ?? "",
    addressLine2: direccion.addressLine2 ?? "",
    gatedCommunityName: direccion.gatedCommunityName ?? "",
    locality: direccion.locality ?? "",
    administrativeAreaLevel1: direccion.provincia ?? "",
    postalCode: direccion.codigoPostal ?? "",
    googlePlaceId: direccion.googlePlaceId ?? "",
    googlePlaceLabel: direccion.etiqueta ?? "",
    addressSource: direccion.googlePlaceId ? "google_places" : "manual"
  });
}

// Lo que el cliente dijo sobre el pago va a las notas, no al precio. El pedido
// se crea a precio de lista en todos los canales y el descuento por efectivo lo
// aplica el primer cobro: cotizar distinto aca haria que dos pedidos iguales
// tengan totales distintos segun por donde entraron.
function buildNotes(draft: OrderDraft, isTest: boolean) {
  const partes: string[] = [];

  if (isTest) {
    partes.push("[prueba]");
  }

  if (draft.metodoPago) {
    partes.push(`dijo que paga ${draft.metodoPago === "cash" ? "en efectivo" : "por transferencia"}`);
  }

  if (draft.notas) {
    partes.push(draft.notas);
  }

  return partes.join(". ") || null;
}

async function resolverCliente(
  supabase: Client,
  input: CreateOrderInput,
  columnasDireccion: ReturnType<typeof toStructuredAddressColumns>,
  now: string
) {
  const telefono = input.draft.telefono ? normalizeArgentinaPhoneInput(input.draft.telefono) : "";
  const { firstName, lastName } = nombreYApellido(input.draft, input.senderName);

  let customerId = input.customerId;

  // Sin telefono no hay como deduplicar contra los clientes que ya existen. Con
  // telefono si, y es el caso normal: casi todos vienen de WhatsApp.
  if (!customerId && telefono) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .or(`phone.eq.${telefono},whatsapp_phone.eq.${telefono}`)
      .limit(1)
      .maybeSingle();

    customerId = data?.id ?? null;
  }

  const datos = {
    first_name: firstName,
    last_name: lastName,
    ...columnasDireccion,
    delivery_notes: input.draft.notas || null
  };

  if (customerId) {
    // A un cliente que ya existe no se le pisa el telefono con vacio ni se le
    // cambia el canal preferido: lo que sabemos por Telegram es menos que lo que
    // ya habia.
    const { error } = await supabase
      .from("customers")
      .update(telefono ? { ...datos, phone: telefono } : datos)
      .eq("id", customerId);

    if (error) {
      return { customerId: null, error: error.message };
    }

    return { customerId, error: null };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...datos,
      phone: telefono || null,
      source: "repeat",
      preferred_contact_channel: input.channel,
      last_whatsapp_interaction_at: input.channel === "whatsapp" ? now : null
    })
    .select("id")
    .single();

  if (error || !data) {
    return { customerId: null, error: error?.message ?? "No se pudo crear el cliente." };
  }

  return { customerId: data.id as string, error: null };
}

export async function createBotOrder(
  supabase: Client,
  input: CreateOrderInput,
  now: string
): Promise<CreateOrderResult> {
  if (!input.items.length) {
    return { tipo: "error", motivo: "El pedido no tiene productos." };
  }

  const idempotencyKey = buildIdempotencyKey(input.conversationId, input.items);

  // La confirmacion puede llegar dos veces: el cliente que insiste, un reintento
  // del webhook. Un pedido duplicado se lo come el reparto, asi que se chequea
  // antes de escribir nada.
  const { data: conversacion } = await supabase
    .from("conversations")
    .select("draft_order")
    .eq("id", input.conversationId)
    .maybeSingle();

  const draftGuardado = (conversacion?.draft_order ?? {}) as Record<string, unknown>;

  if (draftGuardado.idempotencyKey === idempotencyKey && typeof draftGuardado.createdOrderId === "string") {
    return {
      tipo: "ya_existia",
      orderId: draftGuardado.createdOrderId,
      orderNumber: typeof draftGuardado.orderNumber === "number" ? draftGuardado.orderNumber : null
    };
  }

  const { data: catalogo, error: errorCatalogo } = await loadCatalog(supabase, {
    onlyActiveFamilies: true,
    onlySellableVariants: true,
    onlyActiveVariants: true
  });

  if (errorCatalogo || !catalogo) {
    return { tipo: "error", motivo: "No se pudo leer el catalogo." };
  }

  let orderItems;

  try {
    // Precio de lista, como todos los canales. buildOrderItems valida contra el
    // catalogo, asi que un id que no existe o una variante apagada frenan aca.
    orderItems = buildOrderItems(
      buildVariantLookup(catalogo),
      input.items.map((item) => ({ productId: item.variante.id, quantity: item.cantidad })),
      "unknown"
    );
  } catch (error) {
    return {
      tipo: "error",
      motivo: error instanceof Error ? error.message : "Producto invalido."
    };
  }

  const columnasDireccion = direccionEstructurada(input.draft);
  const cliente = await resolverCliente(supabase, input, columnasDireccion, now);

  if (!cliente.customerId) {
    return { tipo: "error", motivo: cliente.error ?? "No se pudo resolver el cliente." };
  }

  const { data: order, error: errorOrden } = await supabase
    .from("orders")
    .insert({
      customer_id: cliente.customerId,
      sales_channel: input.channel === "telegram" ? "telegram_ai" : "whatsapp_ai",
      items_count: calculateItemsCount(orderItems),
      total_amount: calculateOrderTotal(orderItems),
      payment_method_expected: "unknown",
      status: "confirmed",
      payment_status: "pending",
      delivery_area: columnasDireccion.delivery_area,
      notes: buildNotes(input.draft, input.isTest)
    })
    .select("id, order_number")
    .single();

  if (errorOrden || !order) {
    return { tipo: "error", motivo: errorOrden?.message ?? "No se pudo crear el pedido." };
  }

  const { error: errorItems } = await supabase
    .from("order_items")
    .insert(orderItems.map((item) => ({ order_id: order.id, ...item })));

  if (errorItems) {
    // Un pedido sin items es peor que ninguno: aparece en el reparto vacio.
    await supabase.from("orders").delete().eq("id", order.id);

    return { tipo: "error", motivo: errorItems.message };
  }

  await supabase
    .from("conversations")
    .update({
      customer_id: cliente.customerId,
      status: "order_created",
      draft_order: {
        ...draftGuardado,
        createdOrderId: order.id,
        orderNumber: order.order_number,
        idempotencyKey
      },
      updated_at: now
    })
    .eq("id", input.conversationId);

  await recordOrderActivity(supabase, {
    metadata: {
      conversationId: input.conversationId,
      channel: input.channel,
      idempotencyKey,
      itemsCount: calculateItemsCount(orderItems),
      totalAmount: calculateOrderTotal(orderItems)
    },
    orderId: order.id,
    summary: `Pedido creado por el bot (${input.channel}).`,
    type: "order_created"
  });

  return {
    tipo: "creado",
    orderId: order.id,
    orderNumber: order.order_number ?? null,
    customerId: cliente.customerId
  };
}
