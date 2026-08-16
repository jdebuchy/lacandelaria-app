// El catalogo, reducido a lo que el bot necesita para armar un pedido. Es un
// tipo propio y no el del panel para que las funciones de matching sean puras y
// se puedan testear sin la base.
export type CatalogVariant = {
  id: string;
  familyId: string;
  familyName: string;
  label: string;
  cashPrice: number;
  transferPrice: number;
};

export function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nombreCompleto(variante: CatalogVariant) {
  return `${variante.familyName} ${variante.label}`;
}

// Como escribe los precios el equipo: "25 mil", no "$25.000,00". Sale de medir
// las respuestas reales, donde los redondos siempre van en miles.
export function precioEnChat(monto: number) {
  if (monto >= 1000 && monto % 1000 === 0) {
    return `${monto / 1000} mil`;
  }

  return `$${monto.toLocaleString("es-AR")}`;
}
