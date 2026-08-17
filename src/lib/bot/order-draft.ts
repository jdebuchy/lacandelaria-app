import { normalizeArgentinaPhoneInput } from "@/lib/contact";
import { isGreetingOnly, normalizar } from "./text";
import {
  EMPTY_ADDRESS_DRAFT,
  MAX_REPETICIONES_PREGUNTA,
  buildAddressQuestion,
  nextAddressGap,
  type AddressDraft,
  type AddressGap
} from "./address";

// Lo que se sabe del pedido, acumulado entre mensajes. Hasta ahora solo se
// guardaba la direccion, asi que el bot volvia a preguntar la cantidad y la
// forma de pago aunque el cliente ya las hubiera dicho: para el cliente es
// como si no lo estuvieran escuchando.
export type OrderDraft = {
  direccion: AddressDraft;
  cantidad: number | null;
  producto: string | null;
  metodoPago: "cash" | "transfer" | null;
  notas: string | null;
  nombre: string | null;
  telefono: string | null;
  // El upsell se ofrece una sola vez. Insistir con un producto que ya rechazaron
  // es lo que separa una sugerencia de una molestia.
  upsellOfrecido: boolean;
  upsellAceptado: boolean | null;
  // Que variante se ofrecio, para poder sumarla al pedido si dice que si.
  upsellVariantId: string | null;
  // El cliente vio el resumen y dijo que si. Recien ahi se crea el pedido.
  confirmado: boolean;
  // Que se pregunto en el mensaje anterior y cuantas veces seguidas. Es la unica
  // memoria que tiene el bot entre mensajes, y lo que evita los bucles.
  ultimaPregunta: string | null;
  repeticiones: number;
  // Cuando se toco el pedido por ultima vez. Sin esto el bot retoma una charla de
  // hace tres dias como si no hubiera pasado nada.
  actualizadoEn: string | null;
  // Desde que antiguedad se pregunto si retomaba. Cambia que pasa con la
  // respuesta: un pedido de hace horas sobrevive a una respuesta ambigua, uno de
  // ayer no, porque era una oferta y no un pedido en curso.
  retomarDesde: "dormido" | "sugerencia" | null;
  // Lo escribe create-order cuando el pedido ya existe. Vive en el mismo jsonb,
  // asi que tenerlo tipado evita leer el objeto crudo en dos lugares.
  createdOrderId: string | null;
};

export const EMPTY_ORDER_DRAFT: OrderDraft = {
  direccion: EMPTY_ADDRESS_DRAFT,
  cantidad: null,
  producto: null,
  metodoPago: null,
  notas: null,
  nombre: null,
  telefono: null,
  upsellOfrecido: false,
  upsellAceptado: null,
  upsellVariantId: null,
  confirmado: false,
  ultimaPregunta: null,
  repeticiones: 0,
  actualizadoEn: null,
  retomarDesde: null,
  createdOrderId: null
};

// El draft vive como jsonb, asi que hay que rearmarlo con forma de OrderDraft en
// cada lectura. Estaba escrito a mano en handle-inbound; ahora lo necesita
// tambien el gate, y una sola version evita que se separen.
export function hydrateOrderDraft(crudo: Record<string, unknown> | null | undefined): OrderDraft {
  const fuente = (crudo ?? {}) as Partial<OrderDraft>;

  return {
    ...EMPTY_ORDER_DRAFT,
    ...fuente,
    direccion: { ...EMPTY_ADDRESS_DRAFT, ...(fuente.direccion ?? {}) }
  };
}

// Cuanto puede pasar antes de que retomar en seco se note. Tres horas es un
// almuerzo o una reunion: mas que eso, seguir la frase donde quedo se lee raro.
export const HORAS_PARA_NOMBRAR = 3;

// Pasado un dia el pedido deja de ser un pedido en curso. No se olvida, pero se
// ofrece en vez de darse por hecho.
export const HORAS_PARA_SUGERENCIA = 24;

