from collections.abc import AsyncIterator

import httpx

from app.core.config import Settings
from app.infrastructure.desktop_action_repository import DesktopActionRepository


class ModelGateway:
    async def stream(self, messages: list[dict[str, str]], model: str, workspace_id: str, user_id: str) -> AsyncIterator[str]:
        raise NotImplementedError


class CompatibilityOllamaGateway(ModelGateway):
    """Temporary local-only migration adapter; production uses paired Electron."""

    def __init__(self, settings: Settings, desktop_repository: DesktopActionRepository | None = None) -> None:
        self.settings = settings
        self.desktop_repository = desktop_repository

    def _request_options(self) -> dict[str, int | float]:
        return {
            "num_ctx": self.settings.ollama_context_tokens,
            "num_predict": self.settings.ollama_max_tokens,
            "temperature": 0.45,
        }

    async def warm(self) -> None:
        """Load the local model before the user asks the first question."""
        if not self.settings.compat_local_ollama:
            return
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                await client.post(
                    f"{str(self.settings.ollama_url).rstrip('/')}/api/chat",
                    json={
                        "model": self.settings.allowed_model,
                        "messages": [{"role": "user", "content": "Ready."}],
                        "stream": False,
                        "keep_alive": self.settings.ollama_keep_alive,
                        "options": {**self._request_options(), "num_predict": 1},
                    },
                )
        except Exception:
            # A missing or starting Ollama instance must not prevent the local API from starting.
            return

    async def stream(self, messages: list[dict[str, str]], model: str, workspace_id: str, user_id: str) -> AsyncIterator[str]:
        if model != self.settings.allowed_model:
            raise RuntimeError("model_not_allowed")
        if not self.settings.compat_local_ollama:
            if not self.desktop_repository:
                raise RuntimeError("paired_desktop_provider_unavailable")
            job = await self.desktop_repository.create_model_job(workspace_id, user_id, messages, model)
            async for text in self.desktop_repository.stream_model_job(job["id"]):
                yield text
            return
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{str(self.settings.ollama_url).rstrip('/')}/api/chat", json={
                "model": model,
                "messages": messages,
                "stream": True,
                "keep_alive": self.settings.ollama_keep_alive,
                "options": self._request_options(),
            }) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = __import__("json").loads(line)
                    if text := (payload.get("message") or {}).get("content"):
                        yield text
