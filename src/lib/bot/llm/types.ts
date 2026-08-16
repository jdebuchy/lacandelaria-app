export type LlmRequest = {
  system: string;
  user: string;
  maxTokens: number;
  // Los proveedores que soportan structured outputs lo usan; el resto lo ignora
  // y el parseo con Zod queda igual de estricto.
  jsonSchema?: Record<string, unknown>;
};

export type LlmResult = {
  text: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResult>;
}
