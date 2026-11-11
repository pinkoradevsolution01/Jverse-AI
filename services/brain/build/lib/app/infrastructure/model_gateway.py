from collections.abc import AsyncIterator

import httpx

from app.core.config import Settings


class ModelGateway:
    async def stream(self, messages: list[dict[str, str]], model: str) -> AsyncIterator[str]:
        raise NotImplementedError


class CompatibilityOllamaGateway(ModelGateway):
    """Temporary local-only migration adapter; production uses paired Electron."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def stream(self, messages: list[dict[str, str]], model: str) -> AsyncIterator[str]:
        if not self.settings.compat_local_ollama or model != self.settings.allowed_model:
            raise RuntimeError("paired_desktop_provider_unavailable")
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{str(self.settings.ollama_url).rstrip('/')}/api/chat", json={"model": model, "messages": messages, "stream": True}) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = __import__("json").loads(line)
                    if text := (payload.get("message") or {}).get("content"):
                        yield text
