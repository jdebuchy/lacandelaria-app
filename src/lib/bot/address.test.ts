import { describe, expect, it } from "vitest";
import type { PlaceSuggestion } from "@/lib/google-places";
import {
  EMPTY_ADDRESS_DRAFT,
  buildAddressQuestion,
  isAddressComplete,
  looksLikeStreetAddress,
  mergeAddress,
  nextAddressGap,
  pickSuggestion,
  type AddressDraft
} from "./address";

function sugerencia(fullText: string): PlaceSuggestion {
  return { placeId: fullText, mainText: fullText, secondaryText: "", fullText, types: [] };
}

function draft(overrides: Partial<AddressDraft> = {}): AddressDraft {
  return { ...EMPTY_ADDRESS_DRAFT, ...overrides };
}

describe("pickSuggestion", () => {
  it("sin resultados no hay nada que elegir", () => {
    expect(pickSuggestion("cualquier cosa", [])).toEqual({ tipo: "ninguna" });
  });

  it("una sola sugerencia es la buena", () => {
    const s = sugerencia("Av. Cabildo 2200, CABA");
    expect(pickSuggestion("cabildo 2200", [s])).toEqual({ tipo: "clara", sugerencia: s });
  });

  // Places casi siempre devuelve varias, asi que el criterio no puede ser la
  // cantidad: se resuelve por el numero de calle que escribio el cliente.
  it("elige la unica que tiene el numero que escribio el cliente", () => {
    const pick = pickSuggestion("cabildo 2200", [
      sugerencia("Av. Cabildo 2200, CABA"),
      sugerencia("Av. Cabildo 3500, CABA"),
      sugerencia("Cabildo, Beccar")
    ]);
    expect(pick).toMatchObject({ tipo: "clara" });
    expect(pick).toMatchObject({ sugerencia: { fullText: "Av. Cabildo 2200, CABA" } });
  });

  it("si el numero aparece en varias y la consulta es corta, pregunta", () => {
    const pick = pickSuggestion("santa fe 1500", [
      sugerencia("Av. Santa Fe 1500, CABA"),
      sugerencia("Santa Fe 1500, Martinez")
    ]);
    expect(pick.tipo).toBe("ambigua");
  });

  // Con calle, altura y localidad ya alcanza: exigir una unica coincidencia
  // hacia que "Av Libertador 2809, Capital Federal" quedara ambigua para
  // siempre, porque hay calles Libertador en media provincia.
  it("con localidad incluida toma la mas relevante", () => {
    const pick = pickSuggestion("Av Libertador 2809, Capital Federal", [
      sugerencia("Av. del Libertador 2809, CABA"),
      sugerencia("Libertador 2809, San Isidro"),
      sugerencia("Libertador 2809, Vicente Lopez")
    ]);
    expect(pick).toMatchObject({ tipo: "clara" });
    expect(pick).toMatchObject({ sugerencia: { fullText: "Av. del Libertador 2809, CABA" } });
  });

  it("sin numero en la consulta, pregunta", () => {
    const pick = pickSuggestion("cabildo", [
      sugerencia("Av. Cabildo 2200, CABA"),
      sugerencia("Av. Cabildo 3500, CABA")
    ]);
    expect(pick.tipo).toBe("ambigua");
  });

  it("no ofrece mas de tres opciones: en un chat una lista larga no se lee", () => {
    const pick = pickSuggestion("cabildo", [
      sugerencia("a 1"), sugerencia("b 2"), sugerencia("c 3"), sugerencia("d 4"), sugerencia("e 5")
    ]);
    expect(pick).toMatchObject({ tipo: "ambigua" });
    expect((pick as { opciones: PlaceSuggestion[] }).opciones).toHaveLength(3);
  });

  // Un numero de un digito suele ser parte del nombre de la calle, no la altura.
  it("ignora numeros muy cortos al comparar", () => {
    const pick = pickSuggestion("calle 9", [sugerencia("Calle 9 de Julio"), sugerencia("Calle 9, La Plata")]);
    expect(pick.tipo).toBe("ambigua");
  });
});

