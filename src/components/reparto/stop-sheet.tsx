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
  "inline-flex h-16 w-full items-center justify-center rounded-card bg-accent text-title font-bold text-accent-fg transition active:bg-accent disabled:opacity-50";
const DANGER_BUTTON =
  "inline-flex h-14 w-full items-center justify-center rounded-card border-2 border-danger-line text-[17px] font-semibold text-danger-fg transition active:bg-danger-bg disabled:opacity-50";
const CHOICE_BUTTON =
  "flex h-16 w-full flex-col items-center justify-center rounded-card bg-ink font-bold text-accent-fg transition active:bg-white disabled:opacity-50";
const QUIET_BUTTON =
  "inline-flex h-14 w-full items-center justify-center rounded-card border border-line-strong text-[17px] font-semibold text-ink transition active:bg-paper-raised disabled:opacity-50";
const LINK_BUTTON = "text-body font-medium text-ink-soft underline underline-offset-4";

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
    <div className="fixed inset-0 z-50 flex flex-col bg-paper-muted">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3">
        <button
          aria-label="Cerrar"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-soft transition active:bg-paper-raised"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
        <p className="flex-1 text-body font-medium text-ink-soft">
          Parada {stop.sequenceNumber} de {totalStops}
        </p>
        <p className="pr-2 text-body font-semibold tabular-nums text-ink-soft">
          {formatOrderNumber(stop.orderNumber)}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {step === "cobro" ? (
          <>
            <p className="text-[17px] text-ink-soft">Entregaste a</p>
            <p className="text-title font-bold text-ink">{stop.customerName}</p>
            <h2 className="mt-8 text-title font-bold text-ink">¿Cobraste?</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className={CHOICE_BUTTON}
                disabled={pending}
                onClick={() => submitDelivered({ amount: cashAmount, method: "cash" })}
                type="button"
              >
                <span className="text-body">EFECTIVO</span>
                <span className="text-title tabular-nums">{formatCurrency(cashAmount)}</span>
              </button>
              <button
                className={CHOICE_BUTTON}
                disabled={pending}
                onClick={() => submitDelivered({ amount: transferAmount, method: "transfer" })}
                type="button"
              >
                <span className="text-body">TRANSFERENCIA</span>
                <span className="text-title tabular-nums">{formatCurrency(transferAmount)}</span>
              </button>
            </div>

            <div className="mt-3">
              <button className={QUIET_BUTTON} disabled={pending} onClick={() => submitDelivered()} type="button">
                No cobré
              </button>
            </div>

            {showAmountInput ? (
              <label className="mt-6 block text-body text-ink-soft">
                Monto a cobrar
                <input
                  autoFocus
                  className="mt-2 h-14 w-full rounded-card border border-line-strong bg-paper px-4 text-title tabular-nums text-ink outline-hidden focus:border-warn-line"
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
            <h2 className="text-title font-bold text-ink">¿Qué pasó?</h2>
            <div className="mt-4 grid gap-2">
              {FAILURE_REASONS.map((reason) => (
                <button
                  className="inline-flex h-14 w-full items-center rounded-card border border-line-strong px-4 text-left text-[17px] font-semibold text-ink transition active:bg-paper-raised disabled:opacity-50"
                  disabled={pending}
                  key={reason}
                  onClick={() => submitFailed(reason)}
                  type="button"
                >
                  {getDeliveryFailureReasonLabel(reason)}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-body text-ink-soft">
              Comentario (obligatorio solo en “Otro”)
              <input
                className="mt-2 h-14 w-full rounded-card border border-line-strong bg-paper px-4 text-[17px] text-ink outline-hidden placeholder:text-ink-soft focus:border-line-strong"
                onChange={(event) => setNote(event.target.value)}
                placeholder="Qué pasó"
                type="text"
                value={note}
              />
            </label>
            <p className="mt-4 text-body leading-6 text-ink-soft">
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
              className={`inline-flex items-center rounded-control px-3 py-1 text-body font-bold text-accent-fg ${
                stop.deliveryStatus === "delivered" ? "bg-accent" : "bg-danger-bg"
              }`}
            >
              {stop.deliveryStatus === "delivered" ? "Entregado" : "No entregado"}
            </span>
            <h2 className="mt-3 text-title font-bold uppercase leading-tight text-ink">
              {stop.addressLine || stop.addressSummary}
            </h2>
            <p className="mt-1 text-[17px] text-ink-soft">{stop.customerName}</p>
            {stop.deliveryFailureReason ? (
              <p className="mt-3 text-[17px] text-danger-fg">
                {getDeliveryFailureReasonLabel(stop.deliveryFailureReason)}
              </p>
            ) : null}
            {stop.paidAmount > 0 ? (
              <p className="mt-3 text-[17px] tabular-nums text-warn-fg">
                Cobrado {formatCurrency(stop.paidAmount)}
              </p>
            ) : null}
            {stop.notes ? <p className="mt-3 text-body text-ink-soft">{stop.notes}</p> : null}

            <div className="mt-8">
              {stop.deliveryStatus === "delivered" && canAct ? (
                <>
                  <button className={QUIET_BUTTON} disabled={pending} onClick={reopenStop} type="button">
                    {pending ? "Corrigiendo…" : "Corregir: volver a pendiente"}
                  </button>
                  <p className="mt-3 text-body leading-6 text-ink-soft">
                    {ownPayments.length
                      ? "Se anula el cobro que registraste y la parada vuelve a quedar pendiente."
                      : "La parada vuelve a quedar pendiente."}
                  </p>
                </>
              ) : (
                <p className="text-body leading-6 text-ink-soft">
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
            <h2 className="text-display font-bold uppercase leading-none tracking-tight text-ink">
              {stop.addressLine || stop.addressSummary}
            </h2>
            {stop.locality ? <p className="mt-2 text-[17px] text-ink-soft">{stop.locality}</p> : null}
            <p className="mt-3 text-title font-semibold text-ink">{stop.customerName}</p>
            {stop.deliveryWindow ? (
              <p className="mt-2 text-[17px] font-semibold tabular-nums text-info-fg">
                Franja {stop.deliveryWindow}
              </p>
            ) : null}

            {stop.deliveryNotes ? (
              <p className="mt-4 rounded-card border border-info-line bg-info-bg px-4 py-3 text-body leading-6 text-info-fg">
                ⚑ {stop.deliveryNotes}
              </p>
            ) : null}

            {stop.itemsSummary ? (
              <p className="mt-4 text-[17px] text-ink-soft">{stop.itemsSummary}</p>
            ) : null}

            <div
              className={`mt-5 flex items-center justify-between rounded-card px-4 py-4 ${
                nothingToCollect ? "bg-paper-raised" : "bg-warn-bg"
              }`}
            >
              <span
                className={`text-body font-bold uppercase tracking-wide ${
                  nothingToCollect ? "text-ink-soft" : "text-accent-fg"
                }`}
              >
                {nothingToCollect ? "Ya pagó" : "A cobrar"}
              </span>
              {nothingToCollect ? null : (
                <span className="text-title font-bold tabular-nums text-accent-fg">
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
                className="inline-flex h-12 flex-1 items-center justify-center rounded-control border border-line-strong text-body font-semibold text-ink transition active:bg-paper-raised"
                href={buildNavigationHref(stop)}
                rel="noreferrer"
                target="_blank"
              >
                Navegar
              </a>
              {whatsappHref ? (
                <a
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-control border border-line-strong text-body font-semibold text-ink transition active:bg-paper-raised"
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
          <p className="mt-5 rounded-card border border-danger-line bg-danger-bg px-4 py-3 text-body leading-6 text-danger-fg">
            {error}
          </p>
        ) : null}
      </div>

      {step === "detalle" ? (
        <footer
          className="shrink-0 border-t border-line px-4 pb-6 pt-4"
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
            <p className="py-2 text-center text-body text-ink-soft">
              Iniciá el reparto para marcar entregas.
            </p>
          )}
        </footer>
      ) : null}
    </div>
  );
}
