import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import { config } from "./config.js";

const { Client, LocalAuth } = pkg;

let client = null;
let ready = false;

export function getWhatsappStatus() {
  return {
    ready,
    initialized: Boolean(client)
  };
}

export function getWhatsappClient() {
  if (!client) {
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: config.whatsappSessionPath
      }),
      puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      }
    });

    client.on("qr", (qr) => {
      console.log("WhatsApp QR received. Scan it from the linked device flow.");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", () => {
      ready = true;
      console.log("WhatsApp client ready.");
    });

    client.on("disconnected", (reason) => {
      ready = false;
      console.warn("WhatsApp client disconnected.", reason);
    });
  }

  return client;
}

export async function initializeWhatsappClient(onIncomingMessage) {
  const whatsappClient = getWhatsappClient();

  whatsappClient.on("message", onIncomingMessage);
  await whatsappClient.initialize();

  return whatsappClient;
}

export async function sendWhatsappMessage(chatId, body) {
  if (!ready) {
    throw new Error("WhatsApp client is not ready.");
  }

  return getWhatsappClient().sendMessage(chatId, body);
}
