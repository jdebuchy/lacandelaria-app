import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { callWhatsappWorker } from "@/lib/whatsapp/worker-client";

type Params = Promise<{ conversationId: string }>;

const sendMessageSchema = z.object({
  body: z.string().min(1).max(2000)
});

export async function POST(request: Request, context: { params: Params }) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const parsed = sendMessageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Mensaje inválido." },
      { status: 400 }
    );
  }

  const { conversationId } = await context.params;
  const result = await callWhatsappWorker(`/admin/conversations/${conversationId}/send-message`, {
    body: parsed.data
  });

  return NextResponse.json(result.payload, { status: result.status });
}
