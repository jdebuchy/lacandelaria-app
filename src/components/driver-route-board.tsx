"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildWhatsAppHref } from "@/lib/contact";
import {
  getDeliveryFailureReasonLabel,
  getDeliveryStatusLabel
} from "@/lib/delivery-trips";
import { formatCurrency } from "@/lib/payments";
import type { DeliveryFailureReason, DeliveryStatus } from "@/lib/types";

type DriverStop = {
  addressSummary: string;
  customerName: string;
  customerPhone: string;
  deliveryFailureReason?: DeliveryFailureReason | null;
  deliveryDate: string | null;
  deliveryStatus: DeliveryStatus;
  flowGuidance: string;
  flowLabel: string;
  flowTone: "amber" | "sky" | "emerald";
  id: string;
  notes: string | null;
  orderStatus: string;
  paidAmount: number;
  paymentBalanceAmount: number;
  cashPaymentBalanceAmount: number;
  paymentMethodExpected: string;
  paymentStatus: string;
  totalAmount: number;
  itemsCount: number;
  itemsSummary: string;
  resellerName: string | null;
  sequenceNumber: number;
  deliveryArea: string;
};

type DriverRouteBoardProps = {
  allowActions?: boolean;
  stops: DriverStop[];
};

type FeedbackByStop = Record<string, string>;
type PaymentAmountByStop = Record<string, string>;
type FailureReasonByStop = Record<string, DeliveryFailureReason>;
type NoteByStop = Record<string, string>;

function getExpectedPaymentMethodLabel(method: string) {
  if (method === "cash") {
    return "Efectivo";
  }

  if (method === "transfer") {
    return "Transferencia";
  }

  return "No definido";
}

const FAILURE_REASON_OPTIONS: DeliveryFailureReason[] = [
  "customer_absent",
  "incorrect_address",
  "rejected",
  "closed",
  "other"
];

function toneClasses(tone: DriverStop["flowTone"]) {
  switch (tone) {
    case "amber":
      return "border-warn-line bg-warn-bg text-warn-fg";
    case "sky":
      return "border-info-line bg-info-bg text-info-fg";
    default:
      return "border-accent bg-accent-soft text-accent";
  }
}

function statusLabel(status: DeliveryStatus) {
  return getDeliveryStatusLabel(status);
}

async function updateStop(
  orderId: string,
  status: DeliveryStatus,
  options?: {
    failureReason?: DeliveryFailureReason;
    note?: string;
    payment?: { amount: number; method: "cash"; reference?: string };
  }
) {
  const response = await fetch("/api/driver/update-delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      failureReason: options?.failureReason,
      note: options?.note,
      orderId,
      payment: options?.payment,
      status
    })
  });

  return {
    response,
    result: (await response.json()) as { success: boolean; message: string }
  };
}

