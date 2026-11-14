import uuid
from collections import deque
from collections.abc import AsyncIterator

from app.contracts.chat import LocalChatStreamRequest, StreamEvent
from app.graph.chat_graph import build_chat_graph
from app.infrastructure.model_gateway import CompatibilityOllamaGateway

LANGUAGE_POLICY = (
    "You understand English, Filipino/Tagalog, and Taglish. Detect the user's language. "
    "For a primarily Tagalog or Taglish request, you MUST answer in this exact concise Markdown structure: "
    "'## Filipino' followed by natural Filipino/Taglish, then '## English translation' followed by the same meaning in English. "
    "Do not omit either section and do not invent words when unsure. "
    "Example: User: 'Ano ang kaya mong gawin?' Assistant: '## Filipino\nMakakatulong ako sa mga tanong, plano, at gawain mo.\n\n## English translation\nI can help with your questions, plans, and tasks.' "
    "For English requests, answer in English only. If the user explicitly requests a language or says not to translate, follow that request."
)


class LocalChatService:
    """Loopback-only local conversation service used by the packaged Electron app.

    It deliberately does not require a Supabase service-role secret. Durable cloud
    memory remains opt-in sync data; active conversation context stays on-device.
    """

    def __init__(self, gateway: CompatibilityOllamaGateway) -> None:
        self.gateway = gateway
        # Keep the local prompt small so Qwen can start answering immediately.
        self.history: deque[dict[str, str]] = deque(maxlen=8)
        self.graph = build_chat_graph()

    async def stream(self, request: LocalChatStreamRequest) -> AsyncIterator[StreamEvent]:
        run_id, correlation_id, sequence = str(uuid.uuid4()), str(uuid.uuid4()), 1
        state = await self.graph.ainvoke({"message": request.message, "normalized_message": "", "intent": "conversation", "risk": "informational", "tools": [], "plan": []})
        yield StreamEvent(type="metadata", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"conversation_id": "local"})
        sequence += 1
        yield StreamEvent(type="status", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"state": "planning", "intent": state["intent"], "plan": state["plan"]})
        sequence += 1
        history = [
            {"role": item["role"], "content": item["content"][:900]}
            for item in self.history
        ]
        prompt = [
            {"role": "system", "content": "You are JVerse AI running privately on this desktop. Be helpful, direct, and action-honest. Default to a concise answer under 100 words. Do not claim desktop actions happened unless the user approved them. " + LANGUAGE_POLICY},
            *history,
            {"role": "user", "content": request.message},
        ]
        completion = ""
        try:
            async for text in self.gateway.stream(prompt, request.model, "local", "local"):
                completion += text
                yield StreamEvent(type="delta", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"text": text})
                sequence += 1
        except RuntimeError as error:
            yield StreamEvent(type="error", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"code": str(error), "message": "Local Ollama could not generate a response."})
            return
        self.history.extend(({"role": "user", "content": request.message}, {"role": "assistant", "content": completion}))
        yield StreamEvent(type="done", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"conversation_id": "local"})
