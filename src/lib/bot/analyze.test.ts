import { describe, expect, it } from "vitest";
import { BOT_SYSTEM_PROMPT, buildAnalysisPrompt, parseAnalysis } from "./analyze";

const RESPUESTA_VALIDA = {
  intent: "buy",
  confidence: 0.9,
  extracted: { quantity: 2 },
  missing_fields: ["delivery_address"],
  should_handoff_to_human: false,
  suggested_reply: "Perfecto, te tomo el pedido.",
  can_create_order: false
};

function conIntent(intent: string) {
  return JSON.stringify({ ...RESPUESTA_VALIDA, intent });
}

describe("parseAnalysis", () => {
  it("convierte la respuesta del modelo a camelCase", () => {
    const analysis = parseAnalysis(JSON.stringify(RESPUESTA_VALIDA));
    expect(analysis.intent).toBe("buy");
    expect(analysis.missingFields).toEqual(["delivery_address"]);
    expect(analysis.shouldHandoffToHuman).toBe(false);
    expect(analysis.canCreateOrder).toBe(false);
  });

  // Los modelos devuelven variantes del mismo intent; el mapa de alias existe
  // desde el worker de WhatsApp y hay que conservarlo.
  it("normaliza los alias de intent conocidos", () => {
    expect(parseAnalysis(conIntent("price_inquiry")).intent).toBe("ask_price");
    expect(parseAnalysis(conIntent("reorder")).intent).toBe("buy");
    expect(parseAnalysis(conIntent("unsubscribe")).intent).toBe("opt_out");
    expect(parseAnalysis(conIntent("delivery_inquiry")).intent).toBe("ask_delivery");
  });

  // Algunos proveedores envuelven el JSON en un bloque de codigo.
  it("tolera el JSON envuelto en un bloque markdown", () => {
    const envuelto = "```json\n" + JSON.stringify(RESPUESTA_VALIDA) + "\n```";
    expect(parseAnalysis(envuelto).intent).toBe("buy");
  });

  it("tolera texto suelto alrededor del JSON", () => {
    const conRuido = `Claro, aca va:\n${JSON.stringify(RESPUESTA_VALIDA)}\nEspero que sirva.`;
    expect(parseAnalysis(conRuido).intent).toBe("buy");
  });

  // Ante la duda derivamos a humano: es mas barato molestar a Jose que
  // contestarle cualquier cosa a un cliente.
  it("cae en unknown con baja confianza si el JSON esta roto", () => {
    const analysis = parseAnalysis("no soy json");
    expect(analysis.intent).toBe("unknown");
    expect(analysis.confidence).toBe(0);
    expect(analysis.shouldHandoffToHuman).toBe(true);
  });

  it("cae en unknown si el intent no pertenece al enum", () => {
    const analysis = parseAnalysis(conIntent("pedir_un_taxi"));
    expect(analysis.intent).toBe("unknown");
    expect(analysis.shouldHandoffToHuman).toBe(true);
  });

  it("cae en unknown si falta la confianza", () => {
    const analysis = parseAnalysis(JSON.stringify({ intent: "buy" }));
    expect(analysis.intent).toBe("unknown");
    expect(analysis.shouldHandoffToHuman).toBe(true);
  });

  it("completa los campos opcionales que el modelo omite", () => {
    const analysis = parseAnalysis(JSON.stringify({ intent: "satisfied", confidence: 0.8 }));
    expect(analysis.extracted).toEqual({});
    expect(analysis.missingFields).toEqual([]);
    expect(analysis.suggestedReply).toBe("");
    expect(analysis.canCreateOrder).toBe(false);
  });
});

// Estas dos reglas son decisiones de producto, no detalles de redaccion: que el
// bot no se haga pasar por persona y que no invente precios. El test existe para
// que no desaparezcan en una reescritura del prompt sin que nadie se entere.
describe("BOT_SYSTEM_PROMPT", () => {
  it("le da al bot su identidad de marca", () => {
    expect(BOT_SYSTEM_PROMPT).toContain("Cande");
    expect(BOT_SYSTEM_PROMPT).toContain("Paltas La Candelaria");
  });

  it("obliga a admitir que es un asistente automatico si preguntan", () => {
    expect(BOT_SYSTEM_PROMPT).toContain("asistente automatico");
    expect(BOT_SYSTEM_PROMPT).toContain("Nunca afirmes ser una persona");
  });

  it("mantiene la prohibicion de inventar precios y stock", () => {
    expect(BOT_SYSTEM_PROMPT).toContain("No inventes precios");
  });

  it("enumera los intents validos para que el modelo no invente uno", () => {
    expect(BOT_SYSTEM_PROMPT).toContain("confirm_order");
    expect(BOT_SYSTEM_PROMPT).toContain("opt_out");
  });
});

describe("buildAnalysisPrompt", () => {
  it("mete el contexto comercial y el mensaje en el prompt", () => {
    const prompt = buildAnalysisPrompt({
      commercialContext: { main_product: "Caja de paltas premium de 4kg" },
      conversationStatus: "idle",
      messageBody: "cuanto sale?",
      recentMessages: [{ direction: "outbound", body: "Hola!" }]
    });

    expect(prompt).toContain("Caja de paltas premium de 4kg");
    expect(prompt).toContain("cuanto sale?");
    expect(prompt).toContain("Hola!");
  });

  // El prompt entra en el cache del proveedor: si llevara reloj o ids, cada
  // llamada seria un prefijo distinto y no cachearia nunca.
  it("es estable ante el mismo input: el prompt no lleva reloj", () => {
    const input = {
      commercialContext: {},
      conversationStatus: "idle",
      messageBody: "hola",
      recentMessages: []
    };
    expect(buildAnalysisPrompt(input)).toBe(buildAnalysisPrompt(input));
  });
});
