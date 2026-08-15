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
        className={`inline-flex h-16 w-full items-center justify-center rounded-2xl text-lg font-bold transition disabled:opacity-50 ${
          action === "start"
            ? "bg-emerald-500 text-stone-950 active:bg-emerald-400"
            : "border-2 border-stone-500 text-stone-100 active:bg-stone-800"
        }`}
        disabled={busy}
        onClick={handleClick}
        type="button"
      >
        {busy ? COPY[action].pending : COPY[action].idle}
      </button>
      {message ? (
        <p className="mt-3 rounded-2xl border border-rose-500 bg-rose-500/15 px-4 py-3 text-[15px] leading-6 text-rose-200">
          {message}
        </p>
      ) : null}
    </div>
  );
}
