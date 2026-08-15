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
    return "bg-accent";
  }

  if (status === "failed") {
    return "bg-danger-bg";
  }

  return "bg-paper-raised";
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
    <div className="border-b border-line bg-paper-muted px-4 pb-3 pt-2">
      <div className="flex gap-1" role="list">
        {stops.map((stop) => (
          <button
            aria-label={`Parada ${stop.sequenceNumber}, ${stop.customerName}`}
            className={`h-2.5 flex-1 rounded-control transition ${segmentClass(stop.deliveryStatus)}`}
            key={stop.tripOrderId}
            onClick={() => onSelect(stop.tripOrderId)}
            role="listitem"
            type="button"
          />
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between text-sm">
        <p className="font-semibold tabular-nums text-ink">
          {resolved}
          <span className="text-ink-soft">/{stops.length}</span>
          <span className="ml-2 font-normal text-ink-soft">paradas</span>
        </p>
        <p className="font-semibold tabular-nums text-warn-fg">
          {formatCurrency(collectedAmount)}
          <span className="ml-2 text-xs font-normal text-ink-soft">cobrado</span>
        </p>
      </div>
    </div>
  );
}
