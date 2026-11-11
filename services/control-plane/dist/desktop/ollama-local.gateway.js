"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaLocalGateway = void 0;
const ALLOWED_MODELS = new Set(["qwen2.5:7b"]);
class OllamaLocalGateway {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async *stream(input) {
        if (!ALLOWED_MODELS.has(input.model)) {
            yield { type: "error", code: "model_not_allowed", message: "Only qwen2.5:7b is enabled for JVerse AI." };
            return;
        }
        let response;
        try {
            response = await fetch(new URL("/api/chat", this.baseUrl), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: input.model, messages: input.messages ?? [{ role: "user", content: input.message }], stream: true }),
                signal: input.signal,
            });
        }
        catch {
            yield { type: "error", code: "ollama_unavailable", message: "Ollama is unavailable. Start Ollama and install qwen2.5:7b." };
            return;
        }
        if (!response.ok || !response.body) {
            yield { type: "error", code: "ollama_request_failed", message: "Ollama could not start this response." };
            return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let remainder = "";
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const lines = (remainder + decoder.decode(value, { stream: true })).split("\n");
                remainder = lines.pop() ?? "";
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    const event = JSON.parse(line);
                    if (event.message?.content)
                        yield { type: "delta", text: event.message.content };
                    if (event.done)
                        yield { type: "done", usage: { inputTokens: event.prompt_eval_count, outputTokens: event.eval_count } };
                }
            }
        }
        catch (error) {
            if (!input.signal.aborted)
                yield { type: "error", code: "ollama_stream_failed", message: "The local model stream ended unexpectedly." };
        }
        finally {
            reader.releaseLock();
        }
    }
}
exports.OllamaLocalGateway = OllamaLocalGateway;