export type EstadoDelDraft = "vacio" | "activo" | "dormido" | "sugerencia";

function tieneAlgoQueRetomar(draft: OrderDraft) {
  if (draft.createdOrderId) {
    return false;
  }

  return draft.cantidad !== null || Boolean(draft.direccion.texto);
}

// Cuanta autoridad tiene lo que quedo guardado. No mide dias de calendario: entre
// las 23:00 y la 01:00 pasaron dos horas, no "un dia".
export function estadoDelDraft(draft: OrderDraft, now: string): EstadoDelDraft {
  if (!tieneAlgoQueRetomar(draft)) {
    return "vacio";
  }

  // Un draft sin fecha es de antes de que existiera este campo. Tratarlo como
  // sugerencia hace que los que ya estan guardados se curen solos en el primer
  // mensaje, sin script de migracion.
  if (!draft.actualizadoEn) {
    return "sugerencia";
  }

  const horas = (new Date(now).getTime() - new Date(draft.actualizadoEn).getTime()) / 3_600_000;

  if (!Number.isFinite(horas)) {
    return "sugerencia";
  }

  if (horas >= HORAS_PARA_SUGERENCIA) {
    return "sugerencia";
  }

  return horas >= HORAS_PARA_NOMBRAR ? "dormido" : "activo";
}

// Vacia el pedido pero nunca el contacto: es la misma persona, y volver a pedirle
// el nombre y el telefono se lee como que no lo escuchamos.
export function reiniciarPedido(
  draft: OrderDraft,
  opciones: { conservarDireccion: boolean }
): OrderDraft {
  return {
    ...EMPTY_ORDER_DRAFT,
    nombre: draft.nombre,
    telefono: draft.telefono,
    actualizadoEn: draft.actualizadoEn,
    direccion: opciones.conservarDireccion
      ? { ...draft.direccion, ultimaPregunta: null, repeticiones: 0 }
      : EMPTY_ADDRESS_DRAFT
  };
}

// Un pedido de mas de 50 cajas no es un cliente escribiendo por Telegram: es el
// modelo interpretando mal un numero suelto (una altura, un piso, un horario).
const MAX_CAJAS_RAZONABLE = 50;

export function parseCantidad(valor: unknown): number | null {
  const numero = typeof valor === "number" ? valor : Number(valor);

  if (!Number.isFinite(numero) || !Number.isInteger(numero)) {
    return null;
  }

  return numero >= 1 && numero <= MAX_CAJAS_RAZONABLE ? numero : null;
}

export function parseMetodoPago(valor: unknown): "cash" | "transfer" | null {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = normalizar(valor);

  if (/\b(cash|efectivo|contado|billete)\b/.test(texto)) {
    return "cash";
  }

  if (/\b(transfer|transferencia|banco|alias|cbu|mercadopago)\b/.test(texto)) {
    return "transfer";
  }

  return null;
}

// Un telefono argentino normalizado tiene entre 11 y 14 digitos. Fuera de ese
// rango es otra cosa: una altura, un CBU, un DNI.
const MIN_DIGITOS_TELEFONO = 11;
const MAX_DIGITOS_TELEFONO = 14;

export function parseTelefono(valor: unknown): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  const digitos = valor.replace(/\D/g, "");

  // Antes de normalizar hay que ver que el original tenga pinta de telefono:
  // normalizeArgentinaPhoneInput le antepone 549 a cualquier cosa, asi que un
  // "6" suelto saldria como un numero valido.
  if (digitos.length < 8 || digitos.length > 14) {
    return null;
  }

  const normalizado = normalizeArgentinaPhoneInput(valor);

  return normalizado.length >= MIN_DIGITOS_TELEFONO && normalizado.length <= MAX_DIGITOS_TELEFONO
    ? normalizado
    : null;
}

