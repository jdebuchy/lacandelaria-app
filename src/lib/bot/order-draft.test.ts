import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS_DRAFT, type AddressDraft } from "./address";
import {
  EMPTY_ORDER_DRAFT,
  buildOrderQuestion,
  gapKey,
  interpretOrderAnswer,
  isOrderComplete,
  mergeOrderDraft,
  missingOrderFields,
  nextOrderGap,
  pareceConsulta,
  parseCantidad,
  parseMetodoPago,
  parseNombre,
  parseSiNo,
  parseTelefono,
  resumirConfirmado,
  type OrderDraft
} from "./order-draft";

function direccionLista(overrides: Partial<AddressDraft> = {}): AddressDraft {
  return {
    ...EMPTY_ADDRESS_DRAFT,
    texto: "Castex 3342",
    etiqueta: "Castex 3342",
    googlePlaceId: "place-1",
    addressKind: "standard",
    esDepartamento: false,
    addressLine1: "Castex 3342",
    locality: "Ciudad Autonoma de Buenos Aires",
    provincia: "CABA",
    ...overrides
  };
}

function draft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return { ...EMPTY_ORDER_DRAFT, ...overrides };
}

describe("parseCantidad", () => {
  it("acepta una cantidad de cajas creible", () => {
    expect(parseCantidad(2)).toBe(2);
    expect(parseCantidad("3")).toBe(3);
  });

  // Un numero enorme no es un cliente pidiendo por Telegram: es el modelo
  // leyendo como cantidad una altura, un piso o un horario.
  it("descarta numeros que no pueden ser cajas", () => {
    expect(parseCantidad(2809)).toBeNull();
    expect(parseCantidad(0)).toBeNull();
    expect(parseCantidad(-1)).toBeNull();
    expect(parseCantidad(1.5)).toBeNull();
    expect(parseCantidad("dos")).toBeNull();
    expect(parseCantidad(null)).toBeNull();
  });
});

describe("parseMetodoPago", () => {
  it("entiende como lo dice la gente", () => {
    expect(parseMetodoPago("efectivo")).toBe("cash");
    expect(parseMetodoPago("en efectivo")).toBe("cash");
    expect(parseMetodoPago("transferencia")).toBe("transfer");
    expect(parseMetodoPago("por transferencia bancaria")).toBe("transfer");
  });

  it("no adivina cuando no hay forma de pago", () => {
    expect(parseMetodoPago("dale")).toBeNull();
    expect(parseMetodoPago("")).toBeNull();
    expect(parseMetodoPago(3)).toBeNull();
  });
});

describe("parseTelefono", () => {
  it("acepta un telefono escrito como lo escribe la gente", () => {
    expect(parseTelefono("11 5555 4444")).toBe("5491155554444");
    expect(parseTelefono("+54 9 11 5555-4444")).toBe("5491155554444");
    expect(parseTelefono("1155554444")).toBe("5491155554444");
  });

  // Sin este filtro, normalizeArgentinaPhoneInput le pone 549 adelante a
  // cualquier numero y un piso queda guardado como telefono.
  it("descarta lo que no puede ser un telefono", () => {
    expect(parseTelefono("6")).toBeNull();
    expect(parseTelefono("4B")).toBeNull();
    expect(parseTelefono("")).toBeNull();
    expect(parseTelefono("3342")).toBeNull();
    expect(parseTelefono(11555544 as unknown as string)).toBeNull();
  });
});

describe("parseNombre", () => {
  it("toma el nombre tal como lo escribieron", () => {
    expect(parseNombre("Pepe")).toBe("Pepe");
    expect(parseNombre("  Maria  Jose ")).toBe("Maria Jose");
  });

  it("descarta lo que claramente no es un nombre", () => {
    expect(parseNombre("Castex 3342")).toBeNull();
    expect(parseNombre("a")).toBeNull();
    expect(parseNombre("")).toBeNull();
  });
});

describe("parseSiNo", () => {
  it("entiende las formas en que la gente dice que si", () => {
    expect(parseSiNo("si")).toBe(true);
    expect(parseSiNo("Si, por favor")).toBe(true);
    expect(parseSiNo("dale")).toBe(true);
    expect(parseSiNo("confirmo")).toBe(true);
    expect(parseSiNo("perfecto")).toBe(true);
  });

  it("entiende el no", () => {
    expect(parseSiNo("no")).toBe(false);
    expect(parseSiNo("no gracias")).toBe(false);
    expect(parseSiNo("ahora no")).toBe(false);
  });

  // Equivocarse hacia el si crea un pedido que nadie pidio.
  it("ante un mensaje con las dos cosas, gana el no", () => {
    expect(parseSiNo("no, dale mejor 2 cajas")).toBe(false);
  });

  it("no adivina cuando no es ni si ni no", () => {
    expect(parseSiNo("cuanto sale?")).toBeNull();
    expect(parseSiNo("")).toBeNull();
  });
});

