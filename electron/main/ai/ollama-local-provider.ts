export type LocalChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LocalChatEvent =
  | { type: "delta"; text: string }
  | { type: "done"; inputTokens?: number; outputTokens?: number }
  | { type: "error"; code: string; message: string };

const ALLOWED_MODELS = new Set(["qwen2.5:7b"]);

function localOllamaUrl() {
  const candidate = new URL(process.env.JVERSE_OLLAMA_URL ?? "http://127.0.0.1:11434");
  if ((candidate.protocol !== "http:" && candidate.protocol !== "https:")
    || (candidate.hostname !== "127.0.0.1" && candidate.hostname !== "localhost")) {
    throw new Error("Ollama endpoint must be localhost-only.");
  }
  return candidate;
}

/**
 * Main-process-only adapter. Do not expose this class via contextBridge or
 * renderer IPC. The paired control-plane bridge owns authorization, memory,
 * RAG context, and prompt construction before it calls this provider.
 */
export class OllamaLocalProvider {
  async *stream(input: { model: string; messages: LocalChatMessage[]; signal?: AbortSignal }): AsyncGenerator<LocalChatEvent> {
    if (!ALLOWED_MODELS.has(input.model)) {
      yield { type: "error", code: "model_not_allowed", message: "The requested local model is not allowed." };
      return;
    }

    let response: Response;
    try {
      const endpoint = new URL("/api/chat", localOllamaUrl());
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: input.model, messages: input.messages, stream: true }),
        signal: input.signal,
      });
    } catch {
      yield { type: "error", code: "ollama_unavailable", message: "Local Ollama is unavailable." };
      return;
    }

    if (!response.ok || !response.body) {
      yield { type: "error", code: "ollama_request_failed", message: "Local model generation could not start." };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let remainder = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = (remainder + decoder.decode(value, { stream: true })).split("\n");
        remainder = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const payload = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            prompt_eval_count?: number;
            eval_count?: number;
          };
          if (payload.message?.content) yield { type: "delta", text: payload.message.content };
          if (payload.done) yield {
            type: "done",
            inputTokens: payload.prompt_eval_count,
            outputTokens: payload.eval_count,
          };
        }
      }
    } catch {
      yield { type: "error", code: "ollama_stream_failed", message: "Local model stream ended unexpectedly." };
    } finally {
      reader.releaseLock();
    }
  }
}
