import { spawn } from "node:child_process";
import { botConfig } from "@/lib/config";
import type { LlmProvider, LlmRequest, LlmResult } from "./types";

const TIMEOUT_MS = 60_000;

function runClaude(prompt: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      botConfig.claudeCliPath,
      ["-p", "--output-format", "json", "--model", model],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("El CLI de Claude no respondio a tiempo."));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`El CLI de Claude fallo (${code}): ${stderr.slice(0, 500)}`));
        return;
      }

      resolve(stdout);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export function createClaudeCliProvider(): LlmProvider {
  // Vercel no tiene el CLI instalado. Fallar al construir el proveedor, y no en
  // el primer mensaje de un cliente, es la diferencia entre un error de deploy
  // y un bot mudo en produccion.
  if (process.env.VERCEL || process.env.NEXT_RUNTIME === "edge") {
    throw new Error(
      "BOT_LLM_PROVIDER=claude-cli solo funciona en desarrollo local. Usa anthropic-api en produccion."
    );
  }

  return {
    name: "claude-cli",
    async complete(request: LlmRequest): Promise<LlmResult> {
      const prompt = `${request.system}\n\n---\n\n${request.user}`;
      const raw = await runClaude(prompt, botConfig.llmModel);

      let text = raw;

      try {
        const parsed = JSON.parse(raw) as { result?: unknown };

        if (typeof parsed.result === "string") {
          text = parsed.result;
        }
      } catch {
        // Si --output-format json cambia de forma, seguimos con la salida cruda:
        // parseAnalysis ya sabe extraer el JSON de adentro de cualquier texto.
      }

      return {
        text,
        provider: "claude-cli",
        model: botConfig.llmModel,
        inputTokens: null,
        outputTokens: null
      };
    }
  };
}
