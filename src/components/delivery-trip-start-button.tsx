"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DeliveryTripStartButtonProps = {
  tripId: string;
  disabled?: boolean;
  label?: string;
};

export function DeliveryTripStartButton({
  tripId,
  disabled = false,
  label = "Iniciar viaje"
}: DeliveryTripStartButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setMessage("");
    const response = await fetch(`/api/panel/delivery-trips/${tripId}/start`, {
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
        disabled={disabled || isPending}
        className="inline-flex h-10 items-center justify-center rounded-control bg-info-bg px-4 text-body font-medium text-accent-fg transition hover:bg-info-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Iniciando..." : label}
      </button>
      {message ? <p className="text-meta text-ink-soft">{message}</p> : null}
    </div>
  );
}
