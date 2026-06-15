import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpectedPaymentMethod, PaymentMethod, PaymentStatus } from "@/lib/types";

export const RECEIVED_PAYMENT_STATUS = "received";
export const REJECTED_PAYMENT_STATUS = "rejected";

type PaymentSummary = {
  balanceAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  totalAmount: number;
};

type OrderItemForPaymentMethod = {
  id: string;
  quantity: number | string | null;
  product_variants?: {
    cash_price?: number | string | null;
    transfer_price?: number | string | null;
  } | Array<{
    cash_price?: number | string | null;
    transfer_price?: number | string | null;
  }> | null;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    currency: "ARS",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export function getPaymentMethodLabel(method: ExpectedPaymentMethod | string) {
  switch (method) {
    case "transfer":
      return "Transferencia";
    case "unknown":
      return "No definido";
    case "cash":
      return "Efectivo";
    default:
      return method;
  }
}

export function getPaymentStatusLabel(status: PaymentStatus | string) {
  switch (status) {
    case "paid":
      return "Pagado";
    case "partial":
      return "Parcial";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

export function resolvePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) {
    return "pending";
  }

  if (paidAmount < totalAmount) {
    return "partial";
  }

  return "paid";
}

export function buildPaymentSummary(totalAmount: number, paidAmount: number): PaymentSummary {
  const normalizedTotal = roundMoney(totalAmount);
  const normalizedPaid = roundMoney(paidAmount);
  const balanceAmount = Math.max(0, roundMoney(normalizedTotal - normalizedPaid));

  return {
    balanceAmount,
    paidAmount: normalizedPaid,
    paymentStatus: resolvePaymentStatus(normalizedTotal, normalizedPaid),
    totalAmount: normalizedTotal
  };
}

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function prepareOrderForFirstPaymentMethod(
  supabase: SupabaseClient,
  orderId: string,
  method: PaymentMethod
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_method_expected")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("order_not_found");
  }

  if (order.payment_method_expected !== "unknown") {
    return;
  }

  const { data: existingPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", RECEIVED_PAYMENT_STATUS)
    .limit(1);

  if (paymentsError) {
    throw new Error("payments_fetch_failed");
  }

  if (existingPayments?.length) {
    return;
  }

  if (method === "transfer") {
    const { error: updateMethodError } = await supabase
      .from("orders")
      .update({ payment_method_expected: method })
      .eq("id", orderId);

    if (updateMethodError) {
      throw new Error("payment_method_update_failed");
    }

    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, quantity, product_variants ( cash_price, transfer_price )")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error("order_items_fetch_failed");
  }

  let totalAmount = 0;

  for (const item of (items ?? []) as OrderItemForPaymentMethod[]) {
    const variant = takeSingleRelation(item.product_variants);
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = roundMoney(Number(variant?.cash_price ?? 0));
    const lineTotal = roundMoney(unitPrice * quantity);

    totalAmount += lineTotal;

    const { error: itemUpdateError } = await supabase
      .from("order_items")
      .update({
        line_total: lineTotal,
        unit_price: unitPrice
      })
      .eq("id", item.id);

    if (itemUpdateError) {
      throw new Error("order_items_update_failed");
    }
  }

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({
      payment_method_expected: method,
      total_amount: roundMoney(totalAmount)
    })
    .eq("id", orderId);

  if (orderUpdateError) {
    throw new Error("payment_method_update_failed");
  }
}

export async function reconcileOrderPaymentStatus(
  supabase: SupabaseClient,
  orderId: string
): Promise<PaymentSummary> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("order_not_found");
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId)
    .eq("status", RECEIVED_PAYMENT_STATUS);

  if (paymentsError) {
    throw new Error("payments_fetch_failed");
  }

  const paidAmount = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const summary = buildPaymentSummary(Number(order.total_amount ?? 0), paidAmount);

  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: summary.paymentStatus })
    .eq("id", orderId);

  if (updateError) {
    throw new Error("payment_status_update_failed");
  }

  return summary;
}

export async function recordReceivedPayment({
  amount,
  method,
  orderId,
  receivedByUserId,
  reference,
  supabase
}: {
  amount: number;
  method: PaymentMethod;
  orderId: string;
  receivedByUserId: string;
  reference?: string | null;
  supabase: SupabaseClient;
}) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_payment_amount");
  }

  await prepareOrderForFirstPaymentMethod(supabase, orderId, method);

  const { error: insertError } = await supabase.from("payments").insert({
    amount: roundMoney(amount),
    method,
    order_id: orderId,
    received_at: new Date().toISOString(),
    received_by_user_id: receivedByUserId,
    reference: reference?.trim() || null,
    status: RECEIVED_PAYMENT_STATUS
  });

  if (insertError) {
    throw new Error("payment_insert_failed");
  }

  return reconcileOrderPaymentStatus(supabase, orderId);
}

export async function voidReceivedPayment({
  paymentId,
  reason,
  supabase,
  voidedByUserId
}: {
  paymentId: string;
  reason?: string | null;
  supabase: SupabaseClient;
  voidedByUserId: string;
}) {
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) {
    throw new Error("payment_not_found");
  }

  if (payment.status !== RECEIVED_PAYMENT_STATUS) {
    throw new Error("payment_not_voidable");
  }

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: REJECTED_PAYMENT_STATUS,
      void_reason: reason?.trim() || null,
      voided_at: new Date().toISOString(),
      voided_by_user_id: voidedByUserId
    })
    .eq("id", paymentId)
    .eq("status", RECEIVED_PAYMENT_STATUS);

  if (updateError) {
    throw new Error("payment_void_failed");
  }

  return reconcileOrderPaymentStatus(supabase, payment.order_id);
}
