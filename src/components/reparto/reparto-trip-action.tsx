"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RepartoTripActionProps = {
  action: "start" | "complete";
  tripId: string;
};

const COPY = {
  complete: { idle: "Finalizar viaje", pending: "Finalizando…" },
  start: { idle: "Iniciar reparto", pending: "Iniciando…" }
} as const;

export function RepartoTripAction({ action, tripId }: RepartoTripActionProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);

  async function handleClick() {
    setMessage("");
    setIsSending(true);
    const response = await fetch(`/api/panel/delivery-trips/${tripId}/${action}`, {
      method: "POST"
    });
    const result = (await response.json()) as { success: boolean; message: string };
    setIsSending(false);

    if (!response.ok) {
      setMessage(result.message);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  const busy = isSending || isPending;

  return (
    <div>
      <button
        className={`inline-flex h-16 w-full items-center justify-center rounded-card text-lg font-bold transition disabled:opacity-50 ${
          action === "start"
            ? "bg-accent text-accent-fg active:bg-accent"
            : "border-2 border-line-strong text-ink active:bg-paper-raised"
        }`}
        disabled={busy}
        onClick={handleClick}
        type="button"
      >
        {busy ? COPY[action].pending : COPY[action].idle}
      </button>
      {message ? (
        <p className="mt-3 rounded-card border border-danger-line bg-danger-bg px-4 py-3 text-[15px] leading-6 text-danger-fg">
          {message}
        </p>
      ) : null}
    </div>
  );
}
