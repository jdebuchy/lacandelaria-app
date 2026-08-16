# Bot conversacional multicanal (Telegram) — Fases 0 a 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer el motor de conversación del worker de WhatsApp a la app Next.js, agnóstico de canal, y enchufarle Telegram para poder tomar pedidos reales desde el teléfono con un LLM intercambiable.

**Architecture:** El motor vive en `src/lib/bot/` como funciones puras testeables, con adaptadores finos por canal (Telegram, WhatsApp) y por proveedor de LLM (`claude -p`, API de Anthropic, OpenRouter). Las tablas `whatsapp_*` se renombran a genéricas con una columna `channel`. El webhook de Telegram es una API route de Next; no hay proceso nuevo.

**Tech Stack:** Next.js 16 (App Router, Node runtime), TypeScript 5.8, Zod 3.24.4 (pinneado), Supabase (service role), Vitest 4, `@anthropic-ai/sdk` (dependencia nueva).

**Spec:** `/Users/jdebuchy/.claude/plans/me-ayudas-a-planificar-tender-puffin.md`

## Global Constraints

- **Idioma:** identificadores y tipos en inglés; mensajes de UI/API, comentarios y títulos de test en **español rioplatense**. Comentarios en `.ts` **sin tildes** (convención del repo).
- **Comentarios explican el porqué, no la mecánica.** Solo comentar decisiones y restricciones que el código no puede mostrar.
- **Sin em dashes** en ningún output (prosa, comentarios, mensajes). Usar coma, punto, dos puntos o paréntesis.
- **Tests:** Vitest, solo archivos `src/lib/**/*.test.ts`, co-ubicados junto al módulo. **Cero mocks** (`vi.`, `beforeEach` no aparecen en ningún test del repo). Solo funciones puras. `describe` agrupa por función; nombres de test en voz de negocio.
- **Nada de `Date.now()` dentro de funciones puras.** El instante actual se inyecta siempre como parámetro `now: string` (ISO) para que los tests no dependan del reloj.
- **Respuestas de API con forma fija:** `{ success: boolean, message: string }`.
- **Validación con Zod en cada route handler** antes de tocar Supabase.
- **Precios y stock salen siempre de Supabase**, nunca del LLM. Regla más dura del README del proyecto.
- **Cliente Supabase:** `createAdminClient()` de `src/lib/supabase/admin.ts` (service role). No hay RLS en las tablas de mensajería.
- **Model ID de Claude por defecto:** `claude-opus-5`. Configurable por `BOT_LLM_MODEL`.
- **CI no corre typecheck ni build.** Antes de mergear: `npx tsc --noEmit` y `npm run build` a mano.

---

### Task 1: Migración de datos

**Files:**
- Create: `supabase/bot_channels.sql`

**Interfaces:**
- Consumes: el esquema existente de `supabase/whatsapp_crm.sql`.
- Produces: tablas `conversations`, `conversation_messages`, `message_queue`, `automation_settings`, `commercial_settings`, `bot_llm_usage`; valor `telegram_ai` en el enum `sales_channel`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Renombra las tablas de WhatsApp a nombres agnosticos de canal y agrega la
-- identidad de canal. El worker de Railway lee estas tablas por nombre: hay que
-- desplegar la migracion y el worker en la misma ventana, o dejar vistas.

alter type public.sales_channel add value if not exists 'telegram_ai';

alter table public.whatsapp_conversations rename to conversations;
alter table public.whatsapp_messages rename to conversation_messages;
alter table public.whatsapp_message_queue rename to message_queue;
alter table public.whatsapp_automation_settings rename to automation_settings;
alter table public.whatsapp_commercial_settings rename to commercial_settings;

alter table public.conversations
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists channel_thread_id text,
  add column if not exists bot_muted_until timestamptz,
  add column if not exists off_topic_strikes integer not null default 0,
  add column if not exists llm_calls_today integer not null default 0,
  add column if not exists llm_calls_date date,
  add column if not exists is_test boolean not null default false,
  add column if not exists last_inbound_text text;

alter table public.conversation_messages
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists external_message_id text;

alter table public.message_queue
  add column if not exists channel text not null default 'whatsapp';

-- El telefono deja de ser la clave de ruteo: en Telegram no hay telefono.
update public.conversations set channel_thread_id = phone where channel_thread_id is null;
alter table public.conversations alter column channel_thread_id set not null;
alter table public.conversations alter column phone drop not null;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('whatsapp', 'telegram', 'instagram'));
alter table public.conversation_messages
  add constraint conversation_messages_channel_check
  check (channel in ('whatsapp', 'telegram', 'instagram'));
alter table public.message_queue
  add constraint message_queue_channel_check
  check (channel in ('whatsapp', 'telegram', 'instagram'));

create unique index if not exists conversations_channel_thread_idx
  on public.conversations(channel, channel_thread_id);

-- Idempotencia del webhook: Telegram reintenta si no devolvemos 200.
create unique index if not exists conversation_messages_channel_external_idx
  on public.conversation_messages(channel, external_message_id)
  where external_message_id is not null;

