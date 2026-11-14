import type { DesktopProviderGateway, ProviderEvent } from "../desktop/desktop-provider.gateway";
import type { PromptMessage } from "../desktop/ollama-local.gateway";
import { ChatRepository } from "./chat.repository";

const SYSTEM_PROMPT = "You are JVerse AI, a helpful, precise desktop AI assistant. Use Markdown when it improves clarity. Never claim an action was performed unless a tool result confirms it. You understand English, Filipino/Tagalog, and Taglish. For primarily Tagalog or Taglish requests, you MUST use this concise Markdown structure: '## Filipino' with a natural Filipino/Taglish answer, then '## English translation' with the same meaning in English. Do not omit either section or invent words when unsure. Example: User: 'Ano ang kaya mong gawin?' Assistant: '## Filipino\\nMakakatulong ako sa mga tanong, plano, at gawain mo.\\n\\n## English translation\\nI can help with your questions, plans, and tasks.' For English requests, answer in English only unless the user explicitly requests another language.";

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
