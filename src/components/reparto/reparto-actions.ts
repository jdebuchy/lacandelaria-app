import type { DeliveryFailureReason, DeliveryStatus, PaymentMethod } from "@/lib/types";

export type RepartoResult = {
  message: string;
  ok: boolean;
};

type StopUpdateInput = {
  failureReason?: DeliveryFailureReason;
  note?: string;
  orderId: string;
  payment?: { amount: number; method: PaymentMethod; reference?: string };
  status: DeliveryStatus;
};

async function post(url: string, body: unknown): Promise<RepartoResult> {
  try {
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    const result = (await response.json()) as { success?: boolean; message?: string };

    return {
      message: result.message || (response.ok ? "Listo." : "No se pudo guardar."),
      ok: response.ok && result.success !== false
    };
  } catch {
    return { message: "Sin conexión. Probá de nuevo.", ok: false };
  }
}

export function updateStop(input: StopUpdateInput) {
  return post("/api/driver/update-delivery", input);
}

export function voidStopPayment(paymentId: string) {
  return post("/api/driver/void-payment", { paymentId });
}
