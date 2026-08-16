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

  // Solo mensajes nuevos con texto. Los editados llegan como edited_message y
  // procesarlos duplicaria el turno; las fotos y los callbacks todavia no
  // forman parte del flujo de pedido.
  const message = (update as TelegramUpdate).message;

  if (!message || typeof message.text !== "string" || !message.text.trim()) {
    return null;
  }

  const chatId = message.chat?.id;

  if (typeof chatId !== "number") {
    return null;
  }

  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ");

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
  if (!botConfig.telegramBotToken) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN para enviar mensajes.");
  }

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

// Telegram muestra "escribiendo..." unos 5 segundos, o hasta que llegue un
// mensaje. Con el modelo tardando mas que eso, hay que refrescarlo.
export async function sendTelegramTyping(threadId: string) {
  if (!botConfig.telegramBotToken) {
    return;
  }

  await fetch(`https://api.telegram.org/bot${botConfig.telegramBotToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: threadId, action: "typing" })
  });
}

export const telegramAdapter: ChannelAdapter = {
  id: "telegram",
  parseInbound: parseTelegramUpdate,
  send: sendTelegramMessage,
  sendTyping: sendTelegramTyping
};
