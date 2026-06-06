"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WhatsappChatComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();

    if (!trimmed) {
      return;
    }

    setFeedback(null);

    const response = await fetch(`/api/panel/crm/whatsapp/conversations/${conversationId}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed })
    });
    const result = (await response.json()) as { success: boolean; message: string };
    setFeedback(result);

    if (!response.ok || !result.success) {
      return;
    }

    setBody("");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-stone-800 bg-stone-950/95 p-3">
      {feedback && !feedback.success ? (
        <p className="mb-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {feedback.message}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={1}
          className="min-h-11 flex-1 resize-none rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-emerald-400"
          placeholder="Escribir mensaje"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-stone-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-600">
        Envía directo con el worker de WhatsApp si `whatsapp-web.js` está conectado.
      </p>
    </form>
  );
}
