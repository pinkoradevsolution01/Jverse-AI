from collections.abc import AsyncIterator

import httpx

from app.core.config import Settings
from app.infrastructure.desktop_action_repository import DesktopActionRepository


class ModelGateway:
    async def stream(self, messages: list[dict[str, str]], model: str, workspace_id: str, user_id: str) -> AsyncIterator[str]:
        raise NotImplementedError


class CompatibilityOllamaGateway(ModelGateway):
    """Temporary local-only migration adapter; production uses paired Electron."""

    def __init__(self, settings: Settings, desktop_repository: DesktopActionRepository) -> None:
        self.settings = settings
        self.desktop_repository = desktop_repository

    async def stream(self, messages: list[dict[str, str]], model: str, workspace_id: str, user_id: str) -> AsyncIterator[str]:
        if model != self.settings.allowed_model:
            raise RuntimeError("model_not_allowed")
        if not self.settings.compat_local_ollama:
            job = await self.desktop_repository.create_model_job(workspace_id, user_id, messages, model)
            async for text in self.desktop_repository.stream_model_job(job["id"]):
                yield text
            return
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{str(self.settings.ollama_url).rstrip('/')}/api/chat", json={"model": model, "messages": messages, "stream": True}) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = __import__("json").loads(line)
                    if text := (payload.get("message") or {}).get("content"):
                        yield text
