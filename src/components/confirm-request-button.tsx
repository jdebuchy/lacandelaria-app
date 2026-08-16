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
        <div className="inline-flex h-10 items-center justify-center rounded-control border border-line bg-paper-muted px-4 text-body font-medium text-ink-soft">
          {disabledLabel}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-body font-medium text-accent-fg transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Confirmando..." : "Confirmar pedido"}
        </button>
      )}
      {message ? <p className="text-meta text-ink-soft">{message}</p> : null}
    </div>
  );
}
