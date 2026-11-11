import json

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.contracts.chat import ChatStreamRequest
from app.contracts.desktop import DesktopActionRequest, DesktopCompletion, DesktopHeartbeat, DesktopPairRequest, DesktopPairResponse
from app.core.config import Settings, get_settings
from app.infrastructure.desktop_action_repository import DesktopActionRepository
from app.infrastructure.model_gateway import CompatibilityOllamaGateway
from app.infrastructure.supabase_chat_repository import SupabaseChatRepository
from app.infrastructure.supabase_identity import verify_supabase_access_token
from app.services.chat_service import ChatService
from app.services.desktop_service import DesktopService

router = APIRouter(prefix="/v1")


async def principal(authorization: str = Header(default=""), settings: Settings = Depends(get_settings)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthenticated")
    return await verify_supabase_access_token(authorization.removeprefix("Bearer "), settings)


async def desktop_principal(
    desktop_id: str = Header(default="", alias="X-JVerse-Desktop-Id"),
    desktop_token: str = Header(default="", alias="X-JVerse-Desktop-Token"),
    settings: Settings = Depends(get_settings),
) -> dict:
    if not desktop_id or not desktop_token:
        raise HTTPException(status_code=401, detail="desktop_not_paired")
    try:
        return await DesktopActionRepository(settings).assert_device_token(desktop_id, desktop_token)
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


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


@router.post("/desktop/pair", response_model=DesktopPairResponse)
async def pair_desktop(request: DesktopPairRequest, user_id: str = Depends(principal), settings: Settings = Depends(get_settings)):
    device_id, device_token = await DesktopActionRepository(settings).register_device(user_id, request.device_name, request.platform, request.app_version)
    return DesktopPairResponse(device_id=device_id, device_token=device_token)


@router.post("/desktop/actions")
async def request_desktop_action(request: DesktopActionRequest, user_id: str = Depends(principal), settings: Settings = Depends(get_settings)):
    action = await DesktopService(DesktopActionRepository(settings)).request_action(request, user_id)
    return {"action_id": action["id"], "status": action["status"], "expires_at": action.get("approval_expires_at")}


@router.post("/desktop/actions/{action_id}/approve")
async def approve_desktop_action(action_id: str, user_id: str = Depends(principal), settings: Settings = Depends(get_settings)):
    try:
        action = await DesktopActionRepository(settings).approve(action_id, user_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail="action_not_approvable") from error
    return {"action_id": action["id"], "status": "approved", "expires_at": action.get("approval_expires_at")}


@router.post("/desktop/heartbeat")
async def desktop_heartbeat(_metrics: DesktopHeartbeat, device: dict = Depends(desktop_principal), settings: Settings = Depends(get_settings)):
    await DesktopActionRepository(settings).heartbeat(device["id"])
    return {"ok": True}


@router.get("/desktop/commands/next")
async def next_desktop_command(device: dict = Depends(desktop_principal), settings: Settings = Depends(get_settings)):
    return await DesktopActionRepository(settings).claim_next(device["id"])


@router.post("/desktop/commands/{action_id}/complete")
async def complete_desktop_command(action_id: str, result: DesktopCompletion, device: dict = Depends(desktop_principal), settings: Settings = Depends(get_settings)):
    try:
        await DesktopActionRepository(settings).complete(action_id, device["id"], result.ok, result.model_dump(exclude_none=True))
    except LookupError as error:
        raise HTTPException(status_code=404, detail="action_not_executing") from error
    return {"ok": True}
