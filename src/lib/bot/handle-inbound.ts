import { botConfig } from "@/lib/config";
import { getPlaceAutocompleteSuggestions, getPlaceDetails } from "@/lib/google-places";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ANALYSIS_JSON_SCHEMA,
  buildAnalysisPrompt,
  buildSystemPrompt,
  parseAnalysis
} from "./analyze";
import {
  EMPTY_ADDRESS_DRAFT,
  countRepetition,
  interpretAnswer,
  mergeAddress,
  pickSuggestion,
  resolveChoice,
  type AddressDraft
} from "./address";
import { deriveCapabilities } from "./capabilities";
import { createBotOrder, loadBotCatalog } from "./create-order";
import { resolveVariant } from "./order-items";
import {
  EMPTY_ORDER_DRAFT,
  buildOrderQuestion,
  estadoDelDraft,
  gapFromKey,
  gapKey,
  hydrateOrderDraft,
  interpretOrderAnswer,
  mergeOrderDraft,
  nextOrderGap,
  pareceConsulta,
  parseRetomar,
  reiniciarPedido,
  resumirConfirmado,
  sinEco,
  trajoAlgoConcreto,
  type EstadoDelDraft,
  type OrderDraft
} from "./order-draft";
import {
  avisoDePedidoCreado,
  describirDireccion,
  mensajeParaRetomar,
  resumenPedido,
  type PedidoItem
} from "./summary";
import { parseUpsellRules, selectUpsell } from "./upsell";
import { telegramAdapter } from "./channels/telegram";
import type { ChannelAdapter } from "./channels/types";
import {
  bumpOffTopicStrike,
  countLlmCall,
  ensureConversation,
  loadCommercialContext,
  loadConversationState,
  loadRecentMessages,
  loadToneGuide,
  loadUpsellRules,
  markCustomerOptOut,
  markNeedsHuman,
  recordInbound,
  recordLlmUsage,
  recordOutbound,
  resetOffTopicStrikes,
  updateConversationStatus
} from "./conversations";
import { ENGINE_DEFAULTS, decideNextAction } from "./engine";
import { esComandoDeReinicio, pidioArrancarDeNuevo } from "./text";
import { GATE_DEFAULTS, evaluateGate, truncateForLlm } from "./gate";
import { getLlmProvider } from "./llm";
import type { BotAnalysis, ConversationState, InboundMessage } from "./types";

const MUTE_HOURS_AFTER_STRIKES = 12;

const ADAPTERS: Record<string, ChannelAdapter> = {
  telegram: telegramAdapter
};

// Mantiene el "escribiendo..." vivo mientras corre el modelo, que tarda mucho mas
// que los 5 segundos que dura el indicador. Devuelve la funcion para cortarlo.
function keepTyping(adapter: ChannelAdapter, threadId: string) {
  if (!adapter.sendTyping) {
    return () => {};
  }

  const enviar = () => {
    // Si el indicador falla no pasa nada: es cosmetico y no puede tumbar el turno.
    adapter.sendTyping?.(threadId).catch(() => {});
  };

  enviar();
  const timer = setInterval(enviar, 4000);

  return () => clearInterval(timer);
}

// Resuelve la direccion contra Google solo cuando hace falta: si el cliente
// escribio algo que Places identifica sin dudas, se acepta callado. Cada consulta
// se factura, y preguntar de mas en un chat cansa.
async function aplicarLugar(draft: AddressDraft, texto: string, placeId: string): Promise<AddressDraft> {
  const detalle = await getPlaceDetails(placeId).catch(() => null);

  if (!detalle) {
    return { ...draft, texto, intentos: draft.intentos + 1 };
  }

  return {
    ...draft,
    texto,
    opciones: null,
    googlePlaceId: detalle.googlePlaceId,
    etiqueta: detalle.displayLabel,
    addressKind: detalle.suggestedAddressKind,
    gatedCommunityName: detalle.gatedCommunityName || draft.gatedCommunityName,
    // Los componentes van al pedido tal cual los normalizo Google. Guardarlos
    // aca es lo que evita que el pedido nazca en pending_review.
    addressLine1: detalle.addressLine1 || draft.addressLine1,
    locality: detalle.locality || draft.locality,
    provincia: detalle.administrativeAreaLevel1 || draft.provincia,
    codigoPostal: detalle.postalCode || draft.codigoPostal
  };
}