// Un nombre no es una direccion ni un numero. El filtro es flojo a proposito:
// lo que importa es descartar la basura obvia, no validar apellidos.
export function parseNombre(valor: unknown): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  const limpio = valor.trim().replace(/\s+/g, " ");

  if (limpio.length < 2 || limpio.length > 60 || /\d/.test(limpio)) {
    return null;
  }

  // Un saludo contestando "a nombre de quien te lo anoto?" no es un nombre.
  // Sin esto el pedido quedaba a nombre de "hola".
  if (isGreetingOnly(limpio)) {
    return null;
  }

  return limpio;
}

const AFIRMACIONES =
  /\b(si|sip|sipi|dale|ok|oka|okey|obvio|claro|listo|confirmo|confirmado|confirmalo|perfecto|joya|barbaro|buenisimo|correcto|exacto|vamos|va)\b/;
const NEGACIONES = /\b(no|nop|nel|nah|tampoco|cancelar|cancela|cancelalo|dejalo|olvidalo)\b/;

// Interpreta un si o un no sin gastar una llamada al modelo. Devuelve null si no
// es ninguna de las dos cosas: ahi si vale la pena que conteste el modelo.
export function parseSiNo(texto: string): boolean | null {
  const limpio = normalizar(texto.trim());

  if (!limpio) {
    return null;
  }

  const niega = NEGACIONES.test(limpio);
  const afirma = AFIRMACIONES.test(limpio);

  // "no, dale mejor 2" tiene las dos. Gana la negacion: equivocarse hacia el no
  // cuesta una repregunta, equivocarse hacia el si crea un pedido que nadie pidio.
  if (niega) {
    return false;
  }

  return afirma ? true : null;
}

// "de nuevo" y "de cero" no son negaciones, asi que parseSiNo las lee como null y
// el bot seguiria con el pedido viejo. Por eso esta pregunta tiene su propio
// parser, y la negacion se chequea primero: "si, arrancamos de nuevo" tiene las
// dos cosas y gana empezar de nuevo.
const EMPEZAR_DE_CERO =
  /\b(de cero|desde cero|de nuevo|nuevamente|otra vez|otra cosa|empecemos|empezar|olvidate|olvidalo|cambio|cambiar|no)\b/;
const SEGUIR_IGUAL =
  /\b(segui|seguimos|sigamos|seguir|continuemos|continuar|si|sip|dale|eso|ese|esa|mismo|misma|obvio|claro|confirmo|perfecto)\b/;

export function parseRetomar(texto: string): "seguir" | "de_cero" | null {
  const limpio = normalizar(texto.trim());

  if (!limpio) {
    return null;
  }

  if (EMPEZAR_DE_CERO.test(limpio)) {
    return "de_cero";
  }

  return SEGUIR_IGUAL.test(limpio) ? "seguir" : null;
}

// Si el cliente ya dijo lo que quiere, sacarle un pedido de anteayer es hablarle
// de otra cosa.
//
// Se compara contra lo que ya habia, y no se mira solo si "extracted" trae algo:
// el prompt le pide al modelo repetir todo dato que aparezca en la conversacion,
// aunque sea de varios mensajes atras. Sin la comparacion, un "hola" pelado
// devolvia la cantidad y la direccion de siempre y esto daba true para siempre.
//
// Tampoco mira el producto, porque el modelo completa product_name aun cuando el
// cliente no lo nombro.
export function trajoAlgoConcreto(
  extracted: Record<string, unknown>,
  guardado: OrderDraft
): boolean {
  const cantidad = parseCantidad(extracted.quantity);

  if (cantidad !== null && cantidad !== guardado.cantidad) {
    return true;
  }

  const direccion = extracted.delivery_address;

  if (typeof direccion !== "string" || !direccion.trim()) {
    return false;
  }

  const dicha = normalizar(direccion);

  return dicha !== normalizar(guardado.direccion.texto ?? "") && dicha !== normalizar(guardado.direccion.etiqueta ?? "");
}

