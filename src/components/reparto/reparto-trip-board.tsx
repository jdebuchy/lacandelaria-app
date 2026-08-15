"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StopList, stopHtmlId } from "@/components/reparto/stop-list";
import { StopSheet } from "@/components/reparto/stop-sheet";
import { TripRibbon } from "@/components/reparto/trip-ribbon";
import type { DeliveryExecutionStop } from "@/lib/delivery-execution";
import type { DeliveryTripStatus } from "@/lib/types";

type RepartoTripBoardProps = {
  collectedAmount: number;
  currentUserId: string;
  stops: DeliveryExecutionStop[];
  tripStatus: DeliveryTripStatus;
};

export function RepartoTripBoard({
  collectedAmount,
  currentUserId,
  stops,
  tripStatus
}: RepartoTripBoardProps) {
  const router = useRouter();
  const [openStopId, setOpenStopId] = useState<string | null>(null);
  const openStop = stops.find((stop) => stop.tripOrderId === openStopId) ?? null;

  useEffect(() => {
    if (!openStop) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [openStop]);

  function scrollToStop(stopId: string) {
    document.getElementById(stopHtmlId(stopId))?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  return (
    <>
      <div className="sticky top-0 z-30">
        <TripRibbon collectedAmount={collectedAmount} onSelect={scrollToStop} stops={stops} />
      </div>

      <StopList onOpen={setOpenStopId} stops={stops} />

      {openStop ? (
        <StopSheet
          canAct={tripStatus === "in_route"}
          currentUserId={currentUserId}
          key={openStop.tripOrderId}
          onClose={() => setOpenStopId(null)}
          onResolved={() => router.refresh()}
          stop={openStop}
          totalStops={stops.length}
        />
      ) : null}
    </>
  );
}
