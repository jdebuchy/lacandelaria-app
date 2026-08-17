import { precioEnChat, type CatalogVariant } from "./catalog";
import type { OrderDraft } from "./order-draft";

export type PedidoItem = {
  variante: CatalogVariant;
  cantidad: number;
};

// El resumen es lo ultimo que lee el cliente antes de confirmar, asi que dice
// exactamente lo que se va a cobrar y a donde va. Se arma con datos del
// catalogo: si lo redactara el modelo, el precio del resumen y el del pedido
// podrian no coincidir.
function nombreDeItem(item: PedidoItem) {
  // "500g" solo no dice nada; "Caja de 4kg" si. La diferencia es si el label
  // empieza con un numero, que es como el catalogo nombra los frutos secos.
  const nombre = /^\d/.test(item.variante.label)
    ? `${item.variante.label} de ${item.variante.familyName}`
    : item.variante.label;

  const enMinuscula = nombre.toLowerCase();

  return item.cantidad === 1 ? enMinuscula : `${item.cantidad} x ${enMinuscula}`;
}

export function precioDeItem(item: PedidoItem, metodoPago: OrderDraft["metodoPago"]) {
  const unitario = metodoPago === "cash" ? item.variante.cashPrice : item.variante.transferPrice;

  return unitario * item.cantidad;
}

export function totalDelPedido(items: PedidoItem[], metodoPago: OrderDraft["metodoPago"]) {
  return items.reduce((total, item) => total + precioDeItem(item, metodoPago), 0);
}

export function describirDireccion(draft: OrderDraft) {
  const { direccion } = draft;
  const base = direccion.etiqueta ?? direccion.texto ?? "";

  return direccion.addressLine2 ? `${base} ${direccion.addressLine2}` : base;
}

function describirPago(metodoPago: OrderDraft["metodoPago"]) {
  if (metodoPago === "cash") {
    return "en efectivo";
  }

  return metodoPago === "transfer" ? "por transferencia" : "";
}

export function resumenPedido(items: PedidoItem[], draft: OrderDraft) {
  const lista = items.map(nombreDeItem).join(" y ");
  const total = precioEnChat(totalDelPedido(items, draft.metodoPago));
  const pago = describirPago(draft.metodoPago);
  const direccion = describirDireccion(draft);

  const partes = [`Te anoto ${lista}`];

  if (direccion) {
    partes.push(`a ${direccion}`);
  }

  return `${partes.join(" ")}, ${[total, pago].filter(Boolean).join(" ")}. Confirmo así?`;
}

// Lo que diria una persona que se acuerda: nombra donde quedaron y en la misma
// frase avanza. No es un menu de dos opciones ("seguimos o arrancamos de nuevo")
// porque nadie atiende asi; si el cliente queria otra cosa, lo dice solo.
//
// La diferencia entre las dos formas es cuanta autoridad tiene lo guardado. A las
// pocas horas todavia es el pedido en curso y se retoma. Al dia siguiente ya es
// una sugerencia, y se ofrece.
export function mensajeParaRetomar(draft: OrderDraft, estado: "dormido" | "sugerencia") {
  const saludo = draft.nombre ? `Hola ${draft.nombre}!` : "Hola!";
  const partes: string[] = [];

  if (draft.cantidad) {
    partes.push(draft.cantidad === 1 ? "1 caja" : `${draft.cantidad} cajas`);
  }

  const direccion = describirDireccion(draft);

  if (direccion) {
    partes.push(`para ${direccion}`);
  }

  const quedamos = partes.join(" ");

  if (estado === "dormido") {
    return quedamos
      ? `${saludo} Te decía, quedamos en ${quedamos}. Seguimos con eso?`
      : `${saludo} Seguimos con el pedido que estábamos armando?`;
  }

  return quedamos
    ? `${saludo} La última vez estabas por llevar ${quedamos}. Arrancamos con eso?`
    : `${saludo} Contame qué necesitás`;
}

export function avisoDePedidoCreado(orderNumber: number | null, nombre: string | null) {
  const saludo = nombre ? `Listo ${nombre}` : "Listo";
  const numero = orderNumber ? ` (pedido #${orderNumber})` : "";

  return `${saludo}, te lo anoté${numero}. Te avisamos cuando salga el reparto`;
}