// Despues de descartar un pedido viejo, lo que el modelo "extrajo" suele ser el
// eco de ese mismo pedido: el prompt le pide repetir todo dato que aparezca en la
// conversacion, aunque sea de varios mensajes atras. Sin sacarlo, el reinicio se
// deshace solo en el mismo mensaje que lo pidio.
//
// Solo se descarta lo que coincide con lo viejo. Si el cliente dijo "no, mejor 5
// cajas", el 5 sobrevive.
export function sinEco(
  extracted: Record<string, unknown>,
  viejo: OrderDraft
): Record<string, unknown> {
  const limpio: Record<string, unknown> = { ...extracted };

  if (parseCantidad(extracted.quantity) === viejo.cantidad) {
    delete limpio.quantity;
  }

  if (parseMetodoPago(extracted.payment_method) === viejo.metodoPago) {
    delete limpio.payment_method;
  }

  if (parseNombre(extracted.customer_name) === viejo.nombre) {
    delete limpio.customer_name;
  }

  if (typeof extracted.product_name === "string" && extracted.product_name.trim() === viejo.producto) {
    delete limpio.product_name;
  }

  const dicha = typeof extracted.delivery_address === "string" ? normalizar(extracted.delivery_address) : "";

  if (
    dicha &&
    (dicha === normalizar(viejo.direccion.texto ?? "") ||
      dicha === normalizar(viejo.direccion.etiqueta ?? ""))
  ) {
    delete limpio.delivery_address;
    delete limpio.delivery_zone;
  }

  return limpio;
}

const PALABRAS_DE_PREGUNTA =
  /^(cuanto|cuanta|cuantos|cuantas|que|cual|cuales|como|cuando|donde|quien|hay|tenes|tienen|se puede|puedo|hacen|llegan|aceptan)\b/;

// Distingue una pregunta de una respuesta. En medio de un pedido, "cuanto sale
// la chica?" merece una respuesta, no la siguiente pregunta del formulario. El
// filtro es de forma y no de intencion: el modelo a veces clasifica como
// consulta un "efectivo" suelto, y ahi el pedido se trabaria.
export function pareceConsulta(texto: string): boolean {
  const limpio = normalizar(texto.trim());

  if (!limpio) {
    return false;
  }

  return limpio.endsWith("?") || PALABRAS_DE_PREGUNTA.test(limpio);
}

// Acumula los datos nuevos sobre los que ya habia. Un dato ya tomado solo se
// reemplaza por otro valido: asi un mensaje ambiguo no borra lo que el cliente
// ya dijo bien.
export function mergeOrderDraft(
  draft: OrderDraft,
  extracted: Record<string, unknown>
): OrderDraft {
  const cantidad = parseCantidad(extracted.quantity);
  const metodoPago = parseMetodoPago(extracted.payment_method);
  const nombre = parseNombre(extracted.customer_name);
  const producto = typeof extracted.product_name === "string" ? extracted.product_name.trim() : "";
  const notas = typeof extracted.free_text_notes === "string" ? extracted.free_text_notes.trim() : "";

  return {
    ...draft,
    cantidad: cantidad ?? draft.cantidad,
    metodoPago: metodoPago ?? draft.metodoPago,
    nombre: nombre ?? draft.nombre,
    producto: producto || draft.producto,
    notas: notas || draft.notas
  };
}

// Lo que se le pasa al modelo para que no vuelva a pedir lo que ya tiene. En
// castellano y sin ids: es contexto para redactar, no datos para procesar.
export function resumirConfirmado(draft: OrderDraft): Record<string, unknown> | null {
  const resumen: Record<string, unknown> = {};
  const { direccion } = draft;

  if (direccion.googlePlaceId) {
    resumen.direccion = direccion.etiqueta ?? direccion.texto;

    if (direccion.esDepartamento !== null) {
      resumen.tipo_vivienda = direccion.esDepartamento ? "departamento" : "casa";
    }

    if (direccion.addressLine2) {
      resumen.piso_depto = direccion.addressLine2;
    }

    if (direccion.gatedCommunityName) {
      resumen.barrio_cerrado = direccion.gatedCommunityName;
    }
  }

  if (draft.cantidad !== null) {
    resumen.cantidad_cajas = draft.cantidad;
  }

  if (draft.metodoPago) {
    resumen.forma_de_pago = draft.metodoPago === "cash" ? "efectivo" : "transferencia";
  }

  if (draft.producto) {
    resumen.producto = draft.producto;
  }

  if (draft.nombre) {
    resumen.nombre = draft.nombre;
  }

  if (draft.telefono) {
    resumen.telefono = draft.telefono;
  }

  return Object.keys(resumen).length ? resumen : null;
}

