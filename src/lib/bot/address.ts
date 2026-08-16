import type { PlaceSuggestion } from "@/lib/google-places";

// Lo que el bot sabe de la direccion en un momento dado. Vive en el draft_order
// de la conversacion y se va completando de a un dato por mensaje.
export type AddressDraft = {
  texto: string | null;
  googlePlaceId: string | null;
  etiqueta: string | null;
  addressKind: "standard" | "gated" | null;
  gatedCommunityName: string | null;
  esDepartamento: boolean | null;
  addressLine2: string | null;
  intentos: number;
};

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  texto: null,
  googlePlaceId: null,
  etiqueta: null,
  addressKind: null,
  gatedCommunityName: null,
  esDepartamento: null,
  addressLine2: null,
  intentos: 0
};

// Despues de dos intentos fallidos se acepta lo que escribio el cliente y se
// sigue. Insistir es peor: Google no conoce todas las direcciones, y un cliente
// al que le piden tres veces la misma cosa abandona la compra.
export const MAX_INTENTOS_DIRECCION = 2;

export type SuggestionPick =
  | { tipo: "clara"; sugerencia: PlaceSuggestion }
  | { tipo: "ambigua"; opciones: PlaceSuggestion[] }
  | { tipo: "ninguna" };

function numerosDe(texto: string) {
  return (texto.match(/\d+/g) ?? []).filter((n) => n.length >= 2);
}

// Places casi siempre devuelve varias sugerencias, asi que "una sola" no sirve
// como criterio. Se considera clara cuando el numero de calle que escribio el
// cliente aparece en una sola de las opciones: ahi no hay nada que preguntar.
export function pickSuggestion(query: string, suggestions: PlaceSuggestion[]): SuggestionPick {
  if (!suggestions.length) {
    return { tipo: "ninguna" };
  }

  if (suggestions.length === 1) {
    return { tipo: "clara", sugerencia: suggestions[0] };
  }

  const numeros = numerosDe(query);

  if (numeros.length) {
    const conNumero = suggestions.filter((s) =>
      numeros.some((n) => s.fullText.includes(n))
    );

    if (conNumero.length === 1) {
      return { tipo: "clara", sugerencia: conNumero[0] };
    }
  }

  return { tipo: "ambigua", opciones: suggestions.slice(0, 3) };
}

export type AddressGap = "calle" | "confirmar_calle" | "tipo_vivienda" | "piso_depto" | "nombre_barrio";

// Devuelve el primer dato que falta, no todos: el equipo pide de a uno y en chat
// la gente contesta solo la mitad de lo que se le pregunta junto.
export function nextAddressGap(draft: AddressDraft): AddressGap | null {
  if (!draft.texto) {
    return "calle";
  }

  if (!draft.googlePlaceId && draft.intentos < MAX_INTENTOS_DIRECCION) {
    return "confirmar_calle";
  }

  if (draft.addressKind === "gated") {
    return draft.gatedCommunityName ? null : "nombre_barrio";
  }

  if (draft.esDepartamento === null) {
    return "tipo_vivienda";
  }

  if (draft.esDepartamento && !draft.addressLine2) {
    return "piso_depto";
  }

  return null;
}

// Los textos siguen el tono medido del equipo: cortos, sin signos de apertura,
// en minuscula y de a una pregunta por vez.
export function buildAddressQuestion(gap: AddressGap, draft: AddressDraft): string {
  switch (gap) {
    case "calle":
      return "me pasas la direccion de entrega?";
    case "confirmar_calle":
      return draft.etiqueta
        ? `te la dejo en ${draft.etiqueta}?`
        : "me la pasas de nuevo con la calle y el numero?";
    case "tipo_vivienda":
      return "es casa o departamento?";
    case "piso_depto":
      return "que piso y depto?";
    case "nombre_barrio":
      return "como se llama el barrio?";
  }
}

export function buildAmbiguousQuestion(opciones: PlaceSuggestion[]) {
  const lista = opciones.map((o, i) => `${i + 1}. ${o.fullText}`).join("\n");
  return `encontre varias, cual es?\n${lista}`;
}

export function isAddressComplete(draft: AddressDraft) {
  return nextAddressGap(draft) === null;
}
