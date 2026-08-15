"use client";

import type { DeliveryExecutionStop } from "@/lib/delivery-execution";
import { formatCurrency } from "@/lib/payments";

type TripRibbonProps = {
  collectedAmount: number;
  onSelect: (stopId: string) => void;
  stops: DeliveryExecutionStop[];
};

function segmentClass(status: DeliveryExecutionStop["deliveryStatus"]) {
  if (status === "delivered") {
    return "bg-emerald-500";
  }

  if (status === "failed") {
    return "bg-rose-500";
  }

  return "bg-stone-700";
}

/**
 * Una franja con un segmento por parada. Con 5 a 15 paradas se lee de un vistazo a la
 * distancia de un brazo, y cada segmento salta a su parada.
 */
export function TripRibbon({ collectedAmount, onSelect, stops }: TripRibbonProps) {
  const resolved = stops.filter(
    (stop) => stop.deliveryStatus === "delivered" || stop.deliveryStatus === "failed"
  ).length;

  return (
    <div className="border-b border-stone-800 bg-stone-950 px-4 pb-3 pt-2">
      <div className="flex gap-1" role="list">
        {stops.map((stop) => (
          <button
            aria-label={`Parada ${stop.sequenceNumber}, ${stop.customerName}`}
            className={`h-2.5 flex-1 rounded-full transition ${segmentClass(stop.deliveryStatus)}`}
            key={stop.tripOrderId}
            onClick={() => onSelect(stop.tripOrderId)}
            role="listitem"
            type="button"
          />
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between text-sm">
        <p className="font-semibold tabular-nums text-stone-100">
          {resolved}
          <span className="text-stone-400">/{stops.length}</span>
          <span className="ml-2 font-normal text-stone-400">paradas</span>
        </p>
        <p className="font-semibold tabular-nums text-yellow-300">
          {formatCurrency(collectedAmount)}
          <span className="ml-2 text-xs font-normal text-stone-400">cobrado</span>
        </p>
      </div>
    </div>
  );
}
