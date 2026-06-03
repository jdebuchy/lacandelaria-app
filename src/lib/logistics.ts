import { OrderStatus, SalesChannel } from "@/lib/types";
import { looksLikeCapitalFederal } from "@/lib/address";

export type LogisticsFlow = "capital_federal" | "reseller" | "standard";

type InferLogisticsFlowInput = {
  addressLine1?: string | null;
  administrativeAreaLevel1?: string | null;
  deliveryArea?: string | null;
  locality?: string | null;
  resellerId?: string | null;
  salesChannel?: SalesChannel | null;
};

export function inferLogisticsFlow(input: InferLogisticsFlowInput): LogisticsFlow {
  if (input.salesChannel === "reseller" || input.resellerId) {
    return "reseller";
  }

  if (input.deliveryArea === "capital_federal") {
    return "capital_federal";
  }

  if (looksLikeCapitalFederal([input.locality, input.administrativeAreaLevel1, input.addressLine1])) {
    return "capital_federal";
  }

  return "standard";
}

export function getLogisticsFlowLabel(flow: LogisticsFlow) {
  switch (flow) {
    case "capital_federal":
      return "Capital Federal";
    case "reseller":
      return "Revendedora";
    default:
      return "Ruta estandar";
  }
}

export function getLogisticsFlowGuidance(flow: LogisticsFlow) {
  switch (flow) {
    case "capital_federal":
      return "Priorizar contacto y ventana corta de entrega para evitar ausencias.";
    case "reseller":
      return "Consolidar cajas y entregar en punto unico antes de la distribucion final.";
    default:
      return "Despacho directo por zona con seguimiento normal de entrega.";
  }
}

export function getLogisticsFlowTone(flow: LogisticsFlow): "amber" | "sky" | "emerald" {
  switch (flow) {
    case "capital_federal":
      return "amber";
    case "reseller":
      return "sky";
    default:
      return "emerald";
  }
}

export function isActiveLogisticsStatus(status: OrderStatus) {
  return status !== "delivered" && status !== "cancelled";
}
