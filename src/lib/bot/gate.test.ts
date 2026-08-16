import { describe, expect, it } from "vitest";
import type { ConversationState } from "./types";
import {
  CANNED_REPLIES,
  GATE_DEFAULTS,
  evaluateGate,
  hasDomainSignal,
  isGreetingOnly,
  truncateForLlm
} from "./gate";

const AHORA = "2026-08-15T15:00:00.000Z";

function conversacion(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    id: "conv-1",
    channel: "telegram",
    threadId: "123",
    customerId: null,
    status: "idle",
    requiresHuman: false,
    botMutedUntil: null,
    offTopicStrikes: 0,
    llmCallsToday: 0,
    llmCallsDate: "2026-08-15",
    draftOrder: null,
    outboundLastHour: 0,
    lastInboundText: null,
    lastInboundAt: null,
    optedOut: false,
    ...overrides
  };
}

function entrada(overrides: Partial<Parameters<typeof evaluateGate>[0]> = {}) {
  return {
    now: AHORA,
    threadId: "123",
    text: "hola, cuanto sale el cajon de paltas?",
    conversation: conversacion(),
    allowedThreadIds: [] as string[],
    ...GATE_DEFAULTS,
    ...overrides
  };
}

describe("evaluateGate", () => {
  it("deja pasar un mensaje normal de un cliente", () => {
    expect(evaluateGate(entrada()).action).toBe("allow");
  });

  it("corta a quien no esta en la allowlist, sin gastar LLM", () => {
    const decision = evaluateGate(entrada({ allowedThreadIds: ["999"] }));
    expect(decision).toEqual({
      action: "canned_reply",
      reason: "not_allowed",
      body: CANNED_REPLIES.notAllowed,
      countsAsStrike: false
    });
  });

  it("una allowlist vacia no bloquea a nadie: es el modo produccion", () => {
    expect(evaluateGate(entrada({ allowedThreadIds: [] })).action).toBe("allow");
  });

  it("ignora la conversacion mientras el bot esta silenciado", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ botMutedUntil: "2026-08-15T16:00:00.000Z" }) })
    );
    expect(decision).toEqual({ action: "ignore", reason: "muted" });
  });

  it("vuelve a responder cuando el silencio ya vencio", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ botMutedUntil: "2026-08-15T14:59:59.000Z" }) })
    );
    expect(decision.action).toBe("allow");
  });

  it("se calla si un humano tomo la conversacion", () => {
    const decision = evaluateGate(entrada({ conversation: conversacion({ requiresHuman: true }) }));
    expect(decision).toEqual({ action: "ignore", reason: "needs_human" });
  });

  it("deriva a humano al pasarse del limite de respuestas por hora", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ outboundLastHour: GATE_DEFAULTS.maxAutoRepliesPerHour }) })
    );
    expect(decision).toEqual({ action: "handoff", reason: "rate_limited" });
  });

  // Coordinar un pedido lleva varios intercambios seguidos: el limite tiene que
  // dejar pasar una compra normal y frenar solo un bucle.
  it("una conversacion de compra normal no toca el limite", () => {
    expect(GATE_DEFAULTS.maxAutoRepliesPerHour).toBeGreaterThanOrEqual(15);
    expect(evaluateGate(entrada({ conversation: conversacion({ outboundLastHour: 8 }) })).action).toBe("allow");
  });

  it("frena cuando la conversacion agoto su presupuesto diario de LLM", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ llmCallsToday: 30, llmCallsDate: "2026-08-15" }) })
    );
    expect(decision.action).toBe("canned_reply");
    expect(decision).toMatchObject({ reason: "budget_exhausted" });
  });

  it("el presupuesto se reinicia al cambiar el dia", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ llmCallsToday: 30, llmCallsDate: "2026-08-14" }) })
    );
    expect(decision.action).toBe("allow");
  });

  it("no gasta LLM en un mensaje vacio o de solo emojis", () => {
    expect(evaluateGate(entrada({ text: "   " })).action).toBe("ignore");
    expect(evaluateGate(entrada({ text: "🥑🥑🥑" })).action).toBe("ignore");
  });

  // El doble toque accidental: el mismo texto reenviado a los pocos segundos.
  it("ignora el mismo mensaje repetido dentro de la ventana corta", () => {
    const decision = evaluateGate(
      entrada({
        text: "quiero 2 cajones de paltas",
        conversation: conversacion({
          lastInboundText: "quiero 2 cajones de paltas",
          lastInboundAt: "2026-08-15T14:59:55.000Z"
        })
      })
    );
    expect(decision).toEqual({ action: "ignore", reason: "duplicate" });
  });

  it("el mismo texto pasado un rato si es un mensaje nuevo", () => {
    const decision = evaluateGate(
      entrada({
        text: "hola",
        conversation: conversacion({
          lastInboundText: "hola",
          lastInboundAt: "2026-08-15T14:00:00.000Z"
        })
      })
    );
    expect(decision.action).not.toBe("ignore");
  });

  // La ventana es corta a proposito: alguien que repite el saludo 20 segundos
  // despues porque no le contestaron tiene que recibir respuesta, no silencio.
  it("un saludo repetido a los 20 segundos vuelve a contestarse", () => {
    const decision = evaluateGate(
      entrada({
        text: "Hola",
        conversation: conversacion({
          lastInboundText: "Hola",
          lastInboundAt: "2026-08-15T14:59:40.000Z"
        })
      })
    );
    expect(decision).toMatchObject({ reason: "greeting" });
  });

  it("solo ataja el doble toque accidental", () => {
    expect(GATE_DEFAULTS.duplicateWindowSeconds).toBeLessThanOrEqual(15);
  });

  // Medido sobre 343 mensajes reales de Instagram: filtrar por vocabulario
  // marcaba como fuera de tema al 63%, incluyendo "De una", "Gracias" y
  // "Todo buenos aires?". El gasto lo contienen el limite por hora y el
  // presupuesto diario, que no dependen de adivinar el tema.
  it("deja pasar aunque no reconozca el vocabulario", () => {
    expect(evaluateGate(entrada({ text: "escribime un poema sobre el mar" })).action).toBe("allow");
    expect(evaluateGate(entrada({ text: "De una" })).action).toBe("allow");
    expect(evaluateGate(entrada({ text: "Todo buenos aires?" })).action).toBe("allow");
    expect(evaluateGate(entrada({ text: "Gracias" })).action).toBe("allow");
  });

  // El caso critico: un cliente con pedido en curso puede decir cualquier cosa
  // (una direccion, un horario, un "dale") y tiene que llegar al LLM igual.
  it("un mensaje sin palabras del dominio pasa igual si hay un pedido en curso", () => {
    const decision = evaluateGate(
      entrada({
        text: "Av. Cabildo 2200, timbre 4B",
        conversation: conversacion({ status: "collecting_order_data" })
      })
    );
    expect(decision.action).toBe("allow");
  });

  it("un borrador de pedido tambien habilita el paso libre", () => {
    const decision = evaluateGate(
      entrada({
        text: "dale",
        conversation: conversacion({ draftOrder: { confirmed_payload: { items: [] } } })
      })
    );
    expect(decision.action).toBe("allow");
  });

  // El silencio por strikes sigue existiendo para el silenciado manual, pero ya
  // nada acumula strikes por si solo: sin filtro por vocabulario, no hay quien
  // los sume. Se mantiene el mute explicito, que si se sigue respetando.
  it("respeta el silencio explicito aunque no haya strikes", () => {
    const decision = evaluateGate(
      entrada({
        text: "contame un chiste",
        conversation: conversacion({ botMutedUntil: "2026-08-15T23:00:00.000Z" })
      })
    );
    expect(decision).toEqual({ action: "ignore", reason: "muted" });
  });

  it("trata una conversacion nueva sin registro como conversacion valida", () => {
    expect(evaluateGate(entrada({ conversation: null })).action).toBe("allow");
  });

  it("no responde a quien pidio la baja", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ optedOut: true }), text: "hola" })
    );
    expect(decision).toEqual({ action: "ignore", reason: "opted_out" });
  });
});

