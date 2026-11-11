from fastapi import FastAPI

from app.api import router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="JVerse Brain", version="0.1.0")
    app.include_router(router)
    @app.get("/health")
    async def health():
        return {"status": "ok", "brain": "python", "compat_local_ollama": settings.compat_local_ollama}
    return app


app = create_app()
