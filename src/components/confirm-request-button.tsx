"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ConfirmRequestButtonProps = {
  requestId: string;
  disabled?: boolean;
  disabledLabel?: string;
};

export function ConfirmRequestButton({
  requestId,
  disabled = false,
  disabledLabel = "Pedido ya confirmado"
}: ConfirmRequestButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setMessage("");

    const response = await fetch("/api/panel/confirm-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requestId })
    });

    const result = (await response.json()) as { success: boolean; message: string };
    setMessage(result.message);

    if (response.ok) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {disabled ? (
        <div className="inline-flex h-10 items-center justify-center rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm font-medium text-stone-400">
          {disabledLabel}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Confirmando..." : "Confirmar pedido"}
        </button>
      )}
      {message ? <p className="text-xs text-stone-400">{message}</p> : null}
    </div>
  );
}
