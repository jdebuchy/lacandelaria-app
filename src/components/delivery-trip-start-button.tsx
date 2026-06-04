"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DeliveryTripStartButtonProps = {
  tripId: string;
  disabled?: boolean;
};

export function DeliveryTripStartButton({ tripId, disabled = false }: DeliveryTripStartButtonProps) {
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
        className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-medium text-stone-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Iniciando..." : "Iniciar viaje"}
      </button>
      {message ? <p className="text-xs text-stone-400">{message}</p> : null}
    </div>
  );
}
