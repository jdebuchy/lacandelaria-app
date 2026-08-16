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
  // Las opciones que se le ofrecieron al cliente, para poder resolver su
  // eleccion en el mensaje siguiente.
  opciones: PlaceSuggestion[] | null;
  // Cuantas veces seguidas se repitio la misma pregunta sin obtener respuesta.
  repeticiones: number;
  // Que se le pregunto en el mensaje anterior, para poder interpretar la
  // respuesta: un "departamento" suelto solo significa algo si sabemos que
  // veniamos de preguntar si era casa o departamento.
  ultimaPregunta: AddressGap | null;
};

export type AddressGap = "calle" | "confirmar_calle" | "tipo_vivienda" | "piso_depto" | "nombre_barrio";

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  texto: null,
  googlePlaceId: null,
  etiqueta: null,
  addressKind: null,
  gatedCommunityName: null,
  esDepartamento: null,
  addressLine2: null,
  intentos: 0,
  opciones: null,
  repeticiones: 0,
  ultimaPregunta: null
};

// Despues de dos intentos fallidos se acepta lo que escribio el cliente y se
// sigue. Insistir es peor: Google no conoce todas las direcciones, y un cliente
// al que le piden tres veces la misma cosa abandona la compra.
export const MAX_INTENTOS_DIRECCION = 2;

// Ninguna pregunta se hace mas de dos veces. Da igual cual sea y da igual por
// que el cliente no la contesta: si insistimos, el bucle es infinito y la venta
// se cae. A la tercera se sigue con lo que haya y, si falta algo critico, lo
// completa una persona.
export const MAX_REPETICIONES_PREGUNTA = 2;

// Cuenta cuantas veces seguidas se hizo la misma pregunta. Vive en el draft
// porque el bot no tiene memoria entre mensajes mas alla de eso.
export function countRepetition(draft: AddressDraft, gap: AddressGap): number {
  return draft.ultimaPregunta === gap ? draft.repeticiones + 1 : 0;
}

export type SuggestionPick =
  | { tipo: "clara"; sugerencia: PlaceSuggestion }
  | { tipo: "ambigua"; opciones: PlaceSuggestion[] }
  | { tipo: "ninguna" };

// Sin heuristicas. Antes esto contaba numeros y palabras para adivinar si una
// direccion era "clara", y cada calle que no encajaba pedia otra regla: no
// escala y no hay forma de saber si la proxima excepcion la rompe.
//
// El criterio es el de un formulario con autocompletado, que es lo que la gente
// ya sabe usar: una sola opcion se toma, varias se muestran para que elija.
// Quien sabe cual es su direccion es el cliente, no nosotros.
export function pickSuggestion(_query: string, suggestions: PlaceSuggestion[]): SuggestionPick {
  if (!suggestions.length) {
    return { tipo: "ninguna" };
  }

  if (suggestions.length === 1) {
    return { tipo: "clara", sugerencia: suggestions[0] };
  }

  return { tipo: "ambigua", opciones: suggestions.slice(0, 3) };
}

// Resuelve la eleccion del cliente entre las opciones que se le ofrecieron.
// Acepta el numero ("2"), el nombre parcial ("la de san isidro") o el texto
// completo: en un chat la gente contesta de las tres formas.
export function resolveChoice(texto: string, opciones: PlaceSuggestion[]): PlaceSuggestion | null {
  const limpio = texto.trim().toLowerCase();

  if (!limpio || !opciones.length) {
    return null;
  }

  const soloNumero = limpio.match(/^(\d)\b/);

  if (soloNumero) {
    const indice = Number(soloNumero[1]) - 1;
    return opciones[indice] ?? null;
  }

  const coincidencias = opciones.filter((o) => {
    const texto = o.fullText.toLowerCase();
    return limpio.split(/\s+/).some((palabra) => palabra.length >= 4 && texto.includes(palabra));
  });

  return coincidencias.length === 1 ? coincidencias[0] : null;
}

// Una direccion util tiene calle y altura. Sin esto, un "4B" o un "departamento"
// sueltos entran como direccion: el modelo los completa inventando una calle
// plausible, y el pedido termina con un domicilio que el cliente nunca dijo.
export function looksLikeStreetAddress(texto: string) {
  const limpio = texto.trim();

  if (limpio.length < 6) {
    return false;
  }

  const tieneAltura = /\d{2,}/.test(limpio);
  const tienePalabras = /[a-záéíóúñ]{3,}/i.test(limpio);

  return tieneAltura && tienePalabras;
}

// Decide con que quedarse cuando el modelo devuelve una direccion nueva.
// Una vez que Google confirmo una, no se pisa: los mensajes siguientes del
// cliente ("4B", "es un depto") aportan detalles, no una direccion distinta.
export function mergeAddress(draft: AddressDraft, extraido: string | null | undefined): AddressDraft {
  const texto = (extraido ?? "").trim();

  if (!texto || texto === draft.texto) {
    return draft;
  }

  if (draft.googlePlaceId) {
    return draft;
  }

  if (!looksLikeStreetAddress(texto)) {
    return draft;
  }

  return { ...draft, texto };
}



// Devuelve el primer dato que falta, no todos: el equipo pide de a uno y en chat
// la gente contesta solo la mitad de lo que se le pregunta junto.
export function nextAddressGap(draft: AddressDraft): AddressGap | null {
  const pendiente = siguienteFaltante(draft);

  if (!pendiente) {
    return null;
  }

  // El corte vale para cualquier pregunta, no solo para la direccion. Sin esto,
  // basta con que el cliente conteste algo que no encaje para que el bot repita
  // la misma pregunta indefinidamente: pasa con la calle, con el piso y con el
  // tipo de vivienda por igual.
  if (draft.ultimaPregunta === pendiente && draft.repeticiones >= MAX_REPETICIONES_PREGUNTA) {
    return null;
  }

  return pendiente;
}

function siguienteFaltante(draft: AddressDraft): AddressGap | null {
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
      if (draft.opciones?.length) {
        return buildAmbiguousQuestion(draft.opciones);
      }

      return draft.etiqueta
        ? `te la dejo en ${draft.etiqueta}?`
        : "no la encontre. me la pasas con la calle, la altura y la localidad?";
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

// Interpreta la respuesta a la pregunta que se acaba de hacer. Sin esto el bot
// pregunta "es casa o departamento?", el cliente contesta, y como nadie guarda
// esa respuesta la vuelve a preguntar en el mensaje siguiente, para siempre.
export function interpretAnswer(gap: AddressGap, texto: string): Partial<AddressDraft> {
  const limpio = texto.trim();
  const normalizado = limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  switch (gap) {
    case "tipo_vivienda": {
      if (/\b(depto|dpto|departamento|depa|piso|edificio|torre)\b/.test(normalizado)) {
        return { esDepartamento: true };
      }

      if (/\b(casa|ph|duplex|chalet|quinta)\b/.test(normalizado)) {
        return { esDepartamento: false };
      }

      return {};
    }

    case "piso_depto":
      return limpio ? { addressLine2: limpio } : {};

    case "nombre_barrio":
      return limpio ? { gatedCommunityName: limpio } : {};

    default:
      return {};
  }
}
