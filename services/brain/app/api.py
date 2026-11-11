import json

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.contracts.chat import ChatStreamRequest
from app.core.config import Settings, get_settings
from app.infrastructure.model_gateway import CompatibilityOllamaGateway
from app.infrastructure.supabase_chat_repository import SupabaseChatRepository
from app.infrastructure.supabase_identity import verify_supabase_access_token
from app.services.chat_service import ChatService

router = APIRouter(prefix="/v1")


async def principal(authorization: str = Header(default=""), settings: Settings = Depends(get_settings)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthenticated")
    return await verify_supabase_access_token(authorization.removeprefix("Bearer "), settings)


@router.post("/chat/stream")
async def chat_stream(request: ChatStreamRequest, user_id: str = Depends(principal), settings: Settings = Depends(get_settings)):
    service = ChatService(CompatibilityOllamaGateway(settings), SupabaseChatRepository(settings))
    async def events():
        try:
            async for event in service.stream(request, user_id):
                yield f"event: {event.type}\ndata: {json.dumps(event.model_dump())}\n\n"
        except PermissionError:
            yield 'event: error\ndata: {"version":"v1","type":"error","payload":{"code":"forbidden","message":"You do not have access to this workspace."}}\n\n'
        except LookupError:
            yield 'event: error\ndata: {"version":"v1","type":"error","payload":{"code":"not_found","message":"This conversation is unavailable."}}\n\n'
        except Exception:
            yield 'event: error\ndata: {"version":"v1","type":"error","payload":{"code":"unavailable","message":"The JVerse brain could not prepare this response."}}\n\n'
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})
