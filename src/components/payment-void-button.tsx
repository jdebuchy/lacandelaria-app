"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCurrency, getPaymentMethodLabel } from "@/lib/payments";
import type { PaymentMethod } from "@/lib/types";

type PaymentVoidButtonProps = {
  amount: number;
  method: PaymentMethod;
  paymentId: string;
  receivedAt: string;
};

export function PaymentVoidButton({ amount, method, paymentId, receivedAt }: PaymentVoidButtonProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleVoidPayment() {
    setFeedback(null);

    const response = await fetch("/api/panel/payments", {
      body: JSON.stringify({
        action: "void",
        paymentId,
        reason
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PATCH"
    });
    const result = (await response.json()) as { message?: string; success?: boolean };

    if (!response.ok || !result.success) {
      setFeedback(result.message ?? "No se pudo anular el pago.");
      return;
    }

    setFeedback(result.message ?? "Pago anulado correctamente.");
    setDialogOpen(false);
    setReason("");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={isPending}
        className="inline-flex h-8 items-center justify-center rounded-control border border-danger-line bg-danger-bg px-3 text-meta font-medium text-danger-fg transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Anulando..." : "Anular"}
      </button>
      {feedback ? <p className="text-meta text-ink-faint">{feedback}</p> : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-paper-muted px-4 py-5 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`void-payment-title-${paymentId}`}
            className="w-full max-w-md rounded-card border border-line bg-paper-muted p-5 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`void-payment-title-${paymentId}`} className="text-title font-semibold text-ink">
                  Anular pago
                </h2>
                <p className="mt-1 text-body leading-6 text-ink-soft">
                  El movimiento queda en el historial como anulado y el estado del pedido se recalcula.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
                aria-label="Cerrar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-line hover:text-ink disabled:opacity-60"
              >
                x
              </button>
            </div>

            <div className="mt-4 rounded-card bg-paper p-3 text-body">
              <p className="font-medium text-ink">
                {formatCurrency(amount)} · {getPaymentMethodLabel(method)}
              </p>
              <p className="mt-1 text-meta text-ink-faint">{receivedAt}</p>
            </div>

            <label className="mt-4 grid gap-2 text-body text-ink-soft">
              Motivo
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={240}
                placeholder="Ej: cargado por error, pedido equivocado, importe incorrecto"
                className="resize-none rounded-card border border-line bg-paper-muted px-3 py-3 text-body text-ink outline-hidden transition placeholder:text-ink-faint focus:border-danger-line"
              />
            </label>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center rounded-control border border-line px-4 text-body font-medium text-ink transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoidPayment}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center rounded-control bg-danger-bg px-4 text-body font-medium text-accent-fg transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Anulando..." : "Confirmar anulacion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
