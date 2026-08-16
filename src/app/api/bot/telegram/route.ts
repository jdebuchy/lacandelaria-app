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

  // Solo lo manda scripts/bot-simular.mjs, que ya tuvo que pasar el secreto:
  // Telegram nunca envia este header.
  const simulated = request.headers.get("x-bot-simulate") === "1";

  try {
    await handleInboundMessage({ ...inbound, simulated });
  } catch (error) {
    // Telegram reintenta ante cualquier codigo distinto de 200, y un reintento
    // en loop es peor que perder un mensaje: logueamos y devolvemos 200.
    console.error("[bot/telegram] fallo procesando el update", error);
  }

  return NextResponse.json({ success: true, message: "Procesado." });
}
