import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS_DRAFT, type AddressDraft } from "./address";
import {
  EMPTY_ORDER_DRAFT,
  buildOrderQuestion,
  estadoDelDraft,
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
  parseRetomar,
  parseSiNo,
  parseTelefono,
  reiniciarPedido,
  resumirConfirmado,
  sinEco,
  trajoAlgoConcreto,
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

  // Paso en una prueba real: el bot pregunto "a nombre de quien te lo anoto?",
  // el cliente dijo "hola", y el pedido quedo a nombre de "hola".
  it("un saludo no es un nombre", () => {
    expect(parseNombre("hola")).toBeNull();
    expect(parseNombre("buenas tardes")).toBeNull();
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

    expect(nextOrderGap(listo, { upsellDisponible: true })).toEqual({ tipo: "upsell" });
    expect(nextOrderGap({ ...listo, upsellOfrecido: true }, { upsellDisponible: true })).toEqual({ tipo: "confirmacion" });
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
  it("pregunta de a una cosa, corto, bien escrito y sin signos de apertura", () => {
    const preguntas = [
      buildOrderQuestion({ tipo: "cantidad" }, draft()),
      buildOrderQuestion({ tipo: "pago" }, draft()),
      buildOrderQuestion({ tipo: "nombre" }, draft()),
      buildOrderQuestion({ tipo: "telefono" }, draft())
    ];

    for (const pregunta of preguntas) {
      expect(pregunta).not.toContain("¿");
      // El tono es informal, la ortografia no: mayuscula inicial y acentos.
      expect(pregunta[0]).toBe(pregunta[0].toUpperCase());
      expect(pregunta.length).toBeLessThan(60);
    }
  });

  it("delega las preguntas de direccion", () => {
    expect(buildOrderQuestion({ tipo: "direccion", gap: "tipo_vivienda" }, draft())).toBe(
      "Es casa o departamento?"
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

describe("estadoDelDraft", () => {
  const arranque = "2026-08-16T12:00:00.000Z";

  function hace(horas: number) {
    return new Date(new Date(arranque).getTime() - horas * 3_600_000).toISOString();
  }

  it("sin nada que retomar no hay estado", () => {
    expect(estadoDelDraft(draft(), arranque)).toBe("vacio");
    expect(estadoDelDraft(draft({ nombre: "Pepe", actualizadoEn: hace(1) }), arranque)).toBe("vacio");
  });

  it("recien hablado sigue siendo el pedido en curso", () => {
    expect(estadoDelDraft(draft({ cantidad: 2, actualizadoEn: hace(0.5) }), arranque)).toBe("activo");
    expect(estadoDelDraft(draft({ cantidad: 2, actualizadoEn: hace(2.9) }), arranque)).toBe("activo");
  });

  it("a las pocas horas hay que nombrar el hueco", () => {
    expect(estadoDelDraft(draft({ cantidad: 2, actualizadoEn: hace(3) }), arranque)).toBe("dormido");
    expect(estadoDelDraft(draft({ cantidad: 2, actualizadoEn: hace(20) }), arranque)).toBe("dormido");
  });

  it("pasado un dia deja de ser un pedido en curso", () => {
    expect(estadoDelDraft(draft({ cantidad: 2, actualizadoEn: hace(24) }), arranque)).toBe("sugerencia");
    expect(estadoDelDraft(draft({ cantidad: 2, actualizadoEn: hace(72) }), arranque)).toBe("sugerencia");
  });

  // Los drafts guardados antes de que existiera el campo se curan solos en el
  // primer mensaje, sin script de migracion.
  it("un draft sin fecha cuenta como viejo", () => {
    expect(estadoDelDraft(draft({ cantidad: 2 }), arranque)).toBe("sugerencia");
  });

  it("un pedido ya creado no se retoma", () => {
    const creado = draft({ cantidad: 2, actualizadoEn: hace(4), createdOrderId: "order-1" });
    expect(estadoDelDraft(creado, arranque)).toBe("vacio");
  });

  it("nombrar el hueco le gana a cualquier dato que falte", () => {
    const aMedias = draft({ cantidad: 2, actualizadoEn: hace(5) });

    expect(nextOrderGap(aMedias)).toEqual({ tipo: "direccion", gap: "calle" });
    expect(nextOrderGap(aMedias, { estado: "dormido" })).toEqual({ tipo: "retomar" });
    expect(nextOrderGap(aMedias, { estado: "sugerencia" })).toEqual({ tipo: "retomar" });
  });
});

describe("reiniciarPedido", () => {
  const lleno = draft({
    cantidad: 2,
    metodoPago: "cash",
    nombre: "Pepe",
    telefono: "5491155554444",
    producto: "Paltas",
    upsellOfrecido: true,
    confirmado: true,
    direccion: direccionLista(),
    createdOrderId: "order-1"
  });

  // Es la misma persona: volver a pedirle el nombre y el telefono se lee como
  // que no lo escuchamos.
  it("nunca pierde el contacto", () => {
    for (const conservarDireccion of [true, false]) {
      const limpio = reiniciarPedido(lleno, { conservarDireccion });

      expect(limpio.nombre).toBe("Pepe");
      expect(limpio.telefono).toBe("5491155554444");
      expect(limpio.cantidad).toBeNull();
      expect(limpio.metodoPago).toBeNull();
      expect(limpio.confirmado).toBe(false);
      expect(limpio.createdOrderId).toBeNull();
    }
  });

  it("conserva la direccion solo cuando se le pide", () => {
    expect(reiniciarPedido(lleno, { conservarDireccion: true }).direccion.googlePlaceId).toBe("place-1");
    expect(reiniciarPedido(lleno, { conservarDireccion: false }).direccion.googlePlaceId).toBeNull();
  });
});

describe("parseRetomar", () => {
  it("entiende que quiere seguir", () => {
    expect(parseRetomar("si")).toBe("seguir");
    expect(parseRetomar("dale")).toBe("seguir");
    expect(parseRetomar("seguimos")).toBe("seguir");
    expect(parseRetomar("si, eso mismo")).toBe("seguir");
  });

  it("entiende que quiere arrancar de nuevo", () => {
    expect(parseRetomar("no")).toBe("de_cero");
    expect(parseRetomar("arrancamos de nuevo")).toBe("de_cero");
    expect(parseRetomar("de cero")).toBe("de_cero");
    expect(parseRetomar("otra cosa")).toBe("de_cero");
  });

  // "si, de cero" tiene las dos cosas. Gana empezar de nuevo, que es lo que el
  // cliente esta pidiendo: parseSiNo aca leeria un si.
  it("ante un mensaje con las dos cosas, gana empezar de nuevo", () => {
    expect(parseRetomar("si, arrancamos de nuevo")).toBe("de_cero");
    expect(parseRetomar("dale, de cero")).toBe("de_cero");
  });

  it("no adivina cuando la respuesta es otra cosa", () => {
    expect(parseRetomar("cuanto sale?")).toBeNull();
    expect(parseRetomar("")).toBeNull();
  });
});

describe("trajoAlgoConcreto", () => {
  // Si el cliente ya dijo lo que quiere, sacarle un pedido de anteayer es
  // hablarle de otra cosa.
  it("reconoce cuando el cliente ya dijo lo que necesita", () => {
    expect(trajoAlgoConcreto({ quantity: 3 }, draft())).toBe(true);
    expect(trajoAlgoConcreto({ delivery_address: "Castex 3342" }, draft())).toBe(true);
  });

  // El modelo completa product_name aunque el mensaje sea un saludo, asi que no
  // se puede usar para decidir esto.
  it("un saludo no cuenta, ni con producto adivinado", () => {
    expect(trajoAlgoConcreto({}, draft())).toBe(false);
    expect(trajoAlgoConcreto({ product_name: "Paltas" }, draft())).toBe(false);
    expect(trajoAlgoConcreto({ quantity: 2809 }, draft())).toBe(false);
  });

  // El prompt le pide al modelo repetir todo dato que aparezca en la
  // conversacion, aunque sea de varios mensajes atras. Sin comparar contra lo
  // guardado, un "hola" pelado devolvia la cantidad y la direccion de siempre y
  // esto daba true para siempre: el hueco no se nombraba nunca.
  it("no confunde el eco del modelo con un dato nuevo", () => {
    const previo = draft({ cantidad: 2, direccion: direccionLista() });

    expect(trajoAlgoConcreto({ quantity: 2 }, previo)).toBe(false);
    expect(trajoAlgoConcreto({ delivery_address: "Castex 3342" }, previo)).toBe(false);
    expect(trajoAlgoConcreto({ quantity: 3 }, previo)).toBe(true);
    expect(trajoAlgoConcreto({ delivery_address: "Cabello 3373" }, previo)).toBe(true);
  });
});

describe("sinEco", () => {
  const viejo = draft({ cantidad: 3, metodoPago: "cash", nombre: "Pepe", direccion: direccionLista() });

  // El caso real: se descarta el pedido de ayer, el modelo devuelve ese mismo
  // pedido en "extracted", y el reinicio se deshace solo en el mismo mensaje.
  it("saca lo que es repeticion del pedido que se descarto", () => {
    const limpio = sinEco(
      { quantity: 3, payment_method: "efectivo", customer_name: "Pepe", delivery_address: "Castex 3342" },
      viejo
    );

    expect(limpio).toEqual({});
  });

  // "no, mejor 5 cajas" descarta el pedido viejo pero el 5 tiene que sobrevivir.
  it("deja pasar lo que el cliente dijo de nuevo", () => {
    const limpio = sinEco({ quantity: 5, delivery_address: "Cabello 3373" }, viejo);

    expect(limpio).toEqual({ quantity: 5, delivery_address: "Cabello 3373" });
  });

  it("la zona se va con la direccion que repite", () => {
    const limpio = sinEco({ delivery_address: "Castex 3342", delivery_zone: "CABA" }, viejo);

    expect(limpio).toEqual({});
  });
});