export type OrderGap =
  // Paso tiempo desde la ultima vez. Antes de seguir con cualquier dato hay que
  // nombrar el hueco: retomar en seco es lo que delata que del otro lado no hay
  // nadie.
  | { tipo: "retomar" }
  | { tipo: "direccion"; gap: AddressGap }
  | { tipo: "cantidad" }
  | { tipo: "pago" }
  | { tipo: "nombre" }
  | { tipo: "telefono" }
  | { tipo: "upsell" }
  | { tipo: "confirmacion" }
  // Un dato imprescindible que el cliente no contesta despues de insistir. No
  // se sigue solo: el pedido quedaria mal cargado y lo termina una persona.
  | { tipo: "bloqueado"; falta: string };

// Clave estable para contar repeticiones. Sin esto, dos preguntas distintas de
// direccion comparten contador y el corte salta antes de tiempo.
export function gapKey(gap: OrderGap): string {
  return gap.tipo === "direccion" ? `direccion:${gap.gap}` : gap.tipo;
}

// La vuelta de gapKey: el draft guarda la clave, y para interpretar el mensaje
// siguiente hace falta el hueco entero.
export function gapFromKey(clave: string | null): OrderGap | null {
  if (!clave) {
    return null;
  }

  if (clave.startsWith("direccion:")) {
    return { tipo: "direccion", gap: clave.slice("direccion:".length) as AddressGap };
  }

  switch (clave) {
    case "retomar":
    case "cantidad":
    case "pago":
    case "nombre":
    case "telefono":
    case "upsell":
    case "confirmacion":
      return { tipo: clave };
    default:
      return null;
  }
}

function agotada(draft: OrderDraft, gap: OrderGap) {
  return draft.ultimaPregunta === gapKey(gap) && draft.repeticiones >= MAX_REPETICIONES_PREGUNTA;
}

// El orden es el del equipo: primero cuanto, despues donde, despues como paga,
// y los datos de contacto al final, cuando la venta ya esta encaminada.
//
// Los datos imprescindibles (cantidad y direccion) bloquean si el cliente no
// contesta; los demas se saltean y los completa una persona. Preguntar tres
// veces lo mismo pierde la venta, y un pedido sin direccion no se puede repartir.
export type NextGapOptions = {
  upsellDisponible?: boolean;
  // Cuanta autoridad tiene lo guardado. Lo calcula quien tiene el reloj: aca
  // adentro no puede haber Date.now() o el test depende de la hora de la maquina.
  estado?: EstadoDelDraft;
};

