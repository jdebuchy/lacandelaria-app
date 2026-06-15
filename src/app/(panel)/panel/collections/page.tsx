import Link from "next/link";
import { PaymentRegisterForm } from "@/components/payment-register-form";
import { PaymentVoidButton } from "@/components/payment-void-button";
import { requirePageRole } from "@/lib/auth";
import { COLLECTION_ALLOWED_ROLES } from "@/lib/auth-shared";
import { formatPersonName, formatWhatsAppPhone } from "@/lib/contact";
import { getOrderStatusLabel } from "@/lib/delivery-trips";
import {
  buildPaymentSummary,
  formatCurrency,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExpectedPaymentMethod, OrderStatus, PaymentMethod } from "@/lib/types";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RelatedCustomer = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

type RelatedReseller = {
  full_name?: string | null;
  phone?: string | null;
};

type RelatedPayment = {
  amount: number | string;
  id: string;
  method: PaymentMethod;
  received_at: string | null;
  reference: string | null;
  status: string;
};

type RelatedOrderItem = {
  quantity: number | string | null;
  product_variants?: {
    cash_price?: number | string | null;
    transfer_price?: number | string | null;
  } | Array<{
    cash_price?: number | string | null;
    transfer_price?: number | string | null;
  }> | null;
};

function takeSingleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function calculateCashTotal(items: RelatedOrderItem[] | null | undefined) {
  return (items ?? []).reduce((sum, item) => {
    const variant = takeSingleRelation(item.product_variants ?? null);
    return sum + Number(item.quantity ?? 0) * Number(variant?.cash_price ?? 0);
  }, 0);
}

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-AR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function currentArgentinaDateKey() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