// Encontrado probando con mensajes reales: un "Hola" pelado iba al modelo, volvia
// con baja confianza y derivaba la conversacion a humano en el primer mensaje.
// Como casi toda conversacion arranca saludando, el bot moria antes de empezar.
describe("saludos", () => {
  it("contesta un saludo pelado sin gastar LLM y sin penalizar", () => {
    const decision = evaluateGate(entrada({ text: "Hola" }));
    expect(decision).toEqual({
      action: "canned_reply",
      reason: "greeting",
      body: CANNED_REPLIES.greeting,
      countsAsStrike: false
    });
  });

  it("reconoce las variantes que usa la gente", () => {
    for (const saludo of ["hola", "Holaa", "buenas", "buenas tardes", "hola! como estas?", "Buen dia"]) {
      expect(evaluateGate(entrada({ text: saludo }))).toMatchObject({ reason: "greeting" });
    }
  });

  // Un saludo con pedido adentro tiene que llegar al modelo igual.
  it("un saludo con contenido real pasa al modelo", () => {
    expect(evaluateGate(entrada({ text: "hola, queria pedir paltas" })).action).toBe("allow");
    expect(evaluateGate(entrada({ text: "buenas, cuanto sale el cajon?" })).action).toBe("allow");
  });

  it("saludar no acumula strikes", () => {
    const decision = evaluateGate(
      entrada({ text: "hola", conversation: conversacion({ offTopicStrikes: 2 }) })
    );
    expect(decision).toMatchObject({ countsAsStrike: false });
  });
});

