"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { formatCurrency, getPaymentMethodLabel } from "@/lib/payments";
import type { ExpectedPaymentMethod, PaymentMethod } from "@/lib/types";

type PaymentRegisterFormProps = {
  balanceAmount: number;
  cashBalanceAmount?: number;
  defaultMethod: ExpectedPaymentMethod;
  orderId: string;
  transferBalanceAmount?: number;
};

function normalizeAmountInput(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

export function PaymentRegisterForm({
  balanceAmount,
  cashBalanceAmount,
  defaultMethod,
  orderId,
  transferBalanceAmount
}: PaymentRegisterFormProps) {
  const router = useRouter();
  const initialMethod = defaultMethod === "cash" || defaultMethod === "transfer" ? defaultMethod : "transfer";
  const [amount, setAmount] = useState(normalizeAmountInput(balanceAmount));
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [reference, setReference] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const numericAmount = Number(amount);
  const currentBalanceAmount = method === "cash" ? cashBalanceAmount ?? balanceAmount : transferBalanceAmount ?? balanceAmount;
  const exceedsBalance = numericAmount > currentBalanceAmount && currentBalanceAmount > 0;
  const canSubmit = Number.isFinite(numericAmount) && numericAmount > 0 && !isPending;
  const buttonLabel = useMemo(() => {
    if (isPending) {
      return "Guardando...";
    }

    return "Registrar pago";
  }, [isPending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setFeedback(null);

    const response = await fetch("/api/panel/payments", {
      body: JSON.stringify({
        amount: numericAmount,
        method,
        orderId,
        reference
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = (await response.json()) as { message?: string; success?: boolean };

    if (!response.ok || !result.success) {
      setFeedback(result.message ?? "No se pudo registrar el pago.");
      return;
    }

    setFeedback(result.message ?? "Pago registrado correctamente.");
    setReference("");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-card border border-line bg-paper-muted p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
        <label className="grid gap-1 text-xs text-ink-soft">
          Monto
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden transition focus:border-info-line"
          />
        </label>
        <label className="grid gap-1 text-xs text-ink-soft">
          Metodo
          <select
            value={method}
            onChange={(event) => {
              const nextMethod = event.target.value as PaymentMethod;
              setMethod(nextMethod);
              setAmount(
                normalizeAmountInput(
                  nextMethod === "cash"
                    ? cashBalanceAmount ?? balanceAmount
                    : transferBalanceAmount ?? balanceAmount
                )
              );
            }}
            className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden transition focus:border-info-line"
          >
            <option value="cash">{getPaymentMethodLabel("cash")}</option>
            <option value="transfer">{getPaymentMethodLabel("transfer")}</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-xs text-ink-soft">
        Referencia
        <input
          type="text"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Nota, comprobante o aclaracion"
          className="h-10 rounded-control border border-line bg-paper-muted px-3 text-sm text-ink outline-hidden transition placeholder:text-ink-faint focus:border-info-line"
        />
      </label>
      {exceedsBalance ? (
        <p className="rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-xs text-warn-fg">
          El monto supera el saldo de {formatCurrency(currentBalanceAmount)}. El pedido quedara pagado.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {buttonLabel}
      </button>
      {feedback ? <p className="text-xs text-ink-soft">{feedback}</p> : null}
    </form>
  );
}
