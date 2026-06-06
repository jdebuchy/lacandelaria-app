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
        className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Anulando..." : "Anular"}
      </button>
      {feedback ? <p className="text-xs text-stone-500">{feedback}</p> : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/80 px-4 py-5 backdrop-blur sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`void-payment-title-${paymentId}`}
            className="w-full max-w-md rounded-3xl border border-stone-800 bg-stone-950 p-5 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`void-payment-title-${paymentId}`} className="text-lg font-semibold text-stone-50">
                  Anular pago
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-400">
                  El movimiento queda en el historial como anulado y el estado del pedido se recalcula.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
                aria-label="Cerrar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-800 text-stone-400 transition hover:border-stone-600 hover:text-stone-100 disabled:opacity-60"
              >
                x
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-stone-900/70 p-3 text-sm">
              <p className="font-medium text-stone-100">
                {formatCurrency(amount)} · {getPaymentMethodLabel(method)}
              </p>
              <p className="mt-1 text-xs text-stone-500">{receivedAt}</p>
            </div>

            <label className="mt-4 grid gap-2 text-sm text-stone-300">
              Motivo
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={240}
                placeholder="Ej: cargado por error, pedido equivocado, importe incorrecto"
                className="resize-none rounded-2xl border border-stone-700 bg-stone-950 px-3 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-rose-300"
              />
            </label>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleVoidPayment}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
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