async function resolverDireccion(draft: AddressDraft, texto: string): Promise<AddressDraft> {
  const sugerencias = await getPlaceAutocompleteSuggestions(texto).catch(() => []);
  const elegida = pickSuggestion(texto, sugerencias);

  if (elegida.tipo === "clara") {
    return aplicarLugar(draft, texto, elegida.sugerencia.placeId);
  }

  // Guardar las opciones para poder mostrarlas y resolver la eleccion despues.
  // Antes se le pedia al cliente que repitiera la direccion, y repetir lo mismo
  // da lo mismo: el bucle estaba garantizado.
  return {
    ...draft,
    texto,
    intentos: draft.intentos + 1,
    opciones: elegida.tipo === "ambigua" ? elegida.opciones : null
  };
}

// El aviso lo lee una persona en el telefono, no un log: motivo en castellano,
// sin ids crudos ni payloads. Lo que hace falta para decidir si abrir el panel.
const MOTIVOS: Record<string, string> = {
  complaint: "un reclamo",
  ask_price: "una consulta de precios",
  ask_delivery: "una consulta de entrega",
  ask_products: "una consulta de catalogo",
  low_confidence: "un mensaje que no entendio",
  model_requested: "un caso que prefiere no resolver solo",
  rate_limited: "demasiados mensajes seguidos",
  confirm_without_draft: "una confirmacion sin pedido armado",
  order_ready: "un pedido listo para cargar",
  order_failed: "un pedido confirmado que no se pudo cargar",
  falta_cantidad: "un pedido sin cantidad, despues de preguntarla dos veces",
  falta_direccion: "un pedido sin direccion, despues de preguntarla dos veces"
};

// Lo unico que ve el cliente al derivar. Sin motivos ni jerga interna: saber que
// el bot "no entendio" o que hubo "demasiados mensajes" no le sirve de nada y
// suena a maquina rota. Solo necesita saber que alguien lo va a atender.
const DESPEDIDA_HANDOFF = "Dale, ya le paso tu mensaje al equipo y te contactan en un rato";

async function avisarAlCliente(
  supabase: ReturnType<typeof createAdminClient>,
  adapter: ChannelAdapter,
  inbound: InboundMessage,
  conversationId: string,
  now: string
) {
  await adapter.send(inbound.threadId, DESPEDIDA_HANDOFF);
  await recordOutbound(
    supabase,
    conversationId,
    inbound.channel,
    DESPEDIDA_HANDOFF,
    "human_handoff",
    now
  );
}

function avisoDeHandoff(motivo: string, quien: string | null, ultimoMensaje: string) {
  const razon = MOTIVOS[motivo] ?? "algo que no pudo resolver";
  const nombre = quien ? ` de ${quien}` : "";

  return `Cande te paso una conversacion${nombre}: ${razon}.\n\n"${ultimoMensaje.slice(0, 140)}"`;
}

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

type AvanceDePedido = {
  supabase: ReturnType<typeof createAdminClient>;
  adapter: ChannelAdapter;
  inbound: InboundMessage;
  conversationId: string;
  conversation: ConversationState;
  analysis: BotAnalysis;
  pedido: OrderDraft;
  draftPrevio: AddressDraft;
  estado: EstadoDelDraft;
  // El cliente pidio arrancar de nuevo. Se le dice que lo escuchamos antes de la
  // pregunta que sigue: si no, parece que el mensaje se perdio.
  reinicio: boolean;
  isTest: boolean;
  now: string;
};

