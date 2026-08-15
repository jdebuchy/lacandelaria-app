"use client";

import { useState } from "react";
import { buildNavigationHref, type DeliveryExecutionStop } from "@/lib/delivery-execution";
import { buildWhatsAppHref } from "@/lib/contact";
import { getDeliveryFailureReasonLabel } from "@/lib/delivery-trips";
import { formatOrderNumber } from "@/lib/orders";
import { formatCurrency } from "@/lib/payments";
import type { DeliveryFailureReason, PaymentMethod } from "@/lib/types";
import { updateStop, voidStopPayment } from "@/components/reparto/reparto-actions";

type StopSheetProps = {
  canAct: boolean;
  currentUserId: string;
  onClose: () => void;
  onResolved: () => void;
  stop: DeliveryExecutionStop;
  totalStops: number;
};

type Step = "detalle" | "cobro" | "motivo" | "resuelta";

const FAILURE_REASONS: DeliveryFailureReason[] = [
  "customer_absent",
  "closed",
  "incorrect_address",
  "rejected",
  "other"
];

const PRIMARY_BUTTON =
  "inline-flex h-16 w-full items-center justify-center rounded-2xl bg-emerald-500 text-lg font-bold text-stone-950 transition active:bg-emerald-400 disabled:opacity-50";
const DANGER_BUTTON =
  "inline-flex h-14 w-full items-center justify-center rounded-2xl border-2 border-rose-500 text-[17px] font-semibold text-rose-300 transition active:bg-rose-500/20 disabled:opacity-50";
const CHOICE_BUTTON =
  "flex h-16 w-full flex-col items-center justify-center rounded-2xl bg-stone-100 font-bold text-stone-950 transition active:bg-white disabled:opacity-50";
const QUIET_BUTTON =
  "inline-flex h-14 w-full items-center justify-center rounded-2xl border border-stone-500 text-[17px] font-semibold text-stone-100 transition active:bg-stone-800 disabled:opacity-50";
const LINK_BUTTON = "text-[15px] font-medium text-stone-400 underline underline-offset-4";

