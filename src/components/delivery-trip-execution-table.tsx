"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildWhatsAppHref } from "@/lib/contact";
import {
  getDeliveryFailureReasonLabel,
  getDeliveryStatusLabel
} from "@/lib/delivery-trips";
import { formatOrderNumber } from "@/lib/orders";
import { formatCurrency } from "@/lib/payments";
import type { DeliveryFailureReason, DeliveryStatus } from "@/lib/types";

export type DeliveryExecutionStop = {
  addressSummary: string;
  customerName: string;
  customerPhone: string;
  deliveryFailureReason: DeliveryFailureReason | null;
  deliveryStatus: DeliveryStatus;
  id: string;
  notes: string | null;
  orderNumber: number | null;
  orderStatus: string;
  paidAmount: number;
  paymentBalanceAmount: number;
  cashPaymentBalanceAmount: number;
  paymentMethodExpected: string;
  paymentStatus: string;
  sequenceNumber: number;
  totalAmount: number;
};

type DeliveryTripExecutionTableProps = {
  canManage: boolean;
  stops: DeliveryExecutionStop[];
  tripId: string;
  tripStatus: string;
};

type FeedbackByStop = Record<string, string>;
type PaymentAmountByStop = Record<string, string>;
type FailureReasonByStop = Record<string, DeliveryFailureReason>;
type NoteByStop = Record<string, string>;

const FAILURE_REASON_OPTIONS: DeliveryFailureReason[] = [
  "customer_absent",
  "incorrect_address",
  "rejected",
  "closed",
  "other"
];

function getExpectedPaymentMethodLabel(method: string) {
  if (method === "cash") {
    return "Efectivo";
  }

  if (method === "transfer") {
    return "Transferencia";
  }

  return "No definido";
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
    body: JSON.stringify({
      failureReason: options?.failureReason,
      note: options?.note,
      orderId,
      payment: options?.payment,
      status
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  return {
    response,
    result: (await response.json()) as { success: boolean; message: string }
  };
}

export function DeliveryTripExecutionTable({
  canManage,
  stops,
  tripId,
  tripStatus
}: DeliveryTripExecutionTableProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackByStop>({});
  const [paymentAmounts, setPaymentAmounts] = useState<PaymentAmountByStop>({});
  const [failureReasons, setFailureReasons] = useState<FailureReasonByStop>({});
  const [notes, setNotes] = useState<NoteByStop>({});
  const [pendingStopId, setPendingStopId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allowActions = canManage && tripStatus === "in_route";

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
      <div className="rounded-card border border-dashed border-line bg-paper px-6 py-10 text-body text-ink-soft">
        El viaje todavía no tiene pedidos para operar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-paper">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-body">
          <thead className="bg-paper-muted text-left text-meta text-ink-faint">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Direccion</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stops.map((stop) => {
              const isUpdating = pendingStopId === stop.id || isPending;
              const paymentAmount = paymentAmounts[stop.id] ?? String(stop.cashPaymentBalanceAmount || "");
              const numericPaymentAmount = Number(paymentAmount);
              const canCollectCash =
                (stop.paymentMethodExpected === "cash" || stop.paymentMethodExpected === "unknown") &&
                stop.paymentStatus !== "paid" &&
                stop.cashPaymentBalanceAmount > 0;
              const failureReason = failureReasons[stop.id] ?? stop.deliveryFailureReason ?? "customer_absent";
              const note = notes[stop.id] ?? stop.notes ?? "";
              const whatsappHref = buildWhatsAppHref(
                stop.customerPhone,
                `Hola ${stop.customerName}, te escribimos por tu pedido de La Candelaria.`
              );

              return (
                <tr key={stop.id} className="align-top">
                  <td className="px-4 py-4 text-ink-soft">{stop.sequenceNumber}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-ink">
                        <span className="text-ink-faint">{formatOrderNumber(stop.orderNumber)}</span>{" "}
                        {stop.customerName}
                      </p>
                      <p className="mt-1 text-meta text-ink-faint">{stop.customerPhone}</p>
                      {stop.notes ? (
                        <p className="mt-2 text-meta text-ink-soft">{stop.notes}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[220px]">
                      <p className="text-ink">{stop.addressSummary}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-soft">
                    <div className="min-w-[120px]">
                      <p>{getExpectedPaymentMethodLabel(stop.paymentMethodExpected)}</p>
                      <p className="mt-1 text-meta text-ink-faint">
                        {formatCurrency(stop.paidAmount)} / {formatCurrency(stop.totalAmount)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-soft">{formatCurrency(stop.totalAmount)}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[160px]">
                      <span className="inline-flex rounded-control border border-line bg-paper-muted px-3 py-1 text-meta text-ink-soft">
                        {getDeliveryStatusLabel(stop.deliveryStatus)}
                      </span>
                      {stop.deliveryFailureReason ? (
                        <p className="mt-2 text-meta text-danger-fg">
                          {getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-meta text-ink-faint">Pedido {stop.orderStatus}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid min-w-[260px] gap-2">
                      {whatsappHref ? (
                        <Link
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded-control border border-line px-3 text-meta font-medium text-ink transition hover:border-line-strong"
                        >
                          Escribir cliente
                        </Link>
                      ) : null}
                      {allowActions ? (
                        <>
                          {canCollectCash ? (
                            <div className="grid gap-2 rounded-card border border-accent bg-accent-soft p-3">
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
                                className="h-10 rounded-control border border-accent bg-paper-muted px-3 text-body text-ink outline-hidden transition focus:border-accent"
                                placeholder="Monto en efectivo"
                              />
                              <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(stop.id, "delivered", {
                                      note,
                                      payment: {
                                        amount: numericPaymentAmount,
                                        method: "cash",
                                        reference: `Cobro registrado en ${formatOrderNumber(stop.orderNumber)}`
                                      }
                                    })
                                  }
                                  disabled={
                                    isUpdating || !Number.isFinite(numericPaymentAmount) || numericPaymentAmount <= 0
                                  }
                                  className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-3 text-meta font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Entregar y cobrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(stop.id, "delivered", { note })}
                                  disabled={isUpdating}
                                  className="inline-flex h-10 items-center justify-center rounded-control border border-accent px-3 text-meta font-medium text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Entregar sin cobrar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(stop.id, "delivered", { note })}
                              disabled={isUpdating}
                              className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-3 text-meta font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Marcar entregado
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
                            className="h-10 rounded-control border border-line bg-paper-muted px-3 text-meta text-ink outline-hidden transition focus:border-danger-line"
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
                            className="h-10 rounded-control border border-line bg-paper-muted px-3 text-meta text-ink outline-hidden transition focus:border-line-strong"
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
                            className="inline-flex h-10 items-center justify-center rounded-control border border-danger-line bg-danger-bg px-3 text-meta font-medium text-danger-fg transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Marcar no entregado
                          </button>
                        </>
                      ) : null}
                      {feedback[stop.id] ? <p className="text-meta text-ink-soft">{feedback[stop.id]}</p> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