describe("mergeOrderDraft", () => {
  it("acumula los datos que van llegando", () => {
    const conCantidad = mergeOrderDraft(draft(), { quantity: 2 });
    const conPago = mergeOrderDraft(conCantidad, { payment_method: "efectivo" });
    const conNombre = mergeOrderDraft(conPago, { customer_name: "Pepe" });

    expect(conNombre.cantidad).toBe(2);
    expect(conNombre.metodoPago).toBe("cash");
    expect(conNombre.nombre).toBe("Pepe");
  });

  // El caso que motivo todo esto: el cliente decia "2 cajas" al principio y el
  // bot le volvia a preguntar la cantidad al final.
  it("un mensaje sin datos no borra lo que ya habia", () => {
    const previo = draft({ cantidad: 2, metodoPago: "cash", nombre: "Pepe" });
    const despues = mergeOrderDraft(previo, {});

    expect(despues.cantidad).toBe(2);
    expect(despues.metodoPago).toBe("cash");
    expect(despues.nombre).toBe("Pepe");
  });

  it("un valor invalido tampoco lo pisa", () => {
    const previo = draft({ cantidad: 2 });
    expect(mergeOrderDraft(previo, { quantity: 2809 }).cantidad).toBe(2);
  });

  it("el cliente puede corregirse", () => {
    const previo = draft({ cantidad: 2 });
    expect(mergeOrderDraft(previo, { quantity: 3 }).cantidad).toBe(3);
  });
});

describe("resumirConfirmado", () => {
  it("sin nada confirmado no manda ruido al modelo", () => {
    expect(resumirConfirmado(draft())).toBeNull();
  });

  it("resume en castellano lo que ya se sabe", () => {
    const completo = draft({
      cantidad: 2,
      metodoPago: "cash",
      nombre: "Pepe",
      telefono: "5491155554444",
      direccion: direccionLista({
        etiqueta: "Castex 3342, CABA",
        esDepartamento: true,
        addressLine2: "4B"
      })
    });

    expect(resumirConfirmado(completo)).toEqual({
      direccion: "Castex 3342, CABA",
      tipo_vivienda: "departamento",
      piso_depto: "4B",
      cantidad_cajas: 2,
      forma_de_pago: "efectivo",
      nombre: "Pepe",
      telefono: "5491155554444"
    });
  });

  // Una direccion sin validar no se da por confirmada: si el modelo la lee como
  // cerrada, deja de pedir la que falta.
  it("no da por confirmada una direccion que Google no valido", () => {
    const sinValidar = draft({
      direccion: { ...EMPTY_ADDRESS_DRAFT, texto: "Castex 3342" }
    });
    expect(resumirConfirmado(sinValidar)).toBeNull();
  });
});

describe("nextOrderGap", () => {
  it("recorre los datos en el orden del equipo", () => {
    let actual = draft();
    expect(nextOrderGap(actual)).toEqual({ tipo: "cantidad" });

    actual = { ...actual, cantidad: 2 };
    expect(nextOrderGap(actual)).toEqual({ tipo: "direccion", gap: "calle" });

    actual = { ...actual, direccion: direccionLista() };
    expect(nextOrderGap(actual)).toEqual({ tipo: "pago" });

    actual = { ...actual, metodoPago: "cash" };
    expect(nextOrderGap(actual)).toEqual({ tipo: "nombre" });

    actual = { ...actual, nombre: "Pepe" };
    expect(nextOrderGap(actual)).toEqual({ tipo: "telefono" });

    actual = { ...actual, telefono: "5491155554444" };
    expect(nextOrderGap(actual)).toEqual({ tipo: "confirmacion" });

    actual = { ...actual, confirmado: true };
    expect(nextOrderGap(actual)).toBeNull();
  });

  it("ofrece el upsell antes de confirmar, y una sola vez", () => {
    const listo = draft({
      cantidad: 2,
      direccion: direccionLista(),
      metodoPago: "cash",
      nombre: "Pepe",
      telefono: "5491155554444"
    });

    expect(nextOrderGap(listo, true)).toEqual({ tipo: "upsell" });
    expect(nextOrderGap({ ...listo, upsellOfrecido: true }, true)).toEqual({ tipo: "confirmacion" });
  });

  // El corte de repeticiones existe porque insistir garantiza el bucle. Pero un
  // dato que no se puede completar despues no se puede saltear.
  it("saltea los datos de contacto si el cliente no los contesta", () => {
    const sinNombre = draft({
      cantidad: 2,
      direccion: direccionLista(),
      metodoPago: "cash",
      ultimaPregunta: "nombre",
      repeticiones: 2
    });

    expect(nextOrderGap(sinNombre)).toEqual({ tipo: "telefono" });
  });

  it("bloquea si falta la cantidad y el cliente no contesta", () => {
    const trabado = draft({ ultimaPregunta: "cantidad", repeticiones: 2 });
    expect(nextOrderGap(trabado)).toEqual({ tipo: "bloqueado", falta: "cantidad" });
  });

  it("cada pregunta lleva su propio contador", () => {
    expect(gapKey({ tipo: "direccion", gap: "piso_depto" })).toBe("direccion:piso_depto");
    expect(gapKey({ tipo: "telefono" })).toBe("telefono");
  });
});

