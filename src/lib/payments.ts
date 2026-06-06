import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethod, PaymentStatus } from "@/lib/types";

export const RECEIVED_PAYMENT_STATUS = "received";
export const REJECTED_PAYMENT_STATUS = "rejected";

type PaymentSummary = {
  balanceAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  totalAmount: number;
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

export function getPaymentMethodLabel(method: PaymentMethod | string) {
  return method === "transfer" ? "Transferencia" : "Efectivo";
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
