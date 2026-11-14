import asyncio

from fastapi import FastAPI

from app.api import router
from app.core.config import get_settings
from app.infrastructure.model_gateway import CompatibilityOllamaGateway


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="JVerse Brain", version="0.1.0")
    app.include_router(router)

    @app.on_event("startup")
    async def warm_local_model() -> None:
        # Start model loading while the dashboard is opening, not after the first command.
        if settings.local_mode and settings.compat_local_ollama:
            asyncio.create_task(CompatibilityOllamaGateway(settings).warm())

    @app.get("/health")
    async def health():
        return {"status": "ok", "brain": "python", "compat_local_ollama": settings.compat_local_ollama}
    return app


app = create_app()
