import uuid
from collections import deque
from collections.abc import AsyncIterator

from app.contracts.chat import LocalChatStreamRequest, StreamEvent
from app.graph.chat_graph import build_chat_graph
from app.infrastructure.model_gateway import CompatibilityOllamaGateway


class LocalChatService:
    """Loopback-only local conversation service used by the packaged Electron app.

    It deliberately does not require a Supabase service-role secret. Durable cloud
    memory remains opt-in sync data; active conversation context stays on-device.
    """

    def __init__(self, gateway: CompatibilityOllamaGateway) -> None:
        self.gateway = gateway
        self.history: deque[dict[str, str]] = deque(maxlen=20)
        self.graph = build_chat_graph()

    async def stream(self, request: LocalChatStreamRequest) -> AsyncIterator[StreamEvent]:
        run_id, correlation_id, sequence = str(uuid.uuid4()), str(uuid.uuid4()), 1
        state = await self.graph.ainvoke({"message": request.message, "normalized_message": "", "intent": "conversation", "risk": "informational", "tools": [], "plan": []})
        yield StreamEvent(type="metadata", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"conversation_id": "local"})
        sequence += 1
        yield StreamEvent(type="status", run_id=run_id, sequence=sequence, correlation_id=correlation_id, payload={"state": "planning", "intent": state["intent"], "plan": state["plan"]})
        sequence += 1
        prompt = [
            {"role": "system", "content": "You are JVerse AI running privately on this desktop. Be precise, helpful, privacy-aware, and action-honest. Do not claim desktop actions happened unless the user has approved them."},
            *self.history,
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
