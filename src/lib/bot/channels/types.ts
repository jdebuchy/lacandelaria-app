import type { ChannelId, InboundMessage } from "../types";

export interface ChannelAdapter {
  readonly id: ChannelId;
  parseInbound(payload: unknown): InboundMessage | null;
  send(threadId: string, body: string): Promise<void>;
  // Opcional: no todos los canales tienen indicador de escritura. Donde existe,
  // es lo unico que separa "esta pensando" de "se colgo" mientras corre el modelo.
  sendTyping?(threadId: string): Promise<void>;
}
