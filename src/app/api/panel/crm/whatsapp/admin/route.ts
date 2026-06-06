import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { callWhatsappWorker } from "@/lib/whatsapp/worker-client";

const adminActionSchema = z.object({
  action: z.enum(["build-daily-queue", "process-queue", "queue-summary"])
});

const pathByAction = {
  "build-daily-queue": "/admin/build-daily-queue",
  "process-queue": "/admin/process-queue",
  "queue-summary": "/admin/queue-summary"
} satisfies Record<z.infer<typeof adminActionSchema>["action"], string>;

export async function POST(request: Request) {
  const authResult = await requireApiRole(PANEL_ALLOWED_ROLES);

  if ("error" in authResult) {
    return authResult.error;
  }

  const parsed = adminActionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Acción inválida." },
      { status: 400 }
    );
  }

  const result = await callWhatsappWorker(pathByAction[parsed.data.action]);

  return NextResponse.json(result.payload, { status: result.status });
}
