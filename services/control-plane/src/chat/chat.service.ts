import type { DesktopProviderGateway, ProviderEvent } from "../desktop/desktop-provider.gateway";
import type { PromptMessage } from "../desktop/ollama-local.gateway";
import { ChatRepository } from "./chat.repository";

const SYSTEM_PROMPT = "You are JVerse AI, a helpful, precise desktop AI assistant. Use Markdown when it improves clarity. Never claim an action was performed unless a tool result confirms it.";

export class ChatService {
  constructor(private readonly repository: ChatRepository, private readonly provider: DesktopProviderGateway) {}

  async *stream(input: { userId: string; workspaceId: string; conversationId: string | null; message: string; model: string; signal: AbortSignal }): AsyncIterable<ProviderEvent> {
    await this.repository.assertWorkspaceMember(input.workspaceId, input.userId);
    const conversationId = await this.repository.resolveConversation({ ...input, title: input.message });
    const previousMessages = await this.repository.listMessages(conversationId);
    await this.repository.appendMessage({ conversationId, userId: input.userId, role: "user", content: input.message });
    const assistantMessageId = crypto.randomUUID();
    yield { type: "metadata", conversationId, messageId: assistantMessageId };

    const messages: PromptMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...previousMessages.filter((message) => message.role === "user" || message.role === "assistant") as PromptMessage[],
      { role: "user", content: input.message },
    ];
    let completion = "";
    for await (const event of this.provider.stream({ ...input, conversationId, messages })) {
      if (event.type === "delta") completion += event.text;
      yield event;
      if (event.type === "done") {
        if (completion.trim()) await this.repository.appendMessage({ conversationId, userId: input.userId, role: "assistant", content: completion, model: input.model });
        return;
      }
      if (event.type === "error") return;
    }
  }
}