export function nextOrderGap(draft: OrderDraft, opciones: NextGapOptions = {}): OrderGap | null {
  const { upsellDisponible = false, estado = "activo" } = opciones;

  if (draft.confirmado) {
    return null;
  }

  // Nombrar el hueco va antes que cualquier dato que falte. Preguntar "que piso
  // y depto?" a alguien que escribio hace tres dias es la definicion de hablarle
  // a nadie.
  if (estado === "dormido" || estado === "sugerencia") {
    return { tipo: "retomar" };
  }

  if (draft.cantidad === null) {
    const gap: OrderGap = { tipo: "cantidad" };
    return agotada(draft, gap) ? { tipo: "bloqueado", falta: "cantidad" } : gap;
  }

  const huecoDireccion = nextAddressGap(draft.direccion);

  if (huecoDireccion) {
    return { tipo: "direccion", gap: huecoDireccion };
  }

  if (!draft.direccion.googlePlaceId && !draft.direccion.texto) {
    return { tipo: "bloqueado", falta: "direccion" };
  }

  if (!draft.metodoPago) {
    const gap: OrderGap = { tipo: "pago" };

    if (!agotada(draft, gap)) {
      return gap;
    }
  }

  if (!draft.nombre) {
    const gap: OrderGap = { tipo: "nombre" };

    if (!agotada(draft, gap)) {
      return gap;
    }
  }

  if (!draft.telefono) {
    const gap: OrderGap = { tipo: "telefono" };

    if (!agotada(draft, gap)) {
      return gap;
    }
  }

  if (upsellDisponible && !draft.upsellOfrecido) {
    return { tipo: "upsell" };
  }

  return { tipo: "confirmacion" };
}

// Los textos siguen el tono medido del equipo: cortos, de a una pregunta por vez
// y sin signos de apertura, que es la unica licencia ortografica que se toma.
// Los acentos y la mayuscula inicial si van: sin ellos se lee descuidado, no
// cercano. Ojo que la regla del repo de escribir sin acentos es para el codigo,
// no para lo que lee el cliente.
export function buildOrderQuestion(gap: OrderGap, draft: OrderDraft): string {
  switch (gap.tipo) {
    case "direccion":
      return buildAddressQuestion(gap.gap, draft.direccion);
    case "cantidad":
      return "Cuántas cajas querés?";
    case "pago":
      return "Lo pagás en efectivo o por transferencia?";
    case "nombre":
      return "A nombre de quién te lo anoto?";
    case "telefono":
      return "Me pasás un teléfono para el reparto?";
    case "retomar":
    case "upsell":
    case "confirmacion":
    case "bloqueado":
      // Estos los arma quien tiene el catalogo o el resumen de lo que habia: el
      // texto necesita precios, o no es una pregunta.
      return "";
  }
}

// Interpreta la respuesta a la pregunta que se acaba de hacer. Sin esto el bot
// pregunta, el cliente contesta, y como nadie guarda esa respuesta la vuelve a
// preguntar en el mensaje siguiente, para siempre.
export function interpretOrderAnswer(gap: OrderGap, texto: string): Partial<OrderDraft> {
  switch (gap.tipo) {
    case "cantidad": {
      const cantidad = parseCantidad(texto.trim().match(/\d+/)?.[0] ?? "");
      return cantidad === null ? {} : { cantidad };
    }

    case "pago": {
      const metodoPago = parseMetodoPago(texto);
      return metodoPago === null ? {} : { metodoPago };
    }

    case "nombre": {
      const nombre = parseNombre(texto);
      return nombre === null ? {} : { nombre };
    }

    case "telefono": {
      const telefono = parseTelefono(texto);
      return telefono === null ? {} : { telefono };
    }

    case "upsell": {
      const respuesta = parseSiNo(texto);
      return respuesta === null ? {} : { upsellAceptado: respuesta };
    }

    case "confirmacion": {
      const respuesta = parseSiNo(texto);
      return respuesta === true ? { confirmado: true } : {};
    }

    case "retomar":
      // Esta la resuelve handle-inbound con parseRetomar: reiniciar el pedido
      // necesita saber cuanto tiempo paso, y eso no vive en el draft.
      return {};

    default:
      return {};
  }
}

// Que falta para poder registrar el pedido. Solo lo imprescindible: nombre y
// telefono los puede completar una persona, la cantidad y la direccion no.
export function missingOrderFields(draft: OrderDraft): string[] {
  const faltan: string[] = [];

  if (draft.cantidad === null) {
    faltan.push("cantidad");
  }

  if (!draft.direccion.googlePlaceId && !draft.direccion.texto) {
    faltan.push("direccion");
  }

  return faltan;
}

export function isOrderComplete(draft: OrderDraft) {
  return missingOrderFields(draft).length === 0;
}
