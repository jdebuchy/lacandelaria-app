"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DeliveryTripCompleteButtonProps = {
  tripId: string;
};

export function DeliveryTripCompleteButton({ tripId }: DeliveryTripCompleteButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setMessage("");
    const response = await fetch(`/api/panel/delivery-trips/${tripId}/complete`, {
      method: "POST"
    });

    const result = (await response.json()) as { success: boolean; message: string };
    setMessage(result.message);

    if (!response.ok) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Finalizando..." : "Finalizar viaje"}
      </button>
      {message ? <p className="text-xs text-stone-400">{message}</p> : null}
    </div>
  );
}
