import type { BotIntent } from "./types";

// Que puede contestar el bot por su cuenta. Sale del contexto comercial, que se
// genera desde la base con scripts/bot-sync-context.mjs. La regla del proyecto no
// es "el bot no habla de precios", es "los precios salen del ERP": mientras la
// respuesta venga de aca y no del modelo, se cumple.
export type BotCapabilities = {
  deliveryZones: boolean;
  prices: boolean;
  products: boolean;
};

export const NO_CAPABILITIES: BotCapabilities = {
  deliveryZones: false,
  prices: false,
  products: false
};

export function deriveCapabilities(context: Record<string, unknown>): BotCapabilities {
  const canAnswer = (context.can_answer ?? {}) as Record<string, unknown>;
  const zones = Array.isArray(context.delivery_zones) ? context.delivery_zones : [];
  const products = Array.isArray(context.products) ? context.products : [];

  // Doble candado: la bandera habilita, pero sin datos cargados no se contesta
  // igual. Asi un contexto a medio poblar deriva a humano en vez de improvisar.
  return {
    deliveryZones: canAnswer.delivery_zones === true && zones.length > 0,
    prices: canAnswer.prices === true && products.length > 0,
    products: canAnswer.products === true && products.length > 0
  };
}

export function canHandleIntent(intent: BotIntent, capabilities: BotCapabilities) {
  switch (intent) {
    case "ask_delivery":
      return capabilities.deliveryZones;
    case "ask_price":
      return capabilities.prices;
    case "ask_products":
      return capabilities.products;
    default:
      return true;
  }
}