// El bug mas caro que aparecio probando: el cliente dijo "Av Libertador 2809",
// despues "departamento", despues "4B", y lo que quedo guardado fue
// "Castex 3342 4B", una calle que nunca menciono. El modelo completaba una
// direccion plausible ante cualquier fragmento, y cada mensaje pisaba el anterior.
describe("mergeAddress", () => {
  it("toma la primera direccion que parece direccion", () => {
    const r = mergeAddress(draft(), "Av Libertador 2809, Capital Federal");
    expect(r.texto).toBe("Av Libertador 2809, Capital Federal");
  });

  it("ignora fragmentos que no son una direccion", () => {
    for (const fragmento of ["4B", "departamento", "casa", "PB", "si", ""]) {
      expect(mergeAddress(draft(), fragmento).texto).toBeNull();
    }
  });

  it("no pisa una direccion que Google ya confirmo", () => {
    const validada = draft({ texto: "Av Libertador 2809", googlePlaceId: "place-1" });
    expect(mergeAddress(validada, "Castex 3342 4B").texto).toBe("Av Libertador 2809");
  });

  // Sin validar todavia, una direccion nueva si puede corregir a la anterior:
  // el cliente puede haberse equivocado y estar rectificando.
  it("sin validar, una direccion nueva reemplaza a la anterior", () => {
    const previa = draft({ texto: "Cabildo 1000" });
    expect(mergeAddress(previa, "Av Libertador 2809").texto).toBe("Av Libertador 2809");
  });

  it("el mismo texto no cambia nada", () => {
    const previa = draft({ texto: "Cabildo 1000", intentos: 1 });
    expect(mergeAddress(previa, "Cabildo 1000")).toBe(previa);
  });
});

describe("looksLikeStreetAddress", () => {
  it("pide calle y altura juntas", () => {
    expect(looksLikeStreetAddress("Av Libertador 2809")).toBe(true);
    expect(looksLikeStreetAddress("Cabildo 2200, CABA")).toBe(true);
    expect(looksLikeStreetAddress("Libertador")).toBe(false);
    expect(looksLikeStreetAddress("2809")).toBe(false);
  });

  it("un piso o un timbre no alcanzan", () => {
    expect(looksLikeStreetAddress("4B")).toBe(false);
    expect(looksLikeStreetAddress("piso 3")).toBe(false);
  });
});

describe("nextAddressGap", () => {
  it("arranca pidiendo la calle", () => {
    expect(nextAddressGap(draft())).toBe("calle");
  });

  it("con texto pero sin validar, pide confirmar", () => {
    expect(nextAddressGap(draft({ texto: "cabildo 2200" }))).toBe("confirmar_calle");
  });

  it("validada, pregunta el tipo de vivienda", () => {
    expect(
      nextAddressGap(draft({ texto: "x", googlePlaceId: "p1", addressKind: "standard" }))
    ).toBe("tipo_vivienda");
  });

  it("si es depto pide piso y unidad", () => {
    expect(
      nextAddressGap(
        draft({ texto: "x", googlePlaceId: "p1", addressKind: "standard", esDepartamento: true })
      )
    ).toBe("piso_depto");
  });

  it("una casa no necesita piso", () => {
    const casa = draft({
      texto: "x",
      googlePlaceId: "p1",
      addressKind: "standard",
      esDepartamento: false
    });
    expect(nextAddressGap(casa)).toBeNull();
    expect(isAddressComplete(casa)).toBe(true);
  });

  // Google marca solo los barrios cerrados: ahi no se pregunta casa o depto,
  // se pregunta el nombre del barrio, que es lo que necesita el repartidor.
  it("en barrio cerrado pide el nombre y no el tipo de vivienda", () => {
    expect(
      nextAddressGap(draft({ texto: "x", googlePlaceId: "p1", addressKind: "gated" }))
    ).toBe("nombre_barrio");
  });

  // Sin esto, un cliente con una direccion que Google no conoce queda en un
  // bucle: el bot le pide la calle de nuevo para siempre y la compra se cae.
  it("deja de insistir con la direccion despues de dos intentos", () => {
    const insistiendo = draft({ texto: "el campo, a 3km del molino", intentos: 2 });
    expect(nextAddressGap(insistiendo)).not.toBe("confirmar_calle");
  });

  it("con un intento todavia pregunta", () => {
    expect(nextAddressGap(draft({ texto: "x", intentos: 1 }))).toBe("confirmar_calle");
  });

  it("barrio cerrado con nombre ya esta completo", () => {
    const barrio = draft({
      texto: "x",
      googlePlaceId: "p1",
      addressKind: "gated",
      gatedCommunityName: "Santa Barbara"
    });
    expect(isAddressComplete(barrio)).toBe(true);
  });
});

describe("buildAddressQuestion", () => {
  it("pregunta de a una cosa y en el tono del equipo", () => {
    for (const gap of ["calle", "tipo_vivienda", "piso_depto", "nombre_barrio"] as const) {
      const texto = buildAddressQuestion(gap, draft());
      expect(texto).not.toMatch(/[¿¡]/);
      expect(texto.length).toBeLessThan(60);
    }
  });

  it("al confirmar repite la direccion que devolvio Google", () => {
    const texto = buildAddressQuestion("confirmar_calle", draft({ etiqueta: "Av. Cabildo 2200, CABA" }));
    expect(texto).toContain("Av. Cabildo 2200, CABA");
  });

  it("sin etiqueta pide que la escriba de nuevo en vez de repetir un vacio", () => {
    expect(buildAddressQuestion("confirmar_calle", draft())).toContain("de nuevo");
  });
});
