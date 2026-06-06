import { appConfig } from "@/lib/config";

type WorkerRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST";
};

export async function callWhatsappWorker(path: string, options: WorkerRequestOptions = {}) {
  if (!appConfig.whatsappWorkerUrl) {
    return {
      ok: false,
      status: 400,
      payload: {
        success: false,
        message: "WHATSAPP_WORKER_URL no está configurado."
      }
    };
  }

  const workerUrl = appConfig.whatsappWorkerUrl.startsWith("http")
    ? appConfig.whatsappWorkerUrl
    : `https://${appConfig.whatsappWorkerUrl}`;
  const url = new URL(path, workerUrl);

  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(appConfig.internalApiSecret ? { "x-internal-api-secret": appConfig.internalApiSecret } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: {
        success: false,
        message: error instanceof Error ? error.message : "No se pudo conectar con el worker de WhatsApp."
      }
    };
  }

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { success: response.ok, message: text || response.statusText };
  }

  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}
