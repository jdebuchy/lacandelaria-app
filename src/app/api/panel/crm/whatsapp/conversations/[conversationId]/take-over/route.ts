import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { callWhatsappWorker } from "@/lib/whatsapp/worker-client";

type Params = Promise<{ conversationId: string }>;

export async function POST(_: Request, context: { params: Params }) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const { conversationId } = await context.params;
  const result = await callWhatsappWorker(`/admin/conversations/${conversationId}/take-over`);

  return NextResponse.json(result.payload, { status: result.status });
}
