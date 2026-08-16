import { normalizarTexto, type CatalogVariant } from "./catalog";

// El producto del pedido no puede salir del texto libre del modelo. Hay dos
// cajas de paltas activas con precios distintos (4kg a 30 mil y 4kg chica a 25
// mil): un match flojo le cobra de menos al cliente o de mas. Lo que resuelve
// esto es el catalogo, y cuando no alcanza, una pregunta.
export type ResolucionVariante =
  | { tipo: "unica"; variante: CatalogVariant }
  | { tipo: "ambigua"; opciones: CatalogVariant[] }
  | { tipo: "ninguna" };

function mencionaFamilia(consulta: string, variante: CatalogVariant) {
  const familia = normalizarTexto(variante.familyName);

  if (consulta.includes(familia)) {
    return true;
  }

  // "paltas" contra la familia "Paltas", pero tambien "palta" contra "Paltas":
  // en un chat nadie escribe el nombre exacto del catalogo.
  return familia
    .split(" ")
    .filter((palabra) => palabra.length >= 5)
    .some((palabra) => consulta.includes(palabra.slice(0, -1)));
}

// De todos los labels que aparecen en el texto gana el mas largo: "caja de 4kg
// chica" contiene a "caja de 4kg", y quedarse con el corto es justo el error que
// cobra de mas.
function labelMasEspecifico(consulta: string, variantes: CatalogVariant[]) {
  const coincidencias = variantes.filter((variante) =>
    consulta.includes(normalizarTexto(variante.label))
  );

  if (!coincidencias.length) {
    return [];
  }

  const largoMaximo = Math.max(...coincidencias.map((v) => v.label.length));

  return coincidencias.filter((v) => v.label.length === largoMaximo);
}

// Cuando el cliente no repite el label entero ("la chica" en vez de "caja de
// 4kg chica"), lo que lo distingue es la palabra que ninguna otra variante tiene.
// Sin esto, "la chica" no matchea nada y el pedido cae en la caja grande, que
// sale 5 mil mas.
function porPalabraDistintiva(consulta: string, variantes: CatalogVariant[]) {
  if (variantes.length < 2) {
    return [];
  }

  const palabrasPorVariante = variantes.map((variante) =>
    normalizarTexto(variante.label)
      .split(/[\s-]+/)
      .filter((palabra) => palabra.length >= 4)
  );

  const frecuencia = new Map<string, number>();

  for (const palabras of palabrasPorVariante) {
    for (const palabra of new Set(palabras)) {
      frecuencia.set(palabra, (frecuencia.get(palabra) ?? 0) + 1);
    }
  }

  return variantes.filter((_, indice) =>
    palabrasPorVariante[indice].some(
      (palabra) => frecuencia.get(palabra) === 1 && consulta.includes(palabra)
    )
  );
}

export function resolveVariant(
  texto: string | null,
  variantes: CatalogVariant[],
  variantePorDefecto?: string | null
): ResolucionVariante {
  if (!variantes.length) {
    return { tipo: "ninguna" };
  }

  const consulta = normalizarTexto(texto ?? "");

  // Sin texto, el pedido es del producto principal. El negocio vende cajas de
  // paltas: dar por sentado otra cosa seria inventar.
  if (!consulta) {
    const porDefecto = variantes.find((v) => v.id === variantePorDefecto);
    return porDefecto ? { tipo: "unica", variante: porDefecto } : { tipo: "ninguna" };
  }

  const deLaFamilia = variantes.filter((variante) => mencionaFamilia(consulta, variante));
  const candidatas = deLaFamilia.length ? deLaFamilia : variantes;
  const porLabel = labelMasEspecifico(consulta, candidatas);

  if (porLabel.length === 1) {
    return { tipo: "unica", variante: porLabel[0] };
  }

  if (porLabel.length > 1) {
    return { tipo: "ambigua", opciones: porLabel };
  }

  const porPalabra = porPalabraDistintiva(consulta, candidatas);

  if (porPalabra.length === 1) {
    return { tipo: "unica", variante: porPalabra[0] };
  }

  // El cliente nombro la familia pero no la presentacion. Si hay una sola, es
  // esa; si hay varias, la que el catalogo marca por defecto; si no, se pregunta.
  if (deLaFamilia.length === 1) {
    return { tipo: "unica", variante: deLaFamilia[0] };
  }

  if (deLaFamilia.length > 1) {
    const porDefecto = deLaFamilia.find((v) => v.id === variantePorDefecto);

    return porDefecto
      ? { tipo: "unica", variante: porDefecto }
      : { tipo: "ambigua", opciones: deLaFamilia };
  }

  return { tipo: "ninguna" };
}

export function buildVariantQuestion(opciones: CatalogVariant[]) {
  const lista = opciones.map((v, i) => `${i + 1}. ${v.label}`).join("\n");
  return `cual queres?\n${lista}`;
}