export function DriverRouteBoard({ stops, allowActions = true }: DriverRouteBoardProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackByStop>({});
  const [paymentAmounts, setPaymentAmounts] = useState<PaymentAmountByStop>({});
  const [failureReasons, setFailureReasons] = useState<FailureReasonByStop>({});
  const [notes, setNotes] = useState<NoteByStop>({});
  const [pendingStopId, setPendingStopId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleStatusChange(
    orderId: string,
    status: DeliveryStatus,
    options?: {
      failureReason?: DeliveryFailureReason;
      note?: string;
      payment?: { amount: number; method: "cash"; reference?: string };
    }
  ) {
    setPendingStopId(orderId);
    const { response, result } = await updateStop(orderId, status, options);

    setFeedback((current) => ({
      ...current,
      [orderId]: result.message
    }));

    setPendingStopId(null);

    if (response.ok) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  if (!stops.length) {
    return (
      <div className="rounded-card border border-dashed border-line bg-paper px-6 py-10 text-sm text-ink-soft">
        No hay pedidos activos para repartir.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {stops.map((stop) => {
        const isUpdating = pendingStopId === stop.id || isPending;
        const paymentAmount = paymentAmounts[stop.id] ?? String(stop.cashPaymentBalanceAmount || "");
        const numericPaymentAmount = Number(paymentAmount);
        const failureReason = failureReasons[stop.id] ?? stop.deliveryFailureReason ?? "customer_absent";
        const note = notes[stop.id] ?? stop.notes ?? "";
        const canCollectCash =
          (stop.paymentMethodExpected === "cash" || stop.paymentMethodExpected === "unknown") &&
          stop.paymentStatus !== "paid" &&
          stop.cashPaymentBalanceAmount > 0;
        const whatsappHref = buildWhatsAppHref(
          stop.customerPhone,
          `Hola ${stop.customerName}, te escribimos por tu pedido de La Candelaria.`
        );

        return (
          <article key={stop.id} className="rounded-card border border-line bg-paper p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-paper-muted px-3 text-sm font-semibold text-ink">
                    {stop.sequenceNumber}
                  </span>
                  <span className={`rounded-control border px-3 py-1 text-xs ${toneClasses(stop.flowTone)}`}>
                    {stop.flowLabel}
                  </span>
                  <span className="rounded-control border border-line bg-paper-muted px-3 py-1 text-xs text-ink-soft">
                    {statusLabel(stop.deliveryStatus)}
                  </span>
                  {stop.deliveryFailureReason ? (
                    <span className="rounded-control border border-danger-line bg-danger-bg px-3 py-1 text-xs text-danger-fg">
                      {getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}
                    </span>
                  ) : null}
                </div>

                <div>
                  <p className="text-xl font-semibold text-ink">{stop.customerName}</p>
                  <p className="mt-1 text-sm text-ink-soft">{stop.customerPhone}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Área</p>
                    <p className="mt-1 text-sm text-ink">{stop.deliveryArea}</p>
                  </div>
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Ítems</p>
                    <p className="mt-1 text-sm text-ink">{stop.itemsCount}</p>
                  </div>
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Pago</p>
                    <p className="mt-1 text-sm text-ink">
                      {getExpectedPaymentMethodLabel(stop.paymentMethodExpected)}
                    </p>
                  </div>
                  <div className="rounded-card bg-paper-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">Cobranza</p>
                    <p className="mt-1 text-sm text-ink">
                      {formatCurrency(stop.paidAmount)} / {formatCurrency(stop.totalAmount)}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">Saldo {formatCurrency(stop.paymentBalanceAmount)}</p>
                  </div>
                </div>

                <p className="text-sm leading-6 text-ink-soft">{stop.flowGuidance}</p>
                <p className="text-sm text-accent">{stop.itemsSummary}</p>
                <p className="text-sm text-ink-faint">{stop.addressSummary}</p>

                {stop.resellerName ? (
                  <p className="text-sm text-info-fg">Punto revendedora: {stop.resellerName}</p>
                ) : null}

                {stop.deliveryDate ? (
                  <p className="text-sm text-ink-soft">Fecha prevista: {stop.deliveryDate}</p>
                ) : null}

                {stop.notes ? (
                  <div className="rounded-card border border-line bg-paper-muted p-3 text-sm text-ink-soft">
                    {stop.notes}
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-[240px] flex-col gap-2">
                {whatsappHref ? (
                  <Link
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-control border border-accent bg-accent-soft px-4 text-sm font-medium text-accent transition hover:bg-accent-soft"
                  >
                    Escribir al cliente
                  </Link>
                ) : null}
                {allowActions ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(stop.id, "in_route")}
                      disabled={isUpdating}
                      className="inline-flex h-11 items-center justify-center rounded-control bg-info-bg px-4 text-sm font-medium text-accent-fg transition hover:bg-info-bg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? "Guardando..." : "Salir a entrega"}
                    </button>
                    {canCollectCash ? (
                      <div className="grid gap-2 rounded-card border border-accent bg-accent-soft p-3">
                        <label className="grid gap-1 text-xs text-accent">
                          Cobro en efectivo
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(event) =>
                              setPaymentAmounts((current) => ({
                                ...current,
                                [stop.id]: event.target.value
                              }))
                            }
                            className="h-10 rounded-control border border-accent bg-paper-muted px-3 text-sm text-ink outline-hidden transition focus:border-accent"
                          />
                        </label>
                        {numericPaymentAmount > stop.cashPaymentBalanceAmount ? (
                          <p className="text-xs text-warn-fg">
                            Supera el saldo. El pedido quedara pagado.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            handleStatusChange(stop.id, "delivered", {
                              note,
                              payment: {
                                amount: numericPaymentAmount,
                                method: "cash",
                                reference: "Cobro registrado por reparto"
                              }
                            })
                          }
                          disabled={isUpdating || !Number.isFinite(numericPaymentAmount) || numericPaymentAmount <= 0}
                          className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdating ? "Guardando..." : "Entregar y cobrar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(stop.id, "delivered", { note })}
                          disabled={isUpdating}
                          className="inline-flex h-10 items-center justify-center rounded-control border border-accent px-4 text-sm font-medium text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Entregar sin cobrar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(stop.id, "delivered", { note })}
                        disabled={isUpdating}
                        className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdating ? "Guardando..." : "Marcar entregado"}
                      </button>
                    )}
                    <select
                      value={failureReason}
                      onChange={(event) =>
                        setFailureReasons((current) => ({
                          ...current,
                          [stop.id]: event.target.value as DeliveryFailureReason
                        }))
                      }
                      className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden transition focus:border-danger-line"
                    >
                      {FAILURE_REASON_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {getDeliveryFailureReasonLabel(option)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={note}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [stop.id]: event.target.value
                        }))
                      }
                      placeholder="Comentario"
                      className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden transition placeholder:text-ink-faint focus:border-line-strong"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(stop.id, "failed", {
                          failureReason,
                          note
                        })
                      }
                      disabled={isUpdating}
                      className="inline-flex h-11 items-center justify-center rounded-control border border-danger-line bg-danger-bg px-4 text-sm font-medium text-danger-fg transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? "Guardando..." : "No entregado"}
                    </button>
                  </>
                ) : null}

                <div className="rounded-card border border-line bg-paper-muted p-3 text-xs text-ink-soft">
                  Estado pedido: {stop.orderStatus}
                </div>

                {feedback[stop.id] ? <p className="text-xs text-ink-soft">{feedback[stop.id]}</p> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