// Lleva el pedido de un dato al siguiente y lo cierra. Devuelve true cuando ya
// contesto: ahi el motor no corre, porque la pregunta concreta que falta le gana
// a cualquier respuesta que redacte el modelo.
async function avanzarPedido(entrada: AvanceDePedido): Promise<boolean> {
  const { supabase, adapter, inbound, conversationId, conversation, analysis, draftPrevio, now } =
    entrada;

  const [{ variantes, variantePorDefecto }, reglasCrudas] = await Promise.all([
    loadBotCatalog(supabase),
    loadUpsellRules(supabase)
  ]);

  const resolucion = resolveVariant(entrada.pedido.producto, variantes, variantePorDefecto);
  const principal =
    resolucion.tipo === "unica"
      ? resolucion.variante
      : variantes.find((variante) => variante.id === variantePorDefecto) ?? null;

  // Sin catalogo no hay pedido posible. Contesta el modelo y despues deriva: es
  // preferible a preguntar cantidades de algo que no se puede cargar.
  if (!principal) {
    return false;
  }

  const upsell = selectUpsell(parseUpsellRules(reglasCrudas), entrada.pedido, variantes, [principal.id]);
  const gap = nextOrderGap(entrada.pedido, {
    upsellDisponible: Boolean(upsell),
    estado: entrada.estado
  });

  const items: PedidoItem[] = [];

  if (entrada.pedido.cantidad) {
    items.push({ variante: principal, cantidad: entrada.pedido.cantidad });
  }

  if (entrada.pedido.upsellAceptado && entrada.pedido.upsellVariantId) {
    const extra = variantes.find((variante) => variante.id === entrada.pedido.upsellVariantId);

    if (extra) {
      items.push({ variante: extra, cantidad: 1 });
    }
  }

  if (!gap) {
    const resultado = await createBotOrder(
      supabase,
      {
        conversationId,
        customerId: conversation.customerId,
        channel: inbound.channel,
        threadId: inbound.threadId,
        senderName: inbound.senderName,
        draft: entrada.pedido,
        items,
        isTest: entrada.isTest
      },
      now
    );

    if (resultado.tipo === "error") {
      // El cliente ya confirmo: perder el pedido aca seria lo peor que puede
      // pasar en toda la conversacion. Lo levanta una persona.
      await markNeedsHuman(supabase, conversationId, "order_failed", now);
      await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
      await notifyAdmin(
        `Cande no pudo cargar un pedido confirmado${inbound.senderName ? ` de ${inbound.senderName}` : ""}: ${resultado.motivo}`
      );

      return true;
    }

    const aviso = avisoDePedidoCreado(resultado.orderNumber, entrada.pedido.nombre);

    await adapter.send(inbound.threadId, aviso);
    await recordOutbound(supabase, conversationId, inbound.channel, aviso, "transactional_reply", now);

    if (resultado.tipo === "creado") {
      await notifyAdmin(
        `Pedido #${resultado.orderNumber ?? "?"} cargado por Cande: ${describirDireccion(entrada.pedido)}.`
      );
    }

    return true;
  }

  if (gap.tipo === "bloqueado") {
    await markNeedsHuman(supabase, conversationId, `falta_${gap.falta}`, now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff(`falta_${gap.falta}`, inbound.senderName, inbound.text));

    return true;
  }

  let pedido = entrada.pedido;
  let texto: string;

  if (gap.tipo === "retomar" && entrada.estado !== "activo" && entrada.estado !== "vacio") {
    texto = mensajeParaRetomar(pedido, entrada.estado);
    pedido = { ...pedido, retomarDesde: entrada.estado };
  } else if (gap.tipo === "upsell" && upsell) {
    texto = upsell.mensaje;
    pedido = { ...pedido, upsellOfrecido: true, upsellVariantId: upsell.variante.id };
  } else if (gap.tipo === "confirmacion") {
    texto = resumenPedido(items, pedido);
  } else {
    texto = buildOrderQuestion(gap, pedido);
  }

  if (!texto) {
    return false;
  }

  if (entrada.reinicio) {
    texto = `Dale, arrancamos de nuevo. ${texto}`;
  }

  const clave = gapKey(gap);

  await updateConversationStatus(
    supabase,
    conversationId,
    {
      status: "collecting_order_data",
      current_intent: analysis.intent,
      ai_confidence: analysis.confidence,
      draft_order: {
        ...(conversation.draftOrder ?? {}),
        ...pedido,
        ultimaPregunta: clave,
        // La pregunta que retoma no refresca la fecha del pedido en curso: la
        // refresca igual porque el cliente esta hablando ahora, y si vuelve a
        // desaparecer el draft vuelve a envejecer desde este momento.
        actualizadoEn: now,
        // El contador vive por pregunta: sin esto, dos preguntas distintas
        // comparten el corte y el bot se rinde antes de tiempo.
        repeticiones: entrada.pedido.ultimaPregunta === clave ? entrada.pedido.repeticiones + 1 : 0,
        // Cuando la pregunta del momento no es de direccion, la ultima pregunta
        // de direccion queda como estaba. Borrarla parecia prolijo y era el bug
        // que hacia volver "es casa o departamento?" para siempre: sin ella se
        // pierde la cuenta de repeticiones y el corte deja de aplicar.
        direccion:
          gap.tipo === "direccion"
            ? {
                ...pedido.direccion,
                ultimaPregunta: gap.gap,
                repeticiones: countRepetition(draftPrevio, gap.gap)
              }
            : pedido.direccion
      }
    },
    now
  );

  await adapter.send(inbound.threadId, texto);
  await recordOutbound(supabase, conversationId, inbound.channel, texto, "transactional_reply", now);

  return true;
}