function paymentDateKey(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

export default async function CollectionsPage({ searchParams }: PageProps) {
  await requirePageRole(COLLECTION_ALLOWED_ROLES, "/panel/collections");

  const resolvedSearchParams = (await searchParams) ?? {};
  const statusFilter = getSearchValue(resolvedSearchParams, "status") || "open";
  const methodFilter = getSearchValue(resolvedSearchParams, "method") || "all";
  const search = getSearchValue(resolvedSearchParams, "q").trim().toLowerCase();
  const supabase = createAdminClient();
  let ordersQuery = supabase
    .from("orders")
    .select(
      `
        id,
        status,
        total_amount,
        payment_method_expected,
        payment_status,
        created_at,
        customers (
          first_name,
          last_name,
          phone
        ),
        resellers (
          full_name,
          phone
        ),
        payments (
          id,
          amount,
          method,
          status,
          received_at,
          reference
        ),
        order_items (
          quantity,
          product_variants (
            cash_price,
            transfer_price
          )
        )
      `
    )
    .order("created_at", { ascending: false });

  if (statusFilter === "open") {
    ordersQuery = ordersQuery.in("payment_status", ["pending", "partial"]);
  } else if (statusFilter === "paid") {
    ordersQuery = ordersQuery.eq("payment_status", "paid");
  } else if (statusFilter === "pending" || statusFilter === "partial") {
    ordersQuery = ordersQuery.eq("payment_status", statusFilter);
  }

  if (methodFilter === "unknown" || methodFilter === "cash" || methodFilter === "transfer") {
    ordersQuery = ordersQuery.eq("payment_method_expected", methodFilter);
  }

  const [{ data: orders, error: ordersError }, { data: todayPayments, error: todayPaymentsError }] =
    await Promise.all([
      ordersQuery,
      supabase
        .from("payments")
        .select("amount, received_at, status")
        .eq("status", "received")
    ]);

  if (ordersError) {
    console.error("collections orders fetch failed", ordersError);
  }

  if (todayPaymentsError) {
    console.error("collections today payments fetch failed", todayPaymentsError);
  }

  const todayKey = currentArgentinaDateKey();
  const rows = (orders ?? [])
    .map((order) => {
      const customer = takeSingleRelation<RelatedCustomer>(order.customers ?? null);
      const reseller = takeSingleRelation<RelatedReseller>(order.resellers ?? null);
      const payments = ((order.payments ?? []) as RelatedPayment[])
        .filter((payment) => payment.status === "received")
        .sort((a, b) => String(b.received_at ?? "").localeCompare(String(a.received_at ?? "")));
      const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
      const summary = buildPaymentSummary(Number(order.total_amount ?? 0), paidAmount);
      const paymentMethodExpected = order.payment_method_expected as ExpectedPaymentMethod;
      const cashTotalAmount =
        paymentMethodExpected === "unknown"
          ? calculateCashTotal((order.order_items ?? []) as RelatedOrderItem[])
          : Number(order.total_amount ?? 0);
      const cashSummary = buildPaymentSummary(cashTotalAmount, paidAmount);
      const lastPayment = payments[0];
      const customerName = customer
        ? formatPersonName(customer.first_name, customer.last_name)
        : reseller?.full_name || "Cliente sin nombre";
      const customerPhone = customer?.phone || reseller?.phone || "-";

      return {
        balanceAmount: summary.balanceAmount,
        createdAt: order.created_at,
        customerName,
        customerPhone,
        id: order.id,
        lastPayment,
        orderStatus: order.status as OrderStatus,
        paidAmount: summary.paidAmount,
        payments: payments.slice(0, 3),
        paymentMethodExpected,
        paymentStatus: summary.paymentStatus,
        searchText: `${customerName} ${customerPhone}`.toLowerCase(),
        cashBalanceAmount: cashSummary.balanceAmount,
        cashTotalAmount: cashSummary.totalAmount,
        totalAmount: summary.totalAmount
      };
    })
    .filter((row) => !search || row.searchText.includes(search));

  const pendingBalanceTotal = rows.reduce((sum, row) => sum + row.balanceAmount, 0);
  const collectedToday = ((todayPayments ?? []) as RelatedPayment[])
    .filter((payment) => paymentDateKey(payment.received_at) === todayKey)
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingCount = rows.filter((row) => row.paymentStatus === "pending").length;
  const partialCount = rows.filter((row) => row.paymentStatus === "partial").length;

  return (
    <main>
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
            Cobranza
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Seguimiento de pagos
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Saldo pendiente</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300 sm:text-3xl">
              {formatCurrency(pendingBalanceTotal)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Recaudado hoy</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300 sm:text-3xl">
              {formatCurrency(collectedToday)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold text-sky-300 sm:text-3xl">{pendingCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <p className="text-sm text-stone-400">Parciales</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300 sm:text-3xl">{partialCount}</p>
          </article>
        </div>

        <form className="grid gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
          <label className="grid gap-1 text-xs text-stone-400">
            Buscar
            <input
              name="q"
              defaultValue={getSearchValue(resolvedSearchParams, "q")}
              placeholder="Cliente o telefono"
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Estado
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="open">Pendientes y parciales</option>
              <option value="pending">Pendientes</option>
              <option value="partial">Parciales</option>
              <option value="paid">Pagados</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-stone-400">
            Metodo
            <select
              name="method"
              defaultValue={methodFilter}
              className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-sky-400"
            >
              <option value="all">Todos</option>
              <option value="unknown">No definido</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </label>
          <button
            type="submit"
            className="h-11 self-end rounded-xl bg-sky-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-sky-400"
          >
            Filtrar
          </button>
        </form>

        <section className="grid gap-4">
          {rows.length ? (
            rows.map((row) => (
              <article key={row.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4 lg:p-5">
                <div className="grid gap-5 xl:grid-cols-[1.2fr_2fr_360px]">
                  <div>
                    <p className="text-lg font-semibold text-stone-50">{row.customerName}</p>
                    <p className="mt-1 text-sm text-stone-400">{formatWhatsAppPhone(row.customerPhone)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-stone-700 bg-stone-950 px-3 py-1 text-xs text-stone-300">
                        {getOrderStatusLabel(row.orderStatus)}
                      </span>
                      <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
                        {getPaymentMethodLabel(row.paymentMethodExpected)}
                      </span>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        {getPaymentStatusLabel(row.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Total</p>
                      <p className="mt-1 text-sm font-medium text-stone-100">{formatCurrency(row.totalAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cobrado</p>
                      <p className="mt-1 text-sm font-medium text-emerald-200">{formatCurrency(row.paidAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Saldo</p>
                      <p className="mt-1 text-sm font-medium text-amber-200">{formatCurrency(row.balanceAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-stone-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Ultimo pago</p>
                      <p className="mt-1 text-sm font-medium text-stone-100">
                        {formatDateTime(row.lastPayment?.received_at ?? null)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <PaymentRegisterForm
                      balanceAmount={row.balanceAmount}
                      cashBalanceAmount={row.cashBalanceAmount}
                      defaultMethod={row.paymentMethodExpected}
                      orderId={row.id}
                      transferBalanceAmount={row.balanceAmount}
                    />
                    <Link
                      href={`/panel/orders/${row.id}/edit`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500"
                    >
                      Ver pedido
                    </Link>
                  </div>
                </div>
                {row.payments.length ? (
                  <div className="mt-5 border-t border-stone-800 pt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                      Pagos registrados
                    </p>
                    <div className="mt-3 grid gap-2">
                      {row.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="grid gap-3 rounded-2xl bg-stone-950/70 p-3 text-sm text-stone-300 sm:grid-cols-[1fr_auto]"
                        >
                          <div>
                            <p className="font-medium text-stone-100">
                              {formatCurrency(Number(payment.amount ?? 0))} ·{" "}
                              {getPaymentMethodLabel(payment.method)}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {formatDateTime(payment.received_at)}
                              {payment.reference ? ` · ${payment.reference}` : ""}
                            </p>
                          </div>
                          <PaymentVoidButton
                            amount={Number(payment.amount ?? 0)}
                            method={payment.method}
                            paymentId={payment.id}
                            receivedAt={formatDateTime(payment.received_at)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 px-6 py-10 text-sm text-stone-400">
              No hay pedidos para los filtros seleccionados.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
