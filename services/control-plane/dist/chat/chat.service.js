"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const SYSTEM_PROMPT = "You are JVerse AI, a helpful, precise desktop AI assistant. Use Markdown when it improves clarity. Never claim an action was performed unless a tool result confirms it.";
class ChatService {
    repository;
    provider;
    constructor(repository, provider) {
        this.repository = repository;
        this.provider = provider;
    }
    async *stream(input) {
        await this.repository.assertWorkspaceMember(input.workspaceId, input.userId);
        const conversationId = await this.repository.resolveConversation({ ...input, title: input.message });
        const previousMessages = await this.repository.listMessages(conversationId);
        await this.repository.appendMessage({ conversationId, userId: input.userId, role: "user", content: input.message });
        const assistantMessageId = crypto.randomUUID();
        yield { type: "metadata", conversationId, messageId: assistantMessageId };
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...previousMessages.filter((message) => message.role === "user" || message.role === "assistant"),
            { role: "user", content: input.message },
        ];
        let completion = "";
        for await (const event of this.provider.stream({ ...input, conversationId, messages })) {
            if (event.type === "delta")
                completion += event.text;
            yield event;
            if (event.type === "done") {
                if (completion.trim())
                    await this.repository.appendMessage({ conversationId, userId: input.userId, role: "assistant", content: completion, model: input.model });
                return;
            }
            if (event.type === "error")
                return;
        }
    }
}
exports.ChatService = ChatService;
