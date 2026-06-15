"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { DateInput } from "@/components/date-input";

type DriverOption = {
  id: string;
  name: string;
};

type TripStop = {
  customerName: string;
  id: string;
  orderId: string;
  sequenceNumber: number;
};

type DeliveryTripEditorProps = {
  drivers: DriverOption[];
  notes: string;
  scheduledDate: string;
  selectedDriverId: string | null;
  stops: TripStop[];
  tripId: string;
};

export function DeliveryTripEditor({
  drivers,
  notes: initialNotes,
  scheduledDate: initialScheduledDate,
  selectedDriverId,
  stops,
  tripId
}: DeliveryTripEditorProps) {
  const router = useRouter();
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [driverUserId, setDriverUserId] = useState(selectedDriverId ?? "");
  const [notes, setNotes] = useState(initialNotes);
  const [sequence, setSequence] = useState<Record<string, number>>(
    Object.fromEntries(stops.map((stop) => [stop.orderId, stop.sequenceNumber]))
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function setOrderSequence(orderId: string, value: number) {
    setSequence((current) => ({
      ...current,
      [orderId]: Math.max(1, value)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const orderedSequence = stops.map((stop) => ({
      orderId: stop.orderId,
      sequenceNumber: Number(sequence[stop.orderId] ?? stop.sequenceNumber)
    }));

    const response = await fetch(`/api/panel/delivery-trips/${tripId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scheduledDate,
        driverUserId,
        notes,
        sequence: orderedSequence
      })
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
    <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm text-stone-300">
          <span>Fecha del viaje</span>
          <DateInput
            value={scheduledDate}
            onChange={setScheduledDate}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none transition focus:border-sky-400"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-stone-300">
          <span>Repartidor</span>
          <select
            value={driverUserId}
            onChange={(event) => setDriverUserId(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none transition focus:border-sky-400"
          >
            <option value="">Sin asignar</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-stone-300 lg:col-span-1">
          <span>Notas</span>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none transition focus:border-sky-400"
            placeholder="Comentarios del viaje"
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3">
        {stops.map((stop) => (
          <div
            key={stop.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-950/70 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-stone-100">{stop.customerName}</p>
              <p className="text-xs text-stone-500">Pedido {stop.orderId.slice(0, 8)}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-300">
              <span>Orden</span>
              <input
                type="number"
                min={1}
                value={sequence[stop.orderId] ?? stop.sequenceNumber}
                onChange={(event) => setOrderSequence(stop.orderId, Number(event.target.value) || 1)}
                className="h-10 w-20 rounded-xl border border-stone-700 bg-stone-900 px-3 text-right text-stone-100 outline-none transition focus:border-sky-400"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-700 px-4 text-sm font-medium text-stone-100 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar viaje"}
        </button>
        {message ? <p className="text-sm text-stone-400">{message}</p> : null}
      </div>
    </form>
  );
}