export async function handleInboundMessage(inbound: InboundMessage) {
  const real = ADAPTERS[inbound.channel];

  if (!real) {
    throw new Error(`Canal sin adaptador: ${inbound.channel}`);
  }

  // En simulacion se reemplaza solo el envio: el resto del flujo corre igual y
  // todo queda registrado, asi la prueba mide lo mismo que una conversacion real.
  const adapter: ChannelAdapter = inbound.simulated
    ? { ...real, send: async () => {}, sendTyping: async () => {} }
    : real;

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const isTest = botConfig.telegramAllowedChatIds.length > 0;

  const existing = await loadConversationState(supabase, inbound.channel, inbound.threadId, now);

  const gate = evaluateGate({
    now,
    threadId: inbound.threadId,
    text: inbound.text,
    conversation: existing,
    // La simulacion usa su propio thread, que no esta en la allowlist. Llega
    // hasta aca solo con el secreto del webhook, asi que no abre ninguna puerta.
    allowedThreadIds:
      inbound.channel === "telegram" && !inbound.simulated ? botConfig.telegramAllowedChatIds : [],
    ...GATE_DEFAULTS
  });

  // La allowlist corta antes de escribir nada: un desconocido no deja rastro
  // en la base ni consume presupuesto.
  if (gate.action === "canned_reply" && gate.reason === "not_allowed") {
    // Se loguea el id porque es la unica forma de saber a quien sumar a la
    // allowlist: el bloqueo pasa antes de crear la conversacion, asi que en la
    // base no queda nada. Sin esto hay que ir a buscarlo a un bot de terceros.
    console.warn(
      `[bot] chat fuera de la allowlist: ${inbound.threadId}${inbound.senderName ? ` (${inbound.senderName})` : ""}`
    );

    await adapter.send(inbound.threadId, gate.body);
    return;
  }

  const conversationId = existing?.id ?? (await ensureConversation(supabase, inbound, now, isTest));
  const isNew = await recordInbound(supabase, conversationId, inbound, now);

  if (!isNew) {
    return;
  }

  // Corre antes de mirar la decision del gate a proposito: el comando sirve
  // justo cuando la conversacion quedo trabada, que es cuando el gate la esta
  // ignorando por silenciada o derivada a una persona.
  if (isTest && esComandoDeReinicio(inbound.text)) {
    await updateConversationStatus(
      supabase,
      conversationId,
      {
        status: "idle",
        draft_order: {},
        requires_human: false,
        current_intent: null,
        off_topic_strikes: 0,
        bot_muted_until: null
      },
      now
    );

    const listo = "Listo, arrancamos de cero. Contame qué necesitás";

    await adapter.send(inbound.threadId, listo);
    await recordOutbound(supabase, conversationId, inbound.channel, listo, "canned_reply", now);

    return;
  }

  if (gate.action === "ignore") {
    return;
  }

  if (gate.action === "handoff") {
    await markNeedsHuman(supabase, conversationId, gate.reason, now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff(gate.reason, inbound.senderName, inbound.text));
    return;
  }

  if (gate.action === "canned_reply") {
    await adapter.send(inbound.threadId, gate.body);
    await recordOutbound(supabase, conversationId, inbound.channel, gate.body, "canned_reply", now);

    // Cuando el saludo termino ofreciendo el pedido viejo, hay que dejar anotado
    // que se pregunto: si no, la respuesta del cliente llega sin contexto y el
    // "dale" se pierde.
    const draftDelSaludo = hydrateOrderDraft(existing?.draftOrder);

    if (gate.reason === "greeting" && estadoDelDraft(draftDelSaludo, now) === "sugerencia") {
      await updateConversationStatus(
        supabase,
        conversationId,
        {
          draft_order: {
            ...(existing?.draftOrder ?? {}),
            ultimaPregunta: "retomar",
            retomarDesde: "sugerencia",
            actualizadoEn: now
          }
        },
        now
      );
    }

    if (gate.countsAsStrike && existing) {
      await bumpOffTopicStrike(
        supabase,
        existing,
        now,
        GATE_DEFAULTS.maxStrikes,
        MUTE_HOURS_AFTER_STRIKES
      );
    }

    return;
  }

  const conversation =
    existing ?? (await loadConversationState(supabase, inbound.channel, inbound.threadId, now));

  if (!conversation) {
    throw new Error("La conversacion desaparecio entre el insert y la lectura.");
  }

  const [commercialContext, recentMessages, toneGuide] = await Promise.all([
    loadCommercialContext(supabase),
    loadRecentMessages(supabase, conversationId),
    loadToneGuide(supabase)
  ]);

  // Lo que ya se sabe del pedido. Va al prompt para que el modelo no vuelva a
  // pedir lo que el cliente ya dijo.
  const guardado = hydrateOrderDraft(conversation.draftOrder);

  // Cuanta autoridad tiene lo guardado. Un pedido de hace tres horas todavia es
  // el pedido en curso; uno de ayer es una sugerencia.
  const estadoGuardado = estadoDelDraft(guardado, now);

  const provider = getLlmProvider();
  const dejarDeEscribir = keepTyping(adapter, inbound.threadId);

  let result;

  try {
    result = await provider.complete({
      system: buildSystemPrompt(toneGuide),
      user: buildAnalysisPrompt({
        commercialContext,
        conversationStatus: conversation.status,
        messageBody: truncateForLlm(inbound.text, GATE_DEFAULTS.maxTextLength),
        recentMessages,
        // Un pedido que ya es sugerencia no se le pasa al modelo como confirmado:
        // si lo lee como cerrado, deja de pedir lo que falta y da por hecha una
        // direccion de ayer.
        confirmado: estadoGuardado === "sugerencia" ? null : resumirConfirmado(guardado)
      }),
      maxTokens: botConfig.llmMaxTokens,
      jsonSchema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>
    });
  } finally {
    dejarDeEscribir();
  }

  await Promise.all([
    countLlmCall(supabase, conversation, now),
    recordLlmUsage(supabase, conversationId, result)
  ]);

  const analysis = parseAnalysis(result.text);

  // Recoleccion del pedido. Corre antes del motor: si hay un dato pendiente, la
  // pregunta por ese dato le gana a la respuesta generica del modelo, que tiende
  // a pedir todo junto y a volver a pedir lo que el cliente ya dijo.
  const gapPrevio = gapFromKey(guardado.ultimaPregunta);

  // Si el cliente ya dijo lo que quiere, sacarle un pedido de anteayer es
  // hablarle de otra cosa.
  const trajoDatos = trajoAlgoConcreto(analysis.extracted, guardado);

  // De donde arranca este mensaje. Lo normal es seguir con lo guardado; cambia
  // cuando el pedido viejo dejo de tener autoridad.
  let base = guardado;
  let respondioRetomar = false;

  // "arranquemos de nuevo" vale en cualquier momento, no solo como respuesta a la
  // pregunta de retomar. Es lo que diria una persona, y ademas es la unica forma
  // que tiene el cliente de destrabar una charla que se le fue de las manos.
  const pidioReinicio = pidioArrancarDeNuevo(inbound.text);

  if (pidioReinicio) {
    base = reiniciarPedido(guardado, { conservarDireccion: true });
  } else if (gapPrevio?.tipo === "retomar") {
    respondioRetomar = true;
    const respuesta = parseRetomar(inbound.text);

    if (guardado.retomarDesde === "sugerencia" && respuesta !== "seguir") {
      // Una oferta que no se acepta es una oferta rechazada. Si le ofrecimos el
      // pedido de ayer y contesta cualquier otra cosa, ese pedido no queda
      // flotando esperando pegarse al que venga.
      base = reiniciarPedido(guardado, { conservarDireccion: false });
    } else if (respuesta === "de_cero") {
      // Arrancar de nuevo en la misma charla no borra la direccion: la dio hace
      // minutos y sigue siendo la de hoy.
      base = reiniciarPedido(guardado, { conservarDireccion: true });
    }

    base = { ...base, retomarDesde: null };
  } else if (estadoGuardado === "sugerencia" && trajoDatos) {
    base = reiniciarPedido(guardado, { conservarDireccion: false });
  }

  // Solo se nombra el hueco si el cliente no vino ya diciendo lo que quiere.
  const estado: EstadoDelDraft =
    respondioRetomar || trajoDatos || pidioReinicio ? "activo" : estadoGuardado;

  const draftPrevio = base.direccion;

  // Cuando se descarto el pedido viejo hay que descartar tambien su eco: el
  // modelo repite en "extracted" todo dato que haya aparecido en la conversacion,
  // asi que sin esto el reinicio se deshace solo en el mismo mensaje.
  const extraido = base === guardado ? analysis.extracted : sinEco(analysis.extracted, guardado);

  // Dos fuentes por mensaje: lo que el modelo extrajo, y la respuesta a lo ultimo
  // que se pregunto. La segunda hace falta porque un "efectivo" suelto solo
  // significa algo si veniamos de preguntar como paga.
  const conExtraido = mergeOrderDraft(base, extraido);
  let pedido: OrderDraft =
    gapPrevio && gapPrevio.tipo !== "direccion"
      ? { ...conExtraido, ...interpretOrderAnswer(gapPrevio, inbound.text) }
      : conExtraido;

  const dicha = typeof extraido.delivery_address === "string" ? extraido.delivery_address : null;

  // La respuesta a la pregunta de direccion se interpreta con su propio modulo:
  // un "departamento" suelto solo tiene sentido con esa referencia. Manda la
  // ultima pregunta del pedido, no la de la direccion: esa ultima sobrevive para
  // llevar la cuenta de repeticiones aunque la pregunta del momento sea otra, y
  // usarla aca hacia que un "4B" contestando el telefono entrara como piso.
  const gapDireccion = gapPrevio?.tipo === "direccion" ? gapPrevio.gap : null;

  const conRespuesta: AddressDraft = gapDireccion
    ? { ...draftPrevio, ...interpretAnswer(gapDireccion, inbound.text) }
    : draftPrevio;

  // Si se le ofrecieron opciones de Google, este mensaje puede ser la eleccion.
  const elegida =
    gapDireccion === "confirmar_calle" && draftPrevio.opciones?.length
      ? resolveChoice(inbound.text, draftPrevio.opciones)
      : null;

  let direccion: AddressDraft;

  if (elegida) {
    direccion = await aplicarLugar(conRespuesta, elegida.fullText, elegida.placeId);
  } else {
    // mergeAddress decide si el texto nuevo merece reemplazar al anterior. Sin ese
    // filtro, un "4B" suelto entraba como direccion y el modelo lo completaba con
    // una calle inventada.
    const conDireccion = mergeAddress(conRespuesta, dicha);

    direccion = conDireccion;

    if (conDireccion.texto && conDireccion.texto !== draftPrevio.texto) {
      // La zona va en un campo aparte, pero Google la necesita en la misma
      // consulta: "Libertador 2809" solo es ambiguo de verdad, hay una calle
      // Libertador en media provincia. Con la localidad, deja de serlo.
      const zona = typeof extraido.delivery_zone === "string" ? extraido.delivery_zone.trim() : "";
      const consulta = zona && !conDireccion.texto.toLowerCase().includes(zona.toLowerCase())
        ? `${conDireccion.texto}, ${zona}`
        : conDireccion.texto;

      direccion = await resolverDireccion(conDireccion, consulta);
    }
  }

  pedido = { ...pedido, direccion };

  // Un pedido ya creado cierra el hilo: sin esto, cualquier mensaje posterior
  // vuelve a entrar al flujo y el cliente recibe otra vez "te lo anote".
  const pedidoYaCreado = Boolean(guardado.createdOrderId);

  // Una pregunta en medio del pedido se contesta. Sin esto, un "cuanto sale la
  // chica?" recibia como respuesta la siguiente pregunta del formulario, que es
  // exactamente lo que hace que un bot se note.
  const consultaEnMedio =
    pareceConsulta(inbound.text) &&
    (analysis.intent === "ask_price" ||
      analysis.intent === "ask_delivery" ||
      analysis.intent === "ask_products");

  // El flujo solo toma el control cuando esto es un pedido. Si no, un "hasta
  // donde llegan?" recibiria un "cuantas cajas queres?" como respuesta.
  const enPedido =
    !pedidoYaCreado &&
    !consultaEnMedio &&
    (analysis.intent === "buy" ||
      analysis.intent === "confirm_order" ||
      conversation.status === "collecting_order_data" ||
      pedido.cantidad !== null ||
      Boolean(pedido.direccion.texto));

  if (enPedido) {
    const cerrado = await avanzarPedido({
      supabase,
      adapter,
      inbound,
      conversationId,
      conversation,
      analysis,
      pedido,
      draftPrevio,
      estado,
      reinicio: pidioReinicio,
      isTest,
      now
    });

    if (cerrado) {
      return;
    }
  } else if (pedido !== guardado) {
    // Fuera del flujo igual hay que guardar lo que se extrajo, y soltar la ultima
    // pregunta: si no, el proximo mensaje se sigue leyendo como respuesta a ella.
    //
    // Salvo cuando lo que hubo fue una consulta en medio del pedido. Ahi la
    // pregunta sigue pendiente: le contestamos lo que nos preguntaron y despues
    // el cliente contesta lo nuestro. Borrarla hacia que un "depto" despues de
    // "hacen envios a Salta?" se leyera como si nadie hubiera preguntado nada.
    const pendiente = consultaEnMedio ? guardado.ultimaPregunta : null;

    await updateConversationStatus(
      supabase,
      conversationId,
      {
        draft_order: {
          ...(conversation.draftOrder ?? {}),
          ...pedido,
          ultimaPregunta: pendiente,
          actualizadoEn: now,
          direccion: {
            ...direccion,
            ultimaPregunta: consultaEnMedio ? direccion.ultimaPregunta : null
          }
        }
      },
      now
    );
  }

  const action = decideNextAction({
    analysis,
    conversation,
    // El pedido repetido llega mas adelante: la creacion desde cero la resuelve
    // avanzarPedido, que no necesita el motor.
    repeatOrder: null,
    capabilities: deriveCapabilities(commercialContext),
    ...ENGINE_DEFAULTS
  });

  if (action.type === "handoff") {
    await markNeedsHuman(supabase, conversationId, action.reason, now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff(action.reason, inbound.senderName, inbound.text));
    return;
  }

  if (action.type === "close") {
    await updateConversationStatus(
      supabase,
      conversationId,
      {
        status: action.nextStatus,
        current_intent: analysis.intent,
        ai_confidence: analysis.confidence
      },
      now
    );
    return;
  }

  if (action.type === "opt_out") {
    if (conversation.customerId) {
      await markCustomerOptOut(supabase, conversation.customerId, now);
    }

    await updateConversationStatus(supabase, conversationId, { status: "opted_out" }, now);
    await adapter.send(inbound.threadId, action.body);
    await recordOutbound(
      supabase,
      conversationId,
      inbound.channel,
      action.body,
      "opt_out_confirmation",
      now
    );
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
    await recordOutbound(
      supabase,
      conversationId,
      inbound.channel,
      action.body,
      "transactional_reply",
      now
    );
    return;
  }

  if (action.type === "create_order") {
    // La creacion real contra /api/internal/whatsapp/orders llega en la Fase 5.
    // Hasta entonces derivamos a una persona en vez de perder el pedido.
    await markNeedsHuman(supabase, conversationId, "order_ready", now);
    await avisarAlCliente(supabase, adapter, inbound, conversationId, now);
    await notifyAdmin(avisoDeHandoff("order_ready", inbound.senderName, inbound.text));
    return;
  }

  await resetOffTopicStrikes(supabase, conversationId, now);
  await updateConversationStatus(
    supabase,
    conversationId,
    {
      status: action.nextStatus,
      current_intent: analysis.intent,
      ai_confidence: analysis.confidence
    },
    now
  );
  await adapter.send(inbound.threadId, action.body);
  await recordOutbound(
    supabase,
    conversationId,
    inbound.channel,
    action.body,
    action.messageType,
    now
  );
}