describe("interpretOrderAnswer", () => {
  it("lee la respuesta a la pregunta que se acaba de hacer", () => {
    expect(interpretOrderAnswer({ tipo: "cantidad" }, "2 cajas")).toEqual({ cantidad: 2 });
    expect(interpretOrderAnswer({ tipo: "pago" }, "efectivo")).toEqual({ metodoPago: "cash" });
    expect(interpretOrderAnswer({ tipo: "nombre" }, "Pepe")).toEqual({ nombre: "Pepe" });
    expect(interpretOrderAnswer({ tipo: "telefono" }, "11 5555 4444")).toEqual({
      telefono: "5491155554444"
    });
    expect(interpretOrderAnswer({ tipo: "confirmacion" }, "si, por favor")).toEqual({
      confirmado: true
    });
    expect(interpretOrderAnswer({ tipo: "upsell" }, "no gracias")).toEqual({ upsellAceptado: false });
  });

  // Una confirmacion solo cuenta si es un si claro. El silencio no confirma.
  it("no confirma con una respuesta ambigua", () => {
    expect(interpretOrderAnswer({ tipo: "confirmacion" }, "cuanto era?")).toEqual({});
  });

  it("no inventa cuando la respuesta no encaja", () => {
    expect(interpretOrderAnswer({ tipo: "cantidad" }, "no se")).toEqual({});
    expect(interpretOrderAnswer({ tipo: "telefono" }, "despues te paso")).toEqual({});
  });
});

describe("buildOrderQuestion", () => {
  it("pregunta de a una cosa, corto y sin signos de apertura", () => {
    const preguntas = [
      buildOrderQuestion({ tipo: "cantidad" }, draft()),
      buildOrderQuestion({ tipo: "pago" }, draft()),
      buildOrderQuestion({ tipo: "nombre" }, draft()),
      buildOrderQuestion({ tipo: "telefono" }, draft())
    ];

    for (const pregunta of preguntas) {
      expect(pregunta).not.toContain("¿");
      expect(pregunta[0]).toBe(pregunta[0].toLowerCase());
      expect(pregunta.length).toBeLessThan(60);
    }
  });

  it("delega las preguntas de direccion", () => {
    expect(buildOrderQuestion({ tipo: "direccion", gap: "tipo_vivienda" }, draft())).toBe(
      "es casa o departamento?"
    );
  });
});

describe("missingOrderFields", () => {
  it("enumera lo imprescindible para poder registrar el pedido", () => {
    expect(missingOrderFields(draft())).toEqual(["cantidad", "direccion"]);
  });

  it("un pedido con cantidad y direccion ya se puede registrar", () => {
    const completo = draft({ cantidad: 1, direccion: direccionLista() });

    expect(missingOrderFields(completo)).toEqual([]);
    expect(isOrderComplete(completo)).toBe(true);
  });
});

describe("pareceConsulta", () => {
  // En medio de un pedido, una pregunta merece una respuesta y no la siguiente
  // pregunta del formulario.
  it("reconoce una pregunta", () => {
    expect(pareceConsulta("cuanto sale la chica?")).toBe(true);
    expect(pareceConsulta("hasta donde llegan")).toBe(false);
    expect(pareceConsulta("llegan a San Isidro?")).toBe(true);
    expect(pareceConsulta("tenes frutos secos")).toBe(true);
  });

  // El filtro es de forma justamente para esto: el modelo a veces clasifica como
  // consulta la respuesta a su propia pregunta, y ahi el pedido se trabaria.
  it("no confunde una respuesta con una pregunta", () => {
    expect(pareceConsulta("efectivo")).toBe(false);
    expect(pareceConsulta("Pepe Gonzalez")).toBe(false);
    expect(pareceConsulta("4B")).toBe(false);
    expect(pareceConsulta("2 cajas")).toBe(false);
    expect(pareceConsulta("")).toBe(false);
  });
});