export function StopSheet({
  canAct,
  currentUserId,
  onClose,
  onResolved,
  stop,
  totalStops
}: StopSheetProps) {
  const isResolved = stop.deliveryStatus === "delivered" || stop.deliveryStatus === "failed";
  const [step, setStep] = useState<Step>(isResolved ? "resuelta" : "detalle");
  const [customAmount, setCustomAmount] = useState("");
  const [showAmountInput, setShowAmountInput] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedCustomAmount = Number(customAmount);
  const hasCustomAmount = customAmount.trim() !== "" && Number.isFinite(parsedCustomAmount) && parsedCustomAmount > 0;
  const cashAmount = hasCustomAmount ? parsedCustomAmount : stop.cashPaymentBalanceAmount;
  const transferAmount = hasCustomAmount ? parsedCustomAmount : stop.transferPaymentBalanceAmount;
  const nothingToCollect = stop.cashPaymentBalanceAmount <= 0 && stop.transferPaymentBalanceAmount <= 0;
  const whatsappHref = buildWhatsAppHref(
    stop.customerPhone,
    `Hola ${stop.customerName}, te escribo por tu pedido de La Candelaria.`
  );
  const ownPayments = stop.payments.filter((payment) => payment.receivedByUserId === currentUserId);

  function goBackToDetail() {
    setError(null);
    setShowAmountInput(false);
    setCustomAmount("");
    setStep("detalle");
  }

  async function run(action: () => Promise<{ message: string; ok: boolean }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onResolved();
    onClose();
  }

  function submitDelivered(payment?: { amount: number; method: PaymentMethod }) {
    return run(() =>
      updateStop({
        note: note.trim() || undefined,
        orderId: stop.id,
        payment: payment
          ? { ...payment, reference: "Cobro registrado por reparto" }
          : undefined,
        status: "delivered"
      })
    );
  }

  function submitFailed(reason: DeliveryFailureReason) {
    if (reason === "other" && !note.trim()) {
      setError("Contá qué pasó para poder registrarlo.");
      return;
    }

    return run(() =>
      updateStop({
        failureReason: reason,
        note: note.trim() || undefined,
        orderId: stop.id,
        status: "failed"
      })
    );
  }

  function reopenStop() {
    return run(async () => {
      for (const payment of ownPayments) {
        const voided = await voidStopPayment(payment.id);

        if (!voided.ok) {
          return voided;
        }
      }

      return updateStop({ orderId: stop.id, status: "pending" });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-stone-800 px-3 py-3">
        <button
          aria-label="Cerrar"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-300 transition active:bg-stone-800"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
        <p className="flex-1 text-sm font-medium text-stone-400">
          Parada {stop.sequenceNumber} de {totalStops}
        </p>
        <p className="pr-2 text-sm font-semibold tabular-nums text-stone-400">
          {formatOrderNumber(stop.orderNumber)}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {step === "cobro" ? (
          <>
            <p className="text-[17px] text-stone-400">Entregaste a</p>
            <p className="text-2xl font-bold text-stone-50">{stop.customerName}</p>
            <h2 className="mt-8 text-xl font-bold text-stone-50">¿Cobraste?</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className={CHOICE_BUTTON}
                disabled={pending}
                onClick={() => submitDelivered({ amount: cashAmount, method: "cash" })}
                type="button"
              >
                <span className="text-[15px]">EFECTIVO</span>
                <span className="text-lg tabular-nums">{formatCurrency(cashAmount)}</span>
              </button>
              <button
                className={CHOICE_BUTTON}
                disabled={pending}
                onClick={() => submitDelivered({ amount: transferAmount, method: "transfer" })}
                type="button"
              >
                <span className="text-[15px]">TRANSFERENCIA</span>
                <span className="text-lg tabular-nums">{formatCurrency(transferAmount)}</span>
              </button>
            </div>

            <div className="mt-3">
              <button className={QUIET_BUTTON} disabled={pending} onClick={() => submitDelivered()} type="button">
                No cobré
              </button>
            </div>

            {showAmountInput ? (
              <label className="mt-6 block text-sm text-stone-400">
                Monto a cobrar
                <input
                  autoFocus
                  className="mt-2 h-14 w-full rounded-2xl border border-stone-500 bg-stone-900 px-4 text-xl tabular-nums text-stone-50 outline-hidden focus:border-yellow-400"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setCustomAmount(event.target.value)}
                  step="0.01"
                  type="number"
                  value={customAmount}
                />
              </label>
            ) : (
              <div className="mt-6 flex items-center justify-between gap-4">
                <button className={LINK_BUTTON} onClick={goBackToDetail} type="button">
                  Volver
                </button>
                <button
                  className={LINK_BUTTON}
                  onClick={() => setShowAmountInput(true)}
                  type="button"
                >
                  Cobrar otro monto
                </button>
              </div>
            )}
          </>
        ) : null}

        {step === "motivo" ? (
          <>
            <h2 className="text-xl font-bold text-stone-50">¿Qué pasó?</h2>
            <div className="mt-4 grid gap-2">
              {FAILURE_REASONS.map((reason) => (
                <button
                  className="inline-flex h-14 w-full items-center rounded-2xl border border-stone-500 px-4 text-left text-[17px] font-semibold text-stone-100 transition active:bg-stone-800 disabled:opacity-50"
                  disabled={pending}
                  key={reason}
                  onClick={() => submitFailed(reason)}
                  type="button"
                >
                  {getDeliveryFailureReasonLabel(reason)}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-sm text-stone-400">
              Comentario (obligatorio solo en “Otro”)
              <input
                className="mt-2 h-14 w-full rounded-2xl border border-stone-500 bg-stone-900 px-4 text-[17px] text-stone-50 outline-hidden placeholder:text-stone-400 focus:border-stone-400"
                onChange={(event) => setNote(event.target.value)}
                placeholder="Qué pasó"
                type="text"
                value={note}
              />
            </label>
            <p className="mt-4 text-sm leading-6 text-stone-400">
              El pedido vuelve a logística para reprogramarlo y sale de este viaje.
            </p>
            <div className="mt-5">
              <button className={LINK_BUTTON} onClick={goBackToDetail} type="button">
                Volver
              </button>
            </div>
          </>
        ) : null}

        {step === "resuelta" ? (
          <>
            <span
              className={`inline-flex items-center rounded-lg px-3 py-1 text-sm font-bold text-stone-950 ${
                stop.deliveryStatus === "delivered" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            >
              {stop.deliveryStatus === "delivered" ? "Entregado" : "No entregado"}
            </span>
            <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-stone-50">
              {stop.addressLine || stop.addressSummary}
            </h2>
            <p className="mt-1 text-[17px] text-stone-300">{stop.customerName}</p>
            {stop.deliveryFailureReason ? (
              <p className="mt-3 text-[17px] text-rose-300">
                {getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}
              </p>
            ) : null}
            {stop.paidAmount > 0 ? (
              <p className="mt-3 text-[17px] tabular-nums text-yellow-300">
                Cobrado {formatCurrency(stop.paidAmount)}
              </p>
            ) : null}
            {stop.notes ? <p className="mt-3 text-[15px] text-stone-400">{stop.notes}</p> : null}

            <div className="mt-8">
              {stop.deliveryStatus === "delivered" && canAct ? (
                <>
                  <button className={QUIET_BUTTON} disabled={pending} onClick={reopenStop} type="button">
                    {pending ? "Corrigiendo…" : "Corregir: volver a pendiente"}
                  </button>
                  <p className="mt-3 text-sm leading-6 text-stone-400">
                    {ownPayments.length
                      ? "Se anula el cobro que registraste y la parada vuelve a quedar pendiente."
                      : "La parada vuelve a quedar pendiente."}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-6 text-stone-400">
                  {stop.deliveryStatus === "failed"
                    ? "Esta parada ya salió del viaje. Para corregirla, avisá a la oficina."
                    : "El viaje ya no está en curso."}
                </p>
              )}
            </div>
          </>
        ) : null}

        {step === "detalle" ? (
          <>
            <h2 className="text-3xl font-bold uppercase leading-none tracking-tight text-stone-50">
              {stop.addressLine || stop.addressSummary}
            </h2>
            {stop.locality ? <p className="mt-2 text-[17px] text-stone-400">{stop.locality}</p> : null}
            <p className="mt-3 text-xl font-semibold text-stone-100">{stop.customerName}</p>
            {stop.deliveryWindow ? (
              <p className="mt-2 text-[17px] font-semibold tabular-nums text-sky-300">
                Franja {stop.deliveryWindow}
              </p>
            ) : null}

            {stop.deliveryNotes ? (
              <p className="mt-4 rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-[15px] leading-6 text-sky-200">
                ⚑ {stop.deliveryNotes}
              </p>
            ) : null}

            {stop.itemsSummary ? (
              <p className="mt-4 text-[17px] text-stone-300">{stop.itemsSummary}</p>
            ) : null}

            <div
              className={`mt-5 flex items-center justify-between rounded-2xl px-4 py-4 ${
                nothingToCollect ? "bg-stone-800" : "bg-yellow-400"
              }`}
            >
              <span
                className={`text-sm font-bold uppercase tracking-wide ${
                  nothingToCollect ? "text-stone-300" : "text-stone-950"
                }`}
              >
                {nothingToCollect ? "Ya pagó" : "A cobrar"}
              </span>
              {nothingToCollect ? null : (
                <span className="text-2xl font-bold tabular-nums text-stone-950">
                  {formatCurrency(
                    stop.paymentMethodExpected === "transfer"
                      ? stop.transferPaymentBalanceAmount
                      : stop.cashPaymentBalanceAmount
                  )}
                </span>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <a
                className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-stone-500 text-[15px] font-semibold text-stone-100 transition active:bg-stone-800"
                href={buildNavigationHref(stop)}
                rel="noreferrer"
                target="_blank"
              >
                Navegar
              </a>
              {whatsappHref ? (
                <a
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-stone-500 text-[15px] font-semibold text-stone-100 transition active:bg-stone-800"
                  href={whatsappHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  Escribir
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-500 bg-rose-500/15 px-4 py-3 text-[15px] leading-6 text-rose-200">
            {error}
          </p>
        ) : null}
      </div>

      {step === "detalle" ? (
        <footer
          className="shrink-0 border-t border-stone-800 px-4 pb-6 pt-4"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          {canAct ? (
            <div className="grid gap-3">
              <button
                className={PRIMARY_BUTTON}
                disabled={pending}
                onClick={() => (nothingToCollect ? submitDelivered() : setStep("cobro"))}
                type="button"
              >
                {pending ? "Guardando…" : "ENTREGUÉ"}
              </button>
              <button
                className={DANGER_BUTTON}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setStep("motivo");
                }}
                type="button"
              >
                No entregué
              </button>
            </div>
          ) : (
            <p className="py-2 text-center text-[15px] text-stone-400">
              Iniciá el reparto para marcar entregas.
            </p>
          )}
        </footer>
      ) : null}
    </div>
  );
}
