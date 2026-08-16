import { describe, expect, it } from "vitest";
import { NO_CAPABILITIES, type BotCapabilities } from "./capabilities";
import { BOT_INTENTS, type BotAnalysis, type ConversationState } from "./types";
import { ENGINE_DEFAULTS, decideNextAction, shouldHandoff } from "./engine";

const TODO_CARGADO: BotCapabilities = { deliveryZones: true, prices: true, products: true };

function analisis(overrides: Partial<BotAnalysis> = {}): BotAnalysis {
  return {
    intent: "satisfied",
    confidence: 0.95,
    extracted: {},
    missingFields: [],
    shouldHandoffToHuman: false,
    suggestedReply: "Genial, gracias por contarnos.",
    canCreateOrder: false,
    ...overrides
  };
}

function conversacion(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    id: "conv-1",
    channel: "telegram",
    threadId: "123",
    customerId: "cust-1",
    status: "idle",
    requiresHuman: false,
    botMutedUntil: null,
    offTopicStrikes: 0,
    llmCallsToday: 1,
    llmCallsDate: "2026-08-15",
    draftOrder: null,
    outboundLastHour: 0,
    lastInboundText: null,
    lastInboundAt: null,
    optedOut: false,
    ...overrides
  };
}

function entrada(overrides: Partial<Parameters<typeof decideNextAction>[0]> = {}) {
  return {
    analysis: analisis(),
    conversation: conversacion(),
    repeatOrder: null,
    capabilities: TODO_CARGADO,
    ...ENGINE_DEFAULTS,
    ...overrides
  };
}

describe("decideNextAction", () => {
  it("la baja gana sobre cualquier otra regla", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "opt_out", confidence: 0.4 }) })
    );
    expect(action.type).toBe("opt_out");
  });

  it("deriva a humano ante un reclamo", () => {
    const action = decideNextAction(entrada({ analysis: analisis({ intent: "complaint" }) }));
    expect(action).toEqual({ type: "handoff", reason: "complaint" });
  });

  // Con el catalogo y las zonas cargadas el bot contesta solo. Antes derivaba
  // siempre, y un "hacen envios a Bariloche?" (cuya respuesta es no) terminaba
  // escalado a una persona y con el cliente esperando.
  it("contesta precio, entrega y catalogo cuando el contexto alcanza", () => {
    for (const intent of ["ask_price", "ask_delivery", "ask_products"] as const) {
      expect(decideNextAction(entrada({ analysis: analisis({ intent }) })).type).toBe("reply");
    }
  });

  it("deriva esas mismas preguntas si el contexto esta vacio", () => {
    for (const intent of ["ask_price", "ask_delivery", "ask_products"] as const) {
      const action = decideNextAction(
        entrada({ analysis: analisis({ intent }), capabilities: NO_CAPABILITIES })
      );
      expect(action).toEqual({ type: "handoff", reason: intent });
    }
  });

  // Cada pregunta mira su propio dato: tener zonas no habilita a hablar de precios.
  it("cada pregunta depende solo del dato que necesita", () => {
    const soloZonas: BotCapabilities = { deliveryZones: true, prices: false, products: false };
    expect(decideNextAction(entrada({ analysis: analisis({ intent: "ask_delivery" }), capabilities: soloZonas })).type).toBe("reply");
    expect(decideNextAction(entrada({ analysis: analisis({ intent: "ask_price" }), capabilities: soloZonas })).type).toBe("handoff");
  });

  // Un reclamo no depende de tener datos: necesita que alguien se haga cargo.
  it("un reclamo deriva aunque el contexto este completo", () => {
    expect(decideNextAction(entrada({ analysis: analisis({ intent: "complaint" }) })).type).toBe("handoff");
  });

  it("deriva a humano cuando el modelo no esta seguro", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "buy", confidence: 0.5 }) })
    );
    expect(action).toEqual({ type: "handoff", reason: "low_confidence" });
  });

  it("respeta el pedido explicito de handoff del modelo", () => {
    const action = decideNextAction(entrada({ analysis: analisis({ shouldHandoffToHuman: true }) }));
    expect(action).toEqual({ type: "handoff", reason: "model_requested" });
  });

  it("cierra la conversacion ante un no", () => {
    for (const intent of ["not_interested", "not_now", "cancel_order"] as const) {
      expect(decideNextAction(entrada({ analysis: analisis({ intent }) })).type).toBe("close");
    }
  });

  it("propone repetir el ultimo pedido cuando el cliente quiere comprar", () => {
    const action = decideNextAction(
      entrada({
        analysis: analisis({ intent: "buy" }),
        repeatOrder: {
          payload: { customerId: "cust-1", items: [{ productId: "var-1", quantity: 1 }] },
          summary: {
            items: "1 x Paltas 4kg",
            address: "Cabildo 2200",
            paymentMethod: "transferencia"
          }
        }
      })
    );
    expect(action.type).toBe("confirm_draft");
    expect(action).toMatchObject({ draftOrder: { summary: { items: "1 x Paltas 4kg" } } });
  });

  it("el borrador propuesto conserva lo que ya habia en la conversacion", () => {
    const action = decideNextAction(
      entrada({
        analysis: analisis({ intent: "buy" }),
        conversation: conversacion({ draftOrder: { nota: "timbre roto" } }),
        repeatOrder: {
          payload: { customerId: "cust-1", items: [] },
          summary: { items: "1 x Paltas 4kg", address: "Cabildo 2200", paymentMethod: "efectivo" }
        }
      })
    );
    expect(action).toMatchObject({ draftOrder: { nota: "timbre roto" } });
  });

  it("sin historial de pedidos responde con el texto del modelo en vez de proponer", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "buy" }), repeatOrder: null })
    );
    expect(action.type).toBe("reply");
    expect(action).toMatchObject({ nextStatus: "collecting_order_data" });
  });

  // Sin confirmacion explicita no se crea nada: regla dura del proyecto.
  it("crea el pedido solo si hay borrador confirmado", () => {
    const conBorrador = conversacion({
      draftOrder: { confirmed_payload: { customerId: "cust-1", items: [] } }
    });
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "confirm_order" }), conversation: conBorrador })
    );
    expect(action.type).toBe("create_order");
    expect(action).toMatchObject({ confirmedPayload: { customerId: "cust-1" } });
  });

  it("un confirm_order sin borrador no crea nada y deriva", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "confirm_order" }), conversation: conversacion() })
    );
    expect(action).toEqual({ type: "handoff", reason: "confirm_without_draft" });
  });

  it("cae en una respuesta por defecto si el modelo no sugirio nada", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "satisfied", suggestedReply: "" }) })
    );
    expect(action.type).toBe("reply");
    expect((action as { body: string }).body.length).toBeGreaterThan(0);
  });

  it("cubre todos los intents del enum sin romperse", () => {
    for (const intent of BOT_INTENTS) {
      const action = decideNextAction(entrada({ analysis: analisis({ intent }) }));
      expect(action.type).toBeTruthy();
    }
  });
});

describe("shouldHandoff", () => {
  it("el umbral de confianza es 0.75", () => {
    expect(ENGINE_DEFAULTS.minConfidence).toBe(0.75);
    expect(shouldHandoff(analisis({ intent: "buy", confidence: 0.74 }), 0.75, TODO_CARGADO)).toBe(true);
    expect(shouldHandoff(analisis({ intent: "buy", confidence: 0.75 }), 0.75, TODO_CARGADO)).toBe(false);
  });
});
