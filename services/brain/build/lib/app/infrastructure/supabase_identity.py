import httpx
from fastapi import HTTPException, status

from app.core.config import Settings


async def verify_supabase_access_token(token: str, settings: Settings) -> str:
    headers = {"apikey": settings.supabase_publishable_key.get_secret_value(), "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get(f"{str(settings.supabase_url).rstrip('/')}/auth/v1/user", headers=headers)
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthenticated")
    user_id = response.json().get("id")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthenticated")
    return user_id
