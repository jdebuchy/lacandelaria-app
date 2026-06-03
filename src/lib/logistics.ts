import { OrderStatus, SalesChannel } from "@/lib/types";

export type LogisticsFlow = "capital_federal" | "reseller" | "standard";

type InferLogisticsFlowInput = {
  address?: string | null;
  neighborhood?: string | null;
  resellerId?: string | null;
  salesChannel?: SalesChannel | null;
  zone?: string | null;
};

const CAPITAL_FEDERAL_KEYWORDS = [
  "capital federal",
  "caba",
  "ciudad autonoma de buenos aires",
  "ciudad de buenos aires"
];

const CAPITAL_FEDERAL_NEIGHBORHOODS = [
  "agronomia",
  "almagro",
  "balvanera",
  "barracas",
  "belgrano",
  "boedo",
  "caballito",
  "chacarita",
  "coghlan",
  "colegiales",
  "constitucion",
  "flores",
  "floresta",
  "la boca",
  "liniers",
  "mataderos",
  "monserrat",
  "monte castro",
  "nueva pompeya",
  "nuñez",
  "palermo",
  "parque avellaneda",
  "parque chacabuco",
  "parque chas",
  "parque patricios",
  "paternal",
  "puerto madero",
  "recoleta",
  "retiro",
  "saavedra",
  "san cristobal",
  "san nicolas",
  "san telmo",
  "velez sarsfield",
  "versalles",
  "villa crespo",
  "villa del parque",
  "villa devoto",
  "villa gral. mitre",
  "villa lugano",
  "villa luro",
  "villa ortuzar",
  "villa pueyrredon",
  "villa real",
  "villa riachuelo",
  "villa santa rita",
  "villa soldati",
  "villa urquiza"
];

function normalize(value?: string | null) {
  return value
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim() ?? "";
}

function looksLikeCapitalFederal(value?: string | null) {
  const normalized = normalize(value);

  if (!normalized) {
    return false;
  }

  return (
    CAPITAL_FEDERAL_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    CAPITAL_FEDERAL_NEIGHBORHOODS.some((neighborhood) => normalized.includes(neighborhood))
  );
}

export function inferLogisticsFlow(input: InferLogisticsFlowInput): LogisticsFlow {
  if (input.salesChannel === "reseller" || input.resellerId) {
    return "reseller";
  }

  if (
    looksLikeCapitalFederal(input.zone) ||
    looksLikeCapitalFederal(input.neighborhood) ||
    looksLikeCapitalFederal(input.address)
  ) {
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