describe("isGreetingOnly", () => {
  it("distingue el saludo pelado del saludo con pedido", () => {
    expect(isGreetingOnly("hola")).toBe(true);
    expect(isGreetingOnly("buenas tardes")).toBe(true);
    expect(isGreetingOnly("hola queria paltas")).toBe(false);
  });

  // Sin el tope de palabras, una frase larga de puro relleno pasaria como saludo.
  it("no trata una frase larga como saludo", () => {
    expect(isGreetingOnly("hola hola hola hola hola")).toBe(false);
  });

  it("un texto vacio no es saludo", () => {
    expect(isGreetingOnly("   ")).toBe(false);
  });
});

describe("hasDomainSignal", () => {
  it("reconoce el vocabulario del negocio", () => {
    expect(hasDomainSignal("cuanto sale la caja?")).toBe(true);
    expect(hasDomainSignal("queria pedir 2 cajones")).toBe(true);
    expect(hasDomainSignal("me llegan las paltas hoy?")).toBe(true);
  });

  // El lexico se compara sin tildes para que "cuánto" y "cuanto" pesen igual.
  it("ignora las tildes al comparar", () => {
    expect(hasDomainSignal("¿cuánto está el cajón?")).toBe(true);
  });

  it("no confunde una subcadena con una palabra", () => {
    expect(hasDomainSignal("precioso atardecer")).toBe(false);
  });

  it("un saludo pelado no es senal de dominio", () => {
    expect(hasDomainSignal("hola que tal")).toBe(false);
  });
});

describe("truncateForLlm", () => {
  it("deja intacto lo que entra en el limite", () => {
    expect(truncateForLlm("hola", 10)).toBe("hola");
  });

  // Un mensaje larguisimo encarece la llamada sin aportar: se recorta antes de enviarlo.
  it("recorta lo que se pasa del limite", () => {
    expect(truncateForLlm("a".repeat(20), 5)).toBe("aaaaa");
  });
});
