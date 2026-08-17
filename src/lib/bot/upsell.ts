import { precioEnChat, type CatalogVariant } from "./catalog";
import { resolveVariant } from "./order-items";
import type { OrderDraft } from "./order-draft";

// El upsell lo arma el codigo, no el modelo: el texto sale de la plantilla y el
// precio del catalogo. Un modelo sugiriendo productos inventa precios, y esa es
// la regla mas dura del proyecto.
export type UpsellSuggestion = {
  producto: string;
  presentacion?: string;
  // Como nombrarlo en el chat. "Nueces Mariposa Extra Light" es el nombre del
  // catalogo; en un chat el equipo escribe "nueces".
  etiqueta?: string;
};

export type UpsellRules = {
  activo: boolean;
  mensaje: string;
  sugerencias: UpsellSuggestion[];
};

// Se usa si commercial_settings no tiene la key upsell_rules. Los frutos secos
// son el complemento natural de la caja de paltas: es lo que ya vende el negocio
// y lo que aparece en el contexto comercial.
export const UPSELL_DEFAULT: UpsellRules = {
  activo: true,
  mensaje: "Aprovechás y sumás {etiqueta} de {presentacion} a {precio}?",
  sugerencias: [
    { producto: "Nueces Mariposa Extra Light", presentacion: "500g", etiqueta: "nueces" },
    { producto: "Castañas de Cajú", presentacion: "500g", etiqueta: "castañas de cajú" }
  ]
};

export function parseUpsellRules(valor: unknown): UpsellRules {
  if (!valor || typeof valor !== "object") {
    return UPSELL_DEFAULT;
  }

  const fuente = valor as Partial<UpsellRules>;

  if (typeof fuente.activo !== "boolean" || !Array.isArray(fuente.sugerencias)) {
    return UPSELL_DEFAULT;
  }

  return {
    activo: fuente.activo,
    mensaje: typeof fuente.mensaje === "string" && fuente.mensaje ? fuente.mensaje : UPSELL_DEFAULT.mensaje,
    sugerencias: fuente.sugerencias.filter(
      (s): s is UpsellSuggestion => Boolean(s) && typeof s.producto === "string"
    )
  };
}

export type UpsellPick = {
  variante: CatalogVariant;
  mensaje: string;
};

function precioSegunPago(variante: CatalogVariant, metodoPago: OrderDraft["metodoPago"]) {
  return metodoPago === "cash" ? variante.cashPrice : variante.transferPrice;
}

export function selectUpsell(
  reglas: UpsellRules,
  draft: OrderDraft,
  variantes: CatalogVariant[],
  variantesEnPedido: string[]
): UpsellPick | null {
  // Se ofrece una sola vez. Insistir con algo que ya rechazaron es lo que separa
  // una sugerencia de una molestia, y el cliente ya dijo que si al pedido.
  if (!reglas.activo || draft.upsellOfrecido) {
    return null;
  }

  for (const sugerencia of reglas.sugerencias) {
    const consulta = [sugerencia.producto, sugerencia.presentacion].filter(Boolean).join(" ");
    const resolucion = resolveVariant(consulta, variantes);

    if (resolucion.tipo !== "unica") {
      continue;
    }

    if (variantesEnPedido.includes(resolucion.variante.id)) {
      continue;
    }

    const etiqueta = sugerencia.etiqueta ?? resolucion.variante.familyName;
    const mensaje = reglas.mensaje
      .replace("{etiqueta}", etiqueta)
      .replace("{producto}", resolucion.variante.familyName)
      .replace("{presentacion}", resolucion.variante.label)
      .replace("{precio}", precioEnChat(precioSegunPago(resolucion.variante, draft.metodoPago)));

    return { variante: resolucion.variante, mensaje };
  }

  return null;
}