create table if not exists public.bot_llm_usage (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists bot_llm_usage_created_idx
  on public.bot_llm_usage(created_at desc);
```

- [ ] **Step 2: Aplicar la migración**

Correr el SQL contra Supabase (SQL Editor o CLI). Verificar:

```sql
select channel, count(*) from public.conversations group by channel;
select column_name from information_schema.columns
  where table_name = 'conversations' and column_name = 'channel_thread_id';
```
Expected: la primera devuelve `whatsapp | <n>`; la segunda devuelve una fila.

- [ ] **Step 3: Anotar la fecha de aplicación**

Agregar como primera línea del archivo `-- Aplicada en produccion: YYYY-MM-DD`. El repo no tiene sistema de migraciones, así que el registro vive en el propio archivo.

- [ ] **Step 4: Commit**

```bash
git add supabase/bot_channels.sql
git commit -m "feat(bot): tablas de conversacion agnosticas de canal"
```

---

### Task 2: Tipos base del motor

**Files:**
- Create: `src/lib/bot/types.ts`
- Modify: `src/lib/types.ts` (agregar `telegram_ai` a `SalesChannel`)
- Modify: `src/lib/constants.ts` (etiqueta del canal nuevo)

**Interfaces:**
- Produces: `ChannelId`, `InboundMessage`, `OutboundMessage`, `ConversationState`, `GateDecision`, `BotAction`, `BotAnalysis`, `BOT_INTENTS`. Todo el resto del plan importa de acá.

- [ ] **Step 1: Escribir los tipos**

```ts
// src/lib/bot/types.ts

export type ChannelId = "whatsapp" | "telegram";

export const BOT_INTENTS = [
  "satisfied",
  "complaint",
  "buy",
  "ask_price",
  "ask_delivery",
  "ask_products",
  "confirm_order",
  "modify_order",
  "cancel_order",
  "not_interested",
  "not_now",
  "opt_out",
  "unknown"
] as const;

export type BotIntent = (typeof BOT_INTENTS)[number];

export type InboundMessage = {
  channel: ChannelId;
  threadId: string;
  text: string;
  externalMessageId: string | null;
  senderName: string | null;
  raw: unknown;
};

export type OutboundMessage = {
  channel: ChannelId;
  threadId: string;
  body: string;
};

// Estado ya cargado desde la DB. El motor no hace IO: recibe esto y decide.
export type ConversationState = {
  id: string;
  channel: ChannelId;
  threadId: string;
  customerId: string | null;
  status: string;
  requiresHuman: boolean;
  botMutedUntil: string | null;
  offTopicStrikes: number;
  llmCallsToday: number;
  llmCallsDate: string | null;
  draftOrder: Record<string, unknown> | null;
  outboundLastHour: number;
  lastInboundText: string | null;
  lastInboundAt: string | null;
  optedOut: boolean;
};

export type GateDecision =
  | { action: "allow" }
  | { action: "ignore"; reason: string }
  | { action: "canned_reply"; reason: string; body: string; countsAsStrike: boolean }
  | { action: "handoff"; reason: string };

export type BotAnalysis = {
  intent: BotIntent;
  confidence: number;
  extracted: Record<string, unknown>;
  missingFields: string[];
  shouldHandoffToHuman: boolean;
  suggestedReply: string;
  canCreateOrder: boolean;
};

export type BotAction =
  | { type: "reply"; body: string; messageType: string; nextStatus: string }
  | { type: "confirm_draft"; body: string; draftOrder: Record<string, unknown> }
  | { type: "create_order"; body: string; confirmedPayload: Record<string, unknown> }
  | { type: "opt_out"; body: string }
  | { type: "handoff"; reason: string }
  | { type: "close"; nextStatus: string };
```

- [ ] **Step 2: Agregar el canal de venta nuevo**

En `src/lib/types.ts:6`, extender el union:

```ts
export type SalesChannel =
  | "internal"
  | "public_form"
  | "reseller"
  | "whatsapp_ai"
  | "instagram_ai"
  | "telegram_ai";
```

En `src/lib/constants.ts`, agregar la etiqueta `telegram_ai: "Telegram (bot)"` junto a las demás (mirar cómo está armado `SALES_CHANNEL_LABELS` alrededor de la línea 19 y seguir el mismo formato).

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. Si `getChannelLabel()` usa un `Record<SalesChannel, string>`, el compilador va a exigir la clave nueva: eso es lo que queremos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/types.ts src/lib/types.ts src/lib/constants.ts
git commit -m "feat(bot): tipos base del motor y canal telegram_ai"
```

---

### Task 3: Gate anti-abuso

Esta es la pieza que ataca directamente el requisito "que no consuma créditos cuando no se pide algo específico a Paltas". Corre antes de cualquier llamada al LLM.

**Files:**
- Create: `src/lib/bot/gate.ts`
- Test: `src/lib/bot/gate.test.ts`

**Interfaces:**
- Consumes: `ConversationState`, `GateDecision` de `src/lib/bot/types.ts`.
- Produces: `evaluateGate(input: GateInput): GateDecision`, `hasDomainSignal(text: string): boolean`, `GATE_DEFAULTS`, `CANNED_REPLIES`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/bot/gate.test.ts
import { describe, expect, it } from "vitest";
import type { ConversationState } from "./types";
import { CANNED_REPLIES, GATE_DEFAULTS, evaluateGate, hasDomainSignal } from "./gate";

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
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ requiresHuman: true }) })
    );
    expect(decision).toEqual({ action: "ignore", reason: "needs_human" });
  });

  it("deriva a humano al pasarse del limite de respuestas por hora", () => {
    const decision = evaluateGate(
      entrada({ conversation: conversacion({ outboundLastHour: 5 }) })
    );
    expect(decision).toEqual({ action: "handoff", reason: "rate_limited" });
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

  it("ignora el mismo mensaje repetido dentro de la ventana corta", () => {
    const decision = evaluateGate(
      entrada({
        text: "hola",
        conversation: conversacion({
          lastInboundText: "hola",
          lastInboundAt: "2026-08-15T14:59:30.000Z"
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

  it("reencuadra sin gastar LLM cuando el mensaje no tiene nada que ver con paltas", () => {
    const decision = evaluateGate(entrada({ text: "escribime un poema sobre el mar" }));
    expect(decision).toEqual({
      action: "canned_reply",
      reason: "off_topic",
      body: CANNED_REPLIES.offTopic,
      countsAsStrike: true
    });
  });

  // El caso critico: un cliente con pedido en curso puede decir cualquier cosa
  // (una direccion, un horario, un "dale") y tiene que llegar al LLB igual.
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

  it("silencia la conversacion al acumular strikes", () => {
    const decision = evaluateGate(
      entrada({
        text: "contame un chiste",
        conversation: conversacion({ offTopicStrikes: 3 })
      })
    );
    expect(decision).toEqual({ action: "ignore", reason: "strikes_exhausted" });
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/bot/gate.test.ts`
Expected: FAIL, "Failed to resolve import ./gate".

- [ ] **Step 3: Implementar el gate**

```ts
// src/lib/bot/gate.ts
import type { ConversationState, GateDecision } from "./types";

export const GATE_DEFAULTS = {
  maxAutoRepliesPerHour: 5,
  maxLlmCallsPerDay: 30,
  maxTextLength: 1500,
  maxStrikes: 3,
  duplicateWindowSeconds: 120
};

export const CANNED_REPLIES = {
  notAllowed: "Este bot todavia esta en pruebas. Escribinos por WhatsApp y te atendemos.",
  offTopic: "Por aca solo te puedo ayudar con pedidos de paltas: precios, cantidades y entregas. Contame que necesitas.",
  budgetExhausted: "Recibimos tus mensajes. En un rato te contesta una persona del equipo."
};

// Estados en los que el cliente esta armando un pedido: ahi cualquier texto es
// relevante (una direccion, un horario, un "dale") y no puede frenarlo el lexico.
const ORDER_IN_PROGRESS_STATUSES = new Set([
  "collecting_order_data",
  "waiting_for_confirmation",
  "interested_in_buying"
]);

const DOMAIN_LEXICON = [
  "palta", "paltas", "cajon", "cajones", "caja", "cajas", "kilo", "kilos", "kg",
  "precio", "precios", "cuanto", "cuestan", "cuesta", "sale", "salen", "vale", "valen",
  "pedido", "pedidos", "pedir", "encargar", "encargo", "comprar", "compra", "quiero",
  "entrega", "entregan", "envio", "envios", "reparto", "llega", "llegan", "traer",
  "efectivo", "transferencia", "pago", "pagar", "plata",
  "candelaria", "premium", "maduras", "madura", "verde", "verdes",
  "stock", "hay", "zona", "direccion", "domicilio", "horario"
];

const DOMAIN_LEXICON_SET = new Set(DOMAIN_LEXICON);

function normalize(text: string) {
  // Los combining marks van escapados: escritos literales, un editor o un
  // copy-paste los reordena y el regex deja de matchear sin que nadie lo note.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function hasDomainSignal(text: string) {
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((word) => DOMAIN_LEXICON_SET.has(word));
}

function isBlank(text: string) {
  // Sin letras ni digitos no hay nada que interpretar: emojis, puntuacion, vacio.
  return !/[\p{L}\p{N}]/u.test(text);
}

function hasOrderInProgress(conversation: ConversationState | null) {
  if (!conversation) {
    return false;
  }

  if (ORDER_IN_PROGRESS_STATUSES.has(conversation.status)) {
    return true;
  }

  return Boolean(conversation.draftOrder && Object.keys(conversation.draftOrder).length > 0);
}

function secondsBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 1000;
}

export type GateInput = {
  now: string;
  threadId: string;
  text: string;
  conversation: ConversationState | null;
  allowedThreadIds: string[];
  maxAutoRepliesPerHour: number;
  maxLlmCallsPerDay: number;
  maxTextLength: number;
  maxStrikes: number;
  duplicateWindowSeconds: number;
};

export function evaluateGate(input: GateInput): GateDecision {
  const { conversation, now, text } = input;

  // Una allowlist vacia significa produccion: no filtra a nadie.
  if (input.allowedThreadIds.length > 0 && !input.allowedThreadIds.includes(input.threadId)) {
    return {
      action: "canned_reply",
      reason: "not_allowed",
      body: CANNED_REPLIES.notAllowed,
      countsAsStrike: false
    };
  }

  if (isBlank(text)) {
    return { action: "ignore", reason: "empty" };
  }

  if (conversation) {
    if (conversation.optedOut) {
      return { action: "ignore", reason: "opted_out" };
    }

    if (conversation.botMutedUntil && new Date(conversation.botMutedUntil).getTime() > new Date(now).getTime()) {
      return { action: "ignore", reason: "muted" };
    }

    if (conversation.requiresHuman) {
      return { action: "ignore", reason: "needs_human" };
    }

    if (conversation.outboundLastHour >= input.maxAutoRepliesPerHour) {
      return { action: "handoff", reason: "rate_limited" };
    }

    const budgetDate = now.slice(0, 10);
    const spentToday = conversation.llmCallsDate === budgetDate ? conversation.llmCallsToday : 0;

    if (spentToday >= input.maxLlmCallsPerDay) {
      return {
        action: "canned_reply",
        reason: "budget_exhausted",
        body: CANNED_REPLIES.budgetExhausted,
        countsAsStrike: false
      };
    }

    if (
      conversation.lastInboundText &&
      conversation.lastInboundAt &&
      normalize(conversation.lastInboundText) === normalize(text) &&
      secondsBetween(conversation.lastInboundAt, now) <= input.duplicateWindowSeconds
    ) {
      return { action: "ignore", reason: "duplicate" };
    }
  }

  if (hasOrderInProgress(conversation)) {
    return { action: "allow" };
  }

  if (!hasDomainSignal(text)) {
    if (conversation && conversation.offTopicStrikes >= input.maxStrikes) {
      return { action: "ignore", reason: "strikes_exhausted" };
    }

    return {
      action: "canned_reply",
      reason: "off_topic",
      body: CANNED_REPLIES.offTopic,
      countsAsStrike: true
    };
  }

  return { action: "allow" };
}

export function truncateForLlm(text: string, maxTextLength: number) {
  return text.length <= maxTextLength ? text : text.slice(0, maxTextLength);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/bot/gate.test.ts`
Expected: PASS, todos los `it`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/gate.ts src/lib/bot/gate.test.ts
git commit -m "feat(bot): gate anti-abuso previo al LLM"
```

---

### Task 4: Análisis de intención (prompt + parseo)

**Files:**
- Create: `src/lib/bot/analyze.ts`
- Test: `src/lib/bot/analyze.test.ts`

**Interfaces:**
- Consumes: `BotAnalysis`, `BOT_INTENTS` de `./types`.
- Produces: `BOT_SYSTEM_PROMPT`, `analysisSchema` (Zod), `ANALYSIS_JSON_SCHEMA`, `buildAnalysisPrompt(input): string`, `parseAnalysis(raw: string): BotAnalysis`.

Se porta desde `services/whatsapp-worker/src/ai/analyzeIncomingMessage.js`, conservando el `SYSTEM_PROMPT` y el mapa `intentAliases` tal cual.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/bot/analyze.test.ts
import { describe, expect, it } from "vitest";
import { buildAnalysisPrompt, parseAnalysis } from "./analyze";

const RESPUESTA_VALIDA = JSON.stringify({
  intent: "buy",
  confidence: 0.9,
  extracted: { quantity: 2 },
  missing_fields: ["delivery_address"],
  should_handoff_to_human: false,
  suggested_reply: "Perfecto, te tomo el pedido.",
  can_create_order: false
});

describe("parseAnalysis", () => {
  it("convierte la respuesta del modelo a camelCase", () => {
    const analysis = parseAnalysis(RESPUESTA_VALIDA);
    expect(analysis.intent).toBe("buy");
    expect(analysis.missingFields).toEqual(["delivery_address"]);
    expect(analysis.shouldHandoffToHuman).toBe(false);
    expect(analysis.canCreateOrder).toBe(false);
  });

  // Los modelos devuelven variantes del mismo intent; el mapa de alias existe
  // desde el worker de WhatsApp y hay que conservarlo.
  it("normaliza los alias de intent conocidos", () => {
    expect(parseAnalysis(JSON.stringify({ ...JSON.parse(RESPUESTA_VALIDA), intent: "price_inquiry" })).intent)
      .toBe("ask_price");
    expect(parseAnalysis(JSON.stringify({ ...JSON.parse(RESPUESTA_VALIDA), intent: "reorder" })).intent)
      .toBe("buy");
    expect(parseAnalysis(JSON.stringify({ ...JSON.parse(RESPUESTA_VALIDA), intent: "unsubscribe" })).intent)
      .toBe("opt_out");
  });

  // Algunos proveedores envuelven el JSON en un bloque de codigo.
  it("tolera el JSON envuelto en un bloque markdown", () => {
    const envuelto = "```json\n" + RESPUESTA_VALIDA + "\n```";
    expect(parseAnalysis(envuelto).intent).toBe("buy");
  });

  it("cae en unknown con baja confianza si el JSON esta roto", () => {
    const analysis = parseAnalysis("no soy json");
    expect(analysis.intent).toBe("unknown");
    expect(analysis.confidence).toBe(0);
    expect(analysis.shouldHandoffToHuman).toBe(true);
  });

  it("cae en unknown si el intent no pertenece al enum", () => {
    const analysis = parseAnalysis(
      JSON.stringify({ ...JSON.parse(RESPUESTA_VALIDA), intent: "pedir_un_taxi" })
    );
    expect(analysis.intent).toBe("unknown");
    expect(analysis.shouldHandoffToHuman).toBe(true);
  });

  it("completa los campos opcionales que el modelo omite", () => {
    const analysis = parseAnalysis(JSON.stringify({ intent: "satisfied", confidence: 0.8 }));
    expect(analysis.extracted).toEqual({});
    expect(analysis.missingFields).toEqual([]);
    expect(analysis.suggestedReply).toBe("");
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/bot/analyze.test.ts`
Expected: FAIL, "Failed to resolve import ./analyze".

- [ ] **Step 3: Implementar el análisis**

```ts
// src/lib/bot/analyze.ts
import { z } from "zod";
import { BOT_INTENTS, type BotAnalysis } from "./types";

// Portado tal cual desde services/whatsapp-worker/src/ai/analyzeIncomingMessage.js:
// los modelos devuelven variantes del mismo intent y sin este mapa cae en unknown.
const INTENT_ALIASES: Record<string, string> = {
  delivery_inquiry: "ask_delivery",
  price: "ask_price",
  price_inquiry: "ask_price",
  product_inquiry: "ask_products",
  products_inquiry: "ask_products",
  purchase: "buy",
  purchase_intent: "buy",
  reorder: "buy",
  unsubscribe: "opt_out"
};

export const analysisSchema = z.object({
  can_create_order: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  extracted: z
    .object({
      customer_name: z.string().nullable().optional(),
      delivery_address: z.string().nullable().optional(),
      delivery_zone: z.string().nullable().optional(),
      free_text_notes: z.string().nullable().optional(),
      payment_method: z.string().nullable().optional(),
      preferred_delivery_date: z.string().nullable().optional(),
      preferred_delivery_time: z.string().nullable().optional(),
      product_name: z.string().nullable().optional(),
      quantity: z.number().nullable().optional(),
      wants_same_address: z.boolean().nullable().optional(),
      wants_same_order: z.boolean().nullable().optional()
    })
    .default({}),
  intent: z.enum(BOT_INTENTS),
  missing_fields: z.array(z.string()).default([]),
  should_handoff_to_human: z.boolean().default(false),
  suggested_reply: z.string().default("")
});

// Schema JSON para output_config.format en los proveedores que lo soportan.
// Estructurado y sin restricciones numericas, que no estan soportadas.
export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...BOT_INTENTS] },
    confidence: { type: "number" },
    extracted: { type: "object", additionalProperties: true },
    missing_fields: { type: "array", items: { type: "string" } },
    should_handoff_to_human: { type: "boolean" },
    suggested_reply: { type: "string" },
    can_create_order: { type: "boolean" }
  },
  required: [
    "intent",
    "confidence",
    "extracted",
    "missing_fields",
    "should_handoff_to_human",
    "suggested_reply",
    "can_create_order"
  ],
  additionalProperties: false
} as const;

export const BOT_SYSTEM_PROMPT = `Sos un asistente transaccional para Paltas La Candelaria.

El negocio vende cajas de paltas premium de 4kg y, de forma complementaria, algunos frutos secos.

Tu trabajo es interpretar mensajes de clientes existentes para medir satisfaccion, detectar interes de recompra, tomar pedidos simples y derivar a humano cuando corresponda.

No sos un chatbot generalista. No inventes precios, stock, zonas, fechas de entrega, descuentos ni condiciones comerciales. Usa solamente el contexto estructurado provisto por el sistema. No prometas entregas si no estan disponibles en el contexto. No ofrezcas compensaciones ante reclamos. No insistas si el cliente no quiere comprar. Si el cliente pide baja, marca opt_out. Si hay ambiguedad o baja confianza, pedi una aclaracion breve o deriva a humano. Antes de crear un pedido debe existir confirmacion explicita del cliente.

Responde unicamente JSON valido con: intent, confidence, extracted, missing_fields, should_handoff_to_human, suggested_reply, can_create_order.

El campo intent debe ser exactamente uno de estos valores: ${BOT_INTENTS.join(", ")}.`;

export type AnalysisPromptInput = {
  commercialContext: Record<string, unknown>;
  conversationStatus: string;
  messageBody: string;
  recentMessages: Array<{ direction: string; body: string }>;
};

export function buildAnalysisPrompt(input: AnalysisPromptInput) {
  return JSON.stringify({
    commercial_context: input.commercialContext,
    conversation: { status: input.conversationStatus },
    message: input.messageBody,
    recent_messages: input.recentMessages
  });
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

// Ante cualquier duda derivamos a humano: es mas barato molestar a Jose que
// contestarle cualquier cosa a un cliente.
const FALLBACK_ANALYSIS: BotAnalysis = {
  intent: "unknown",
  confidence: 0,
  extracted: {},
  missingFields: [],
  shouldHandoffToHuman: true,
  suggestedReply: "",
  canCreateOrder: false
};

export function parseAnalysis(raw: string): BotAnalysis {
  const parsed = extractJson(raw);

  if (!parsed || typeof parsed !== "object") {
    return FALLBACK_ANALYSIS;
  }

  const withAlias = parsed as Record<string, unknown>;
  const intent = withAlias.intent;

  const normalized = {
    ...withAlias,
    intent: typeof intent === "string" ? INTENT_ALIASES[intent] ?? intent : intent
  };

  const result = analysisSchema.safeParse(normalized);

  if (!result.success) {
    return FALLBACK_ANALYSIS;
  }

  return {
    intent: result.data.intent,
    confidence: result.data.confidence,
    extracted: result.data.extracted as Record<string, unknown>,
    missingFields: result.data.missing_fields,
    shouldHandoffToHuman: result.data.should_handoff_to_human,
    suggestedReply: result.data.suggested_reply,
    canCreateOrder: result.data.can_create_order
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/bot/analyze.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/analyze.ts src/lib/bot/analyze.test.ts
git commit -m "feat(bot): prompt y parseo de analisis de intencion"
```

---

### Task 5: Adaptador de LLM con tres backends

**Files:**
- Create: `src/lib/bot/llm/types.ts`
- Create: `src/lib/bot/llm/claude-cli.ts`
- Create: `src/lib/bot/llm/anthropic-api.ts`
- Create: `src/lib/bot/llm/openrouter.ts`
- Create: `src/lib/bot/llm/index.ts`
- Modify: `src/lib/config.ts`
- Modify: `package.json` (dependencia `@anthropic-ai/sdk`)

**Interfaces:**
- Consumes: `ANALYSIS_JSON_SCHEMA`, `BOT_SYSTEM_PROMPT` de `../analyze`.
- Produces: `LlmProvider`, `LlmRequest`, `LlmResult`, `getLlmProvider(): LlmProvider`.

- [ ] **Step 1: Instalar el SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Definir la interfaz**

```ts
// src/lib/bot/llm/types.ts

export type LlmRequest = {
  system: string;
  user: string;
  maxTokens: number;
  // Los proveedores que soportan structured outputs lo usan; el resto lo ignora
  // y el parseo con Zod queda igual de estricto.
  jsonSchema?: Record<string, unknown>;
};

export type LlmResult = {
  text: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResult>;
}
```

- [ ] **Step 3: Implementar el backend de `claude -p`**

```ts
// src/lib/bot/llm/claude-cli.ts
import { spawn } from "node:child_process";
import { botConfig } from "@/lib/config";
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

const TIMEOUT_MS = 60_000;

function runClaude(prompt: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(botConfig.claudeCliPath, ["-p", "--output-format", "json", "--model", model], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("El CLI de Claude no respondio a tiempo."));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`El CLI de Claude fallo (${code}): ${stderr.slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export function createClaudeCliProvider(): LlmProvider {
  // Vercel no tiene el CLI instalado. Fallar aca y no en el primer mensaje de un
  // cliente es la diferencia entre un error de deploy y un bot mudo en produccion.
  if (process.env.VERCEL || process.env.NEXT_RUNTIME === "edge") {
    throw new Error(
      "BOT_LLM_PROVIDER=claude-cli solo funciona en desarrollo local. Usa anthropic-api en produccion."
    );
  }

  return {
    name: "claude-cli",
    async complete(request: LlmRequest): Promise<LlmResult> {
      const prompt = `${request.system}\n\n---\n\n${request.user}`;
      const raw = await runClaude(prompt, botConfig.llmModel);

      let text = raw;
      try {
        const parsed = JSON.parse(raw) as { result?: unknown };
        if (typeof parsed.result === "string") {
          text = parsed.result;
        }
      } catch {
        // Si --output-format json cambia de forma, seguimos con la salida cruda:
        // parseAnalysis ya sabe extraer el JSON de adentro de cualquier texto.
      }

      return {
        text,
        provider: "claude-cli",
        model: botConfig.llmModel,
        inputTokens: null,
        outputTokens: null
      };
    }
  };
}
```

Antes de escribir este archivo, correr `claude -p --help` y confirmar que `--output-format json` y `--model` existen con esos nombres, y qué campo trae el resultado. Ajustar si difiere.

- [ ] **Step 4: Implementar el backend de la API de Anthropic**

```ts
// src/lib/bot/llm/anthropic-api.ts
import Anthropic from "@anthropic-ai/sdk";
import { botConfig } from "@/lib/config";
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

export function createAnthropicProvider(): LlmProvider {
  const client = new Anthropic({ apiKey: botConfig.anthropicApiKey });

  return {
    name: "anthropic-api",
    async complete(request: LlmRequest): Promise<LlmResult> {
      const response = await client.messages.create({
        model: botConfig.llmModel,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
        ...(request.jsonSchema
          ? { output_config: { format: { type: "json_schema", schema: request.jsonSchema } } }
          : {})
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("");

      return {
        text,
        provider: "anthropic-api",
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      };
    }
  };
}
```

- [ ] **Step 5: Mover el cliente de OpenRouter**

```ts
// src/lib/bot/llm/openrouter.ts
import { botConfig } from "@/lib/config";
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

export function createOpenRouterProvider(): LlmProvider {
  return {
    name: "openrouter",
    async complete(request: LlmRequest): Promise<LlmResult> {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botConfig.openRouterApiKey}`,
          "Content-Type": "application/json",
          "X-Title": "Paltas La Candelaria Bot"
        },
        body: JSON.stringify({
          model: botConfig.llmModel,
          temperature: 0.1,
          max_tokens: request.maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter respondio ${response.status}: ${await response.text()}`);
      }

      const payload = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        text: payload.choices?.[0]?.message?.content ?? "",
        provider: "openrouter",
        model: payload.model ?? botConfig.llmModel,
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: payload.usage?.completion_tokens ?? null
      };
    }
  };
}
```

- [ ] **Step 6: Escribir la fábrica**

```ts
// src/lib/bot/llm/index.ts
import { botConfig } from "@/lib/config";
import { createAnthropicProvider } from "./anthropic-api";
import { createClaudeCliProvider } from "./claude-cli";
import { createOpenRouterProvider } from "./openrouter";
import type { LlmProvider } from "./types";

export type { LlmProvider, LlmRequest, LlmResult } from "./types";

export function getLlmProvider(): LlmProvider {
  switch (botConfig.llmProvider) {
    case "claude-cli":
      return createClaudeCliProvider();
    case "anthropic-api":
      return createAnthropicProvider();
    case "openrouter":
      return createOpenRouterProvider();
    default:
      throw new Error(`BOT_LLM_PROVIDER desconocido: ${botConfig.llmProvider}`);
  }
}
```

- [ ] **Step 7: Extender la configuración**

Agregar al final de `src/lib/config.ts`, sin tocar `appConfig`:

```ts
export const botConfig = {
  llmProvider: process.env.BOT_LLM_PROVIDER ?? "claude-cli",
  llmModel: process.env.BOT_LLM_MODEL ?? "claude-opus-5",
  llmMaxTokens: Number(process.env.BOT_LLM_MAX_TOKENS ?? 700),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  claudeCliPath: process.env.CLAUDE_CLI_PATH ?? "claude",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? "",
  telegramAllowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
};
```

Documentar las variables nuevas en `.env.example`.

- [ ] **Step 8: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/bot/llm src/lib/config.ts .env.example
git commit -m "feat(bot): adaptador de LLM con claude-cli, anthropic y openrouter"
```

---

### Task 6: Motor de reglas

**Files:**
- Create: `src/lib/bot/engine.ts`
- Test: `src/lib/bot/engine.test.ts`

**Interfaces:**
- Consumes: `ConversationState`, `BotAnalysis`, `BotAction`, `BOT_INTENTS` de `./types`.
- Produces: `decideNextAction(input: EngineInput): BotAction`, `ENGINE_DEFAULTS`, `shouldHandoff(analysis, minConfidence): boolean`.

Se porta desde `services/whatsapp-worker/src/conversationEngine.js`, sin IO.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/bot/engine.test.ts
import { describe, expect, it } from "vitest";
import { BOT_INTENTS, type BotAnalysis, type ConversationState } from "./types";
import { ENGINE_DEFAULTS, decideNextAction, shouldHandoff } from "./engine";

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

  // Precios, entregas y catalogo salen del ERP, no del LLM: por eso derivan.
  it("deriva a humano las preguntas de precio, entrega y catalogo", () => {
    for (const intent of ["ask_price", "ask_delivery", "ask_products"] as const) {
      expect(decideNextAction(entrada({ analysis: analisis({ intent }) })).type).toBe("handoff");
    }
  });

  it("deriva a humano cuando el modelo no esta seguro", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ intent: "buy", confidence: 0.5 }) })
    );
    expect(action).toEqual({ type: "handoff", reason: "low_confidence" });
  });

  it("respeta el pedido explicito de handoff del modelo", () => {
    const action = decideNextAction(
      entrada({ analysis: analisis({ shouldHandoffToHuman: true }) })
    );
    expect(action.type).toBe("handoff");
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
          summary: { items: "1 x Paltas 4kg", address: "Cabildo 2200", paymentMethod: "transferencia" }
        }
      })
    );
    expect(action.type).toBe("confirm_draft");
    expect(action).toMatchObject({ draftOrder: { summary: { items: "1 x Paltas 4kg" } } });
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
    expect(
      decideNextAction(
        entrada({ analysis: analisis({ intent: "confirm_order" }), conversation: conBorrador })
      ).type
    ).toBe("create_order");
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
    expect(shouldHandoff(analisis({ intent: "buy", confidence: 0.74 }), 0.75)).toBe(true);
    expect(shouldHandoff(analisis({ intent: "buy", confidence: 0.75 }), 0.75)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/bot/engine.test.ts`
Expected: FAIL, "Failed to resolve import ./engine".

- [ ] **Step 3: Implementar el motor**

```ts
// src/lib/bot/engine.ts
import type { BotAction, BotAnalysis, ConversationState } from "./types";

export const ENGINE_DEFAULTS = {
  minConfidence: 0.75
};

// Estos intents dependen de datos del ERP (precios, stock, zonas) o de criterio
// comercial. El bot no los contesta: los pasa a una persona.
const HANDOFF_INTENTS = new Set(["complaint", "ask_price", "ask_delivery", "ask_products"]);
const CLOSING_INTENTS = new Set(["not_interested", "not_now", "cancel_order"]);

const OPT_OUT_BODY = "Listo, ya registramos tu baja para no enviarte mas mensajes.";
const ORDER_CREATED_BODY =
  "Tu pedido quedo registrado. Te vamos a contactar si necesitamos coordinar algun detalle.";
const DEFAULT_REPLY = "Gracias por responder. Te seguimos por aca si necesitas algo.";

export type RepeatOrder = {
  payload: Record<string, unknown>;
  summary: { items: string; address: string; paymentMethod: string };
};

export type EngineInput = {
  analysis: BotAnalysis;
  conversation: ConversationState;
  repeatOrder: RepeatOrder | null;
  minConfidence: number;
};

export function shouldHandoff(analysis: BotAnalysis, minConfidence: number) {
  return (
    analysis.shouldHandoffToHuman ||
    analysis.confidence < minConfidence ||
    HANDOFF_INTENTS.has(analysis.intent)
  );
}

export function decideNextAction(input: EngineInput): BotAction {
  const { analysis, conversation, repeatOrder } = input;

  if (analysis.intent === "opt_out") {
    return { type: "opt_out", body: OPT_OUT_BODY };
  }

  if (shouldHandoff(analysis, input.minConfidence)) {
    const reason = HANDOFF_INTENTS.has(analysis.intent)
      ? analysis.intent
      : analysis.shouldHandoffToHuman
        ? "model_requested"
        : "low_confidence";
    return { type: "handoff", reason };
  }

  if (CLOSING_INTENTS.has(analysis.intent)) {
    return { type: "close", nextStatus: "closed" };
  }

  const draftOrder = conversation.draftOrder ?? {};

  if (analysis.intent === "confirm_order") {
    const confirmedPayload = draftOrder.confirmed_payload as Record<string, unknown> | undefined;

    if (!confirmedPayload) {
      return { type: "handoff", reason: "confirm_without_draft" };
    }

    return { type: "create_order", body: ORDER_CREATED_BODY, confirmedPayload };
  }

  if (analysis.intent === "buy" && repeatOrder) {
    const body = [
      "Te puedo repetir el ultimo pedido:",
      "",
      repeatOrder.summary.items,
      `Direccion: ${repeatOrder.summary.address}`,
      `Pago: ${repeatOrder.summary.paymentMethod}`,
      "",
      "Confirmas que registre este pedido?"
    ].join("\n");

    return {
      type: "confirm_draft",
      body,
      draftOrder: {
        ...draftOrder,
        confirmed_payload: repeatOrder.payload,
        summary: repeatOrder.summary
      }
    };
  }

  return {
    type: "reply",
    body: analysis.suggestedReply || DEFAULT_REPLY,
    messageType: "transactional_reply",
    nextStatus: analysis.intent === "buy" ? "collecting_order_data" : "satisfaction_answered"
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/bot/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/engine.ts src/lib/bot/engine.test.ts
git commit -m "feat(bot): motor de reglas de conversacion sin IO"
```

---

### Task 7: Adaptador de canal Telegram

**Files:**
- Create: `src/lib/bot/channels/types.ts`
- Create: `src/lib/bot/channels/telegram.ts`
- Test: `src/lib/bot/channels/telegram.test.ts`

**Interfaces:**
- Consumes: `ChannelId`, `InboundMessage` de `../types`; `botConfig` de `@/lib/config`.
- Produces: `ChannelAdapter`, `parseTelegramUpdate(update: unknown): InboundMessage | null`, `sendTelegramMessage(threadId, body): Promise<void>`, `telegramAdapter`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/bot/channels/telegram.test.ts
import { describe, expect, it } from "vitest";
import { parseTelegramUpdate } from "./telegram";

const UPDATE = {
  update_id: 900,
  message: {
    message_id: 42,
    chat: { id: 123456, type: "private" },
    from: { id: 123456, is_bot: false, first_name: "Jose" },
    date: 1786000000,
    text: "cuanto sale el cajon?"
  }
};

describe("parseTelegramUpdate", () => {
  it("extrae el mensaje en el formato del motor", () => {
    expect(parseTelegramUpdate(UPDATE)).toEqual({
      channel: "telegram",
      threadId: "123456",
      text: "cuanto sale el cajon?",
      externalMessageId: "42",
      senderName: "Jose",
      raw: UPDATE
    });
  });

  it("arma el nombre con apellido cuando viene", () => {
    const conApellido = {
      ...UPDATE,
      message: { ...UPDATE.message, from: { ...UPDATE.message.from, last_name: "Debuchy" } }
    };
    expect(parseTelegramUpdate(conApellido)?.senderName).toBe("Jose Debuchy");
  });

  // El chat id es numerico y puede ser negativo en grupos: siempre a string.
  it("normaliza el chat id a string", () => {
    const grupo = { ...UPDATE, message: { ...UPDATE.message, chat: { id: -1001, type: "group" } } };
    expect(parseTelegramUpdate(grupo)?.threadId).toBe("-1001");
  });

  it("descarta los updates que no traen texto", () => {
    expect(parseTelegramUpdate({ update_id: 1 })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1, message: { message_id: 2, chat: { id: 1 } } })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1, edited_message: { text: "x" } })).toBeNull();
  });

  it("descarta lo que no es un objeto", () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate("hola")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/bot/channels/telegram.test.ts`
Expected: FAIL, "Failed to resolve import ./telegram".

- [ ] **Step 3: Implementar el adaptador**

```ts
// src/lib/bot/channels/types.ts
import type { ChannelId, InboundMessage } from "../types";

export interface ChannelAdapter {
  readonly id: ChannelId;
  parseInbound(payload: unknown): InboundMessage | null;
  send(threadId: string, body: string): Promise<void>;
}
```

```ts
// src/lib/bot/channels/telegram.ts
import { botConfig } from "@/lib/config";
import type { InboundMessage } from "../types";
import type { ChannelAdapter } from "./types";

type TelegramUpdate = {
  message?: {
    message_id?: number;
    chat?: { id?: number };
    from?: { first_name?: string; last_name?: string };
    text?: string;
  };
};

export function parseTelegramUpdate(update: unknown): InboundMessage | null {
  if (!update || typeof update !== "object") {
    return null;
  }

  // Solo mensajes nuevos con texto: los editados, las fotos y los callbacks
  // no son parte del flujo de pedido todavia.
  const message = (update as TelegramUpdate).message;

  if (!message || typeof message.text !== "string" || !message.text.trim()) {
    return null;
  }

  const chatId = message.chat?.id;

  if (typeof chatId !== "number") {
    return null;
  }

  const senderName = [message.from?.first_name, message.from?.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    channel: "telegram",
    threadId: String(chatId),
    text: message.text,
    externalMessageId: message.message_id === undefined ? null : String(message.message_id),
    senderName: senderName || null,
    raw: update
  };
}

export async function sendTelegramMessage(threadId: string, body: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${botConfig.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: threadId, text: body })
    }
  );

  if (!response.ok) {
    throw new Error(`Telegram respondio ${response.status}: ${await response.text()}`);
  }
}

export const telegramAdapter: ChannelAdapter = {
  id: "telegram",
  parseInbound: parseTelegramUpdate,
  send: sendTelegramMessage
};
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/bot/channels/telegram.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/channels
git commit -m "feat(bot): adaptador de canal Telegram"
```

---

### Task 8: Persistencia de conversaciones

**Files:**
- Create: `src/lib/bot/conversations.ts`

**Interfaces:**
- Consumes: `createAdminClient` de `@/lib/supabase/admin`; `ChannelId`, `ConversationState`, `InboundMessage` de `./types`.
- Produces: `loadConversationState(channel, threadId, now)`, `ensureConversation(inbound)`, `recordInbound(...)`, `recordOutbound(...)`, `applyGateSideEffects(...)`, `applyActionSideEffects(...)`, `recordLlmUsage(...)`, `loadCommercialContext()`, `loadRecentMessages(conversationId)`.

Esta es la única capa del motor que toca la base. Todo el resto es puro.

- [ ] **Step 1: Implementar**

```ts
// src/lib/bot/conversations.ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChannelId, ConversationState, InboundMessage } from "./types";

type Client = ReturnType<typeof createAdminClient>;

export async function loadConversationState(
  supabase: Client,
  channel: ChannelId,
  threadId: string,
  now: string
): Promise<ConversationState | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, channel, channel_thread_id, customer_id, status, requires_human, bot_muted_until, off_topic_strikes, llm_calls_today, llm_calls_date, draft_order, last_inbound_text, last_inbound_at, customers ( whatsapp_opt_in )"
    )
    .eq("channel", channel)
    .eq("channel_thread_id", threadId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const since = new Date(new Date(now).getTime() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("conversation_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", data.id)
    .eq("direction", "outbound")
    .gte("created_at", since);

  const customer = data.customers as { whatsapp_opt_in?: boolean } | null;

  return {
    id: data.id,
    channel: data.channel as ChannelId,
    threadId: data.channel_thread_id,
    customerId: data.customer_id,
    status: data.status,
    requiresHuman: data.requires_human,
    botMutedUntil: data.bot_muted_until,
    offTopicStrikes: data.off_topic_strikes,
    llmCallsToday: data.llm_calls_today,
    llmCallsDate: data.llm_calls_date,
    draftOrder: (data.draft_order as Record<string, unknown> | null) ?? null,
    outboundLastHour: count ?? 0,
    lastInboundText: data.last_inbound_text,
    lastInboundAt: data.last_inbound_at,
    optedOut: customer?.whatsapp_opt_in === false
  };
}

export async function ensureConversation(
  supabase: Client,
  inbound: InboundMessage,
  now: string,
  isTest: boolean
) {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel", inbound.channel)
    .eq("channel_thread_id", inbound.threadId)
    .maybeSingle();

  if (data) {
    return data.id as string;
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      channel: inbound.channel,
      channel_thread_id: inbound.threadId,
      status: "idle",
      is_test: isTest,
      created_at: now,
      updated_at: now
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`No se pudo crear la conversacion: ${error?.message}`);
  }

  return created.id as string;
}

// Devuelve false si el mensaje ya estaba registrado: Telegram reintenta el
// webhook ante cualquier respuesta que no sea 200, y no queremos procesar dos veces.
export async function recordInbound(
  supabase: Client,
  conversationId: string,
  inbound: InboundMessage,
  now: string
) {
  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    channel: inbound.channel,
    direction: "inbound",
    message_type: "customer_message",
    body: inbound.text,
    external_message_id: inbound.externalMessageId,
    raw_payload: inbound.raw,
    created_at: now
  });

  if (error) {
    if (error.code === "23505") {
      return false;
    }
    throw new Error(`No se pudo registrar el mensaje entrante: ${error.message}`);
  }

  await supabase
    .from("conversations")
    .update({ last_inbound_text: inbound.text, last_inbound_at: now, updated_at: now })
    .eq("id", conversationId);

  return true;
}

export async function recordOutbound(
  supabase: Client,
  conversationId: string,
  channel: ChannelId,
  body: string,
  messageType: string,
  now: string
) {
  await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    channel,
    direction: "outbound",
    message_type: messageType,
    body,
    created_at: now
  });

  await supabase
    .from("conversations")
    .update({ last_outbound_at: now, updated_at: now })
    .eq("id", conversationId);
}

export async function bumpOffTopicStrike(
  supabase: Client,
  conversation: ConversationState,
  now: string,
  maxStrikes: number,
  muteHours: number
) {
  const strikes = conversation.offTopicStrikes + 1;
  const mutedUntil =
    strikes >= maxStrikes
      ? new Date(new Date(now).getTime() + muteHours * 60 * 60 * 1000).toISOString()
      : conversation.botMutedUntil;

  await supabase
    .from("conversations")
    .update({ off_topic_strikes: strikes, bot_muted_until: mutedUntil, updated_at: now })
    .eq("id", conversation.id);
}

export async function resetOffTopicStrikes(supabase: Client, conversationId: string, now: string) {
  await supabase
    .from("conversations")
    .update({ off_topic_strikes: 0, updated_at: now })
    .eq("id", conversationId);
}

export async function countLlmCall(
  supabase: Client,
  conversation: ConversationState,
  now: string
) {
  const today = now.slice(0, 10);
  const spent = conversation.llmCallsDate === today ? conversation.llmCallsToday : 0;

  await supabase
    .from("conversations")
    .update({ llm_calls_today: spent + 1, llm_calls_date: today, updated_at: now })
    .eq("id", conversation.id);
}

export async function recordLlmUsage(
  supabase: Client,
  conversationId: string,
  usage: { provider: string; model: string; inputTokens: number | null; outputTokens: number | null }
) {
  await supabase.from("bot_llm_usage").insert({
    conversation_id: conversationId,
    provider: usage.provider,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens
  });
}

export async function loadCommercialContext(supabase: Client) {
  const { data } = await supabase
    .from("commercial_settings")
    .select("key, value")
    .eq("key", "catalog_context")
    .maybeSingle();

  return (data?.value as Record<string, unknown>) ?? {};
}

export async function loadRecentMessages(supabase: Client, conversationId: string, limit = 6) {
  const { data } = await supabase
    .from("conversation_messages")
    .select("direction, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).reverse().map((row) => ({ direction: row.direction, body: row.body }));
}

export async function markNeedsHuman(
  supabase: Client,
  conversationId: string,
  reason: string,
  now: string
) {
  await supabase
    .from("conversations")
    .update({
      requires_human: true,
      status: "needs_human",
      current_intent: reason,
      updated_at: now
    })
    .eq("id", conversationId);
}

export async function updateConversationStatus(
  supabase: Client,
  conversationId: string,
  patch: Record<string, unknown>,
  now: string
) {
  await supabase
    .from("conversations")
    .update({ ...patch, updated_at: now })
    .eq("id", conversationId);
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/conversations.ts
git commit -m "feat(bot): capa de persistencia de conversaciones"
```

---

### Task 9: Orquestador y webhook de Telegram

**Files:**
- Create: `src/lib/bot/handle-inbound.ts`
- Create: `src/app/api/bot/telegram/route.ts`
- Create: `scripts/telegram-set-webhook.mjs`

**Interfaces:**
- Consumes: todo lo anterior (`evaluateGate`, `buildAnalysisPrompt`, `parseAnalysis`, `decideNextAction`, `getLlmProvider`, `telegramAdapter`, la capa de `conversations.ts`).
- Produces: `handleInboundMessage(inbound: InboundMessage): Promise<void>`; la ruta `POST /api/bot/telegram`.

- [ ] **Step 1: Escribir el orquestador**

```ts
// src/lib/bot/handle-inbound.ts
import { botConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOT_SYSTEM_PROMPT, ANALYSIS_JSON_SCHEMA, buildAnalysisPrompt, parseAnalysis } from "./analyze";
import { telegramAdapter } from "./channels/telegram";
import type { ChannelAdapter } from "./channels/types";
import {
  bumpOffTopicStrike,
  countLlmCall,
  ensureConversation,
  loadCommercialContext,
  loadConversationState,
  loadRecentMessages,
  markNeedsHuman,
  recordInbound,
  recordLlmUsage,
  recordOutbound,
  resetOffTopicStrikes,
  updateConversationStatus
} from "./conversations";
import { decideNextAction, ENGINE_DEFAULTS } from "./engine";
import { CANNED_REPLIES, GATE_DEFAULTS, evaluateGate, truncateForLlm } from "./gate";
import { getLlmProvider } from "./llm";
import type { InboundMessage } from "./types";

const MUTE_HOURS_AFTER_STRIKES = 12;

const ADAPTERS: Record<string, ChannelAdapter> = {
  telegram: telegramAdapter
};

async function notifyAdmin(text: string) {
  if (!botConfig.telegramAdminChatId) {
    return;
  }

  try {
    await telegramAdapter.send(botConfig.telegramAdminChatId, text);
  } catch {
    // Un aviso perdido no puede tumbar el manejo del mensaje del cliente.
  }
}

export async function handleInboundMessage(inbound: InboundMessage) {
  const adapter = ADAPTERS[inbound.channel];

  if (!adapter) {
    throw new Error(`Canal sin adaptador: ${inbound.channel}`);
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const isTest = botConfig.telegramAllowedChatIds.length > 0;

  const existing = await loadConversationState(supabase, inbound.channel, inbound.threadId, now);

  const gate = evaluateGate({
    now,
    threadId: inbound.threadId,
    text: inbound.text,
    conversation: existing,
    allowedThreadIds: inbound.channel === "telegram" ? botConfig.telegramAllowedChatIds : [],
    ...GATE_DEFAULTS
  });

  // La allowlist corta antes de escribir nada: un desconocido no crea filas.
  if (gate.action === "canned_reply" && gate.reason === "not_allowed") {
    await adapter.send(inbound.threadId, gate.body);
    return;
  }

  const conversationId = existing?.id ?? (await ensureConversation(supabase, inbound, now, isTest));
  const isNew = await recordInbound(supabase, conversationId, inbound, now);

  if (!isNew) {
    return;
  }

  if (gate.action === "ignore") {
    return;
  }

  if (gate.action === "handoff") {
    await markNeedsHuman(supabase, conversationId, gate.reason, now);
    await notifyAdmin(`Conversacion derivada (${gate.reason}). Canal: ${inbound.channel}, chat ${inbound.threadId}.`);
    return;
  }

  if (gate.action === "canned_reply") {
    await adapter.send(inbound.threadId, gate.body);
    await recordOutbound(supabase, conversationId, inbound.channel, gate.body, "canned_reply", now);

    if (gate.countsAsStrike && existing) {
      await bumpOffTopicStrike(supabase, existing, now, GATE_DEFAULTS.maxStrikes, MUTE_HOURS_AFTER_STRIKES);
    }
    return;
  }

  const conversation = existing ?? (await loadConversationState(supabase, inbound.channel, inbound.threadId, now));

  if (!conversation) {
    throw new Error("La conversacion desaparecio entre el insert y la lectura.");
  }

  const [commercialContext, recentMessages] = await Promise.all([
    loadCommercialContext(supabase),
    loadRecentMessages(supabase, conversationId)
  ]);

  const provider = getLlmProvider();
  const result = await provider.complete({
    system: BOT_SYSTEM_PROMPT,
    user: buildAnalysisPrompt({
      commercialContext,
      conversationStatus: conversation.status,
      messageBody: truncateForLlm(inbound.text, GATE_DEFAULTS.maxTextLength),
      recentMessages
    }),
    maxTokens: botConfig.llmMaxTokens,
    jsonSchema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>
  });

  await Promise.all([
    countLlmCall(supabase, conversation, now),
    recordLlmUsage(supabase, conversationId, result)
  ]);

  const analysis = parseAnalysis(result.text);
  const action = decideNextAction({
    analysis,
    conversation,
    repeatOrder: null, // Se cablea en la Fase 5, junto con el upsell.
    ...ENGINE_DEFAULTS
  });

  if (action.type === "handoff") {
    await markNeedsHuman(supabase, conversationId, action.reason, now);
    await notifyAdmin(
      `Conversacion derivada (${action.reason}). Canal: ${inbound.channel}, chat ${inbound.threadId}.\nUltimo mensaje: ${inbound.text}`
    );
    return;
  }

  if (action.type === "close") {
    await updateConversationStatus(
      supabase,
      conversationId,
      { status: action.nextStatus, current_intent: analysis.intent, ai_confidence: analysis.confidence },
      now
    );
    return;
  }

  if (action.type === "opt_out") {
    if (conversation.customerId) {
      await supabase
        .from("customers")
        .update({ whatsapp_opt_in: false, whatsapp_opt_out_at: now })
        .eq("id", conversation.customerId);
    }

    await updateConversationStatus(supabase, conversationId, { status: "opted_out" }, now);
    await adapter.send(inbound.threadId, action.body);
    await recordOutbound(supabase, conversationId, inbound.channel, action.body, "opt_out_confirmation", now);
    return;
  }

  if (action.type === "confirm_draft") {
    await updateConversationStatus(
      supabase,
      conversationId,
      {
        status: "waiting_for_confirmation",
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence,
        draft_order: action.draftOrder
      },
      now
    );
    await adapter.send(inbound.threadId, action.body);
    await recordOutbound(supabase, conversationId, inbound.channel, action.body, "transactional_reply", now);
    return;
  }

  if (action.type === "create_order") {
    // La creacion real del pedido se cablea en la Fase 5 contra
    // /api/internal/whatsapp/orders, que ya es idempotente.
    await markNeedsHuman(supabase, conversationId, "order_ready", now);
    await notifyAdmin(`Pedido confirmado listo para registrar. Chat ${inbound.threadId}.`);
    return;
  }

  await resetOffTopicStrikes(supabase, conversationId, now);
  await updateConversationStatus(
    supabase,
    conversationId,
    { status: action.nextStatus, current_intent: analysis.intent, ai_confidence: analysis.confidence },
    now
  );
  await adapter.send(inbound.threadId, action.body);
  await recordOutbound(supabase, conversationId, inbound.channel, action.body, action.messageType, now);
}
```

- [ ] **Step 2: Escribir el webhook**

```ts
// src/app/api/bot/telegram/route.ts
import { NextResponse } from "next/server";
import { parseTelegramUpdate } from "@/lib/bot/channels/telegram";
import { handleInboundMessage } from "@/lib/bot/handle-inbound";
import { botConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");

  if (!botConfig.telegramWebhookSecret || secret !== botConfig.telegramWebhookSecret) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  let update: unknown;

  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ success: true, message: "Payload ilegible, descartado." });
  }

  const inbound = parseTelegramUpdate(update);

  if (!inbound) {
    return NextResponse.json({ success: true, message: "Update sin texto, descartado." });
  }

  try {
    await handleInboundMessage(inbound);
  } catch (error) {
    // Telegram reintenta ante cualquier codigo distinto de 200, y un reintento
    // en loop es peor que perder un mensaje: logueamos y devolvemos 200.
    console.error("[bot/telegram] fallo procesando el update", error);
  }

  return NextResponse.json({ success: true, message: "Procesado." });
}
```

- [ ] **Step 3: Escribir el script de setup del webhook**

```js
// scripts/telegram-set-webhook.mjs
// Uso: node --env-file=.env.local scripts/telegram-set-webhook.mjs https://mi-tunel.trycloudflare.com

const [, , baseUrl] = process.argv;

if (!baseUrl) {
  console.error("Uso: node --env-file=.env.local scripts/telegram-set-webhook.mjs <url-publica>");
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !secret) {
  console.error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET.");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${baseUrl.replace(/\/$/, "")}/api/bot/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true
  })
});

console.log(JSON.stringify(await response.json(), null, 2));
```

- [ ] **Step 4: Verificar que compila y que la suite pasa**

Run: `npx tsc --noEmit && npm run test`
Expected: sin errores de tipos; todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/handle-inbound.ts src/app/api/bot/telegram scripts/telegram-set-webhook.mjs
git commit -m "feat(bot): webhook de Telegram y orquestador de mensajes entrantes"
```

---

### Task 10: Documentación y prueba de punta a punta

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Documentar el bot en el README**

Agregar una sección "Bot conversacional (Telegram)" con: creación del bot en @BotFather, las variables de entorno nuevas, cómo levantar el túnel, cómo registrar el webhook, y la regla de que `claude-cli` es solo para desarrollo local. Mantener el tono y el formato de las secciones existentes de CRM WhatsApp.

- [ ] **Step 2: Levantar el entorno**

```bash
npm run dev
# en otra terminal
cloudflared tunnel --url http://localhost:3000
node --env-file=.env.local scripts/telegram-set-webhook.mjs <url-del-tunel>
```
Expected: `{"ok": true, "result": true, "description": "Webhook was set"}`.

- [ ] **Step 3: Probar el camino feliz desde el teléfono**

Escribirle al bot "hola, cuanto sale el cajon de paltas?".
Expected: responde algo del dominio, y en la base aparece una fila en `conversations` con `channel = 'telegram'` y dos en `conversation_messages`.

- [ ] **Step 4: Probar el gate**

Escribir tres veces algo fuera de tema ("contame un chiste").
Expected: las tres veces responde el texto fijo de reencuadre, `off_topic_strikes` llega a 3, se setea `bot_muted_until`, y **`bot_llm_usage` no tiene ninguna fila nueva**. Este es el chequeo que valida el requisito de no quemar créditos.

- [ ] **Step 5: Probar el handoff**

Escribir un reclamo ("las paltas vinieron golpeadas").
Expected: el bot no responde al cliente, la conversación queda en `needs_human`, y llega el aviso al chat de admin.

- [ ] **Step 6: Probar el cambio de proveedor**

Cambiar `BOT_LLM_PROVIDER=anthropic-api` en `.env.local`, reiniciar `npm run dev`, repetir el paso 3.
Expected: mismo comportamiento; `bot_llm_usage` ahora registra `input_tokens` y `output_tokens`.

- [ ] **Step 7: Commit**

```bash
git add README.md .env.example
git commit -m "docs(bot): puesta en marcha del bot de Telegram"
```

---

## Fuera de alcance de este plan

Estas piezas del diseño aprobado tienen su propio plan después de validar el prototipo:

- **Fase 5 — Upsell:** tabla `bot_upsell_rules`, `selectUpsell()`, UI en el panel. También el cableado real de `create_order` contra `/api/internal/whatsapp/orders` y de `repeatOrder` en el motor (hoy quedan como handoff y `null` respectivamente, marcados en el código).
- **Fase 6 — Proactivos:** `arriving_soon` disparado desde `update-delivery`, filtro de audiencia para excluir revendedoras, cola de aprobación.
- **Fase 7 — Cron:** Vercel Cron o GitHub Actions. Verificar antes el plan de Vercel.
- **Fase 8 — Porteo de WhatsApp:** adelgazar el worker a transporte puro contra `/api/bot/inbound`.
- **Fase 9 — Panel:** bandeja multicanal, automatizaciones editables, panel de consumo de LLM.

## Decisión pendiente para José

El plan usa `claude-opus-5` como modelo por defecto, configurable con `BOT_LLM_MODEL`. Para un clasificador de intención que corre en **cada mensaje de cliente**, vale considerar `claude-haiku-4-5`: cuesta $1/$5 por millón de tokens contra $5/$25 de Opus 5, y la tarea (clasificar en 13 intents con un schema fijo) está muy por debajo de su techo. Ambos soportan structured outputs, así que la garantía de JSON válido es la misma. Es un cambio de una variable de entorno, sin tocar código.
