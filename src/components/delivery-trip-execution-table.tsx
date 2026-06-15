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

export type DeliveryExecutionStop = {
  addressSummary: string;
  customerName: string;
  customerPhone: string;
  deliveryFailureReason: DeliveryFailureReason | null;
  deliveryStatus: DeliveryStatus;
  id: string;
  notes: string | null;
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
      <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 px-6 py-10 text-sm text-stone-400">
        El viaje todavía no tiene pedidos para operar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/70">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-800 text-sm">
          <thead className="bg-stone-950/70 text-left text-xs uppercase tracking-[0.16em] text-stone-500">
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
          <tbody className="divide-y divide-stone-800">
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
                  <td className="px-4 py-4 text-stone-300">{stop.sequenceNumber}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-stone-100">{stop.customerName}</p>
                      <p className="mt-1 text-xs text-stone-500">{stop.customerPhone}</p>
                      {stop.notes ? (
                        <p className="mt-2 text-xs text-stone-400">{stop.notes}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[220px]">
                      <p className="text-stone-200">{stop.addressSummary}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-stone-300">
                    <div className="min-w-[120px]">
                      <p>{getExpectedPaymentMethodLabel(stop.paymentMethodExpected)}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatCurrency(stop.paidAmount)} / {formatCurrency(stop.totalAmount)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-stone-300">{formatCurrency(stop.totalAmount)}</td>
                  <td className="px-4 py-4">
                    <div className="min-w-[160px]">
                      <span className="inline-flex rounded-full border border-stone-700 bg-stone-950/80 px-3 py-1 text-xs text-stone-300">
                        {getDeliveryStatusLabel(stop.deliveryStatus)}
                      </span>
                      {stop.deliveryFailureReason ? (
                        <p className="mt-2 text-xs text-rose-300">
                          {getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-stone-500">Pedido {stop.orderStatus}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid min-w-[260px] gap-2">
                      {whatsappHref ? (
                        <Link
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-stone-700 px-3 text-xs font-medium text-stone-100 transition hover:border-stone-500"
                        >
                          Escribir cliente
                        </Link>
                      ) : null}
                      {allowActions ? (
                        <>
                          {canCollectCash ? (
                            <div className="grid gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
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
                                className="h-10 rounded-xl border border-emerald-400/20 bg-stone-950 px-3 text-sm text-stone-100 outline-none transition focus:border-emerald-300"
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
                                        reference: `Cobro registrado en viaje ${tripId.slice(0, 8)}`
                                      }
                                    })
                                  }
                                  disabled={
                                    isUpdating || !Number.isFinite(numericPaymentAmount) || numericPaymentAmount <= 0
                                  }
                                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-3 text-xs font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Entregar y cobrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(stop.id, "delivered", { note })}
                                  disabled={isUpdating}
                                  className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/20 px-3 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-3 text-xs font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="h-10 rounded-xl border border-stone-700 bg-stone-950 px-3 text-xs text-stone-100 outline-none transition focus:border-rose-300"
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
                            className="h-10 rounded-xl border border-stone-700 bg-stone-950 px-3 text-xs text-stone-100 outline-none transition focus:border-stone-500"
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
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Marcar no entregado
                          </button>
                        </>
                      ) : null}
                      {feedback[stop.id] ? <p className="text-xs text-stone-400">{feedback[stop.id]}</p> : null}
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
