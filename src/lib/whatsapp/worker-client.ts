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

  const response = await fetch(`${appConfig.whatsappWorkerUrl}${path}`, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(appConfig.internalApiSecret ? { "x-internal-api-secret": appConfig.internalApiSecret } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });
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
