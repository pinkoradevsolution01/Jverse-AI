from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from app.core.config import Settings


@dataclass(frozen=True)
class StoredMessage:
    role: str
    content: str


class SupabaseChatRepository:
    def __init__(self, settings: Settings) -> None:
        self.base_url = str(settings.supabase_url).rstrip("/")
        self.headers = {"apikey": settings.supabase_service_role_key.get_secret_value(), "Authorization": f"Bearer {settings.supabase_service_role_key.get_secret_value()}", "Content-Type": "application/json"}

    async def assert_member(self, workspace_id: str, user_id: str) -> None:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(f"{self.base_url}/rest/v1/workspace_members", headers={**self.headers, "Accept": "application/json"}, params={"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}", "select": "workspace_id", "limit": "1"})
        response.raise_for_status()
        if not response.json():
            raise PermissionError("workspace_access_denied")

    async def resolve_conversation(self, workspace_id: str, user_id: str, conversation_id: str | None, title: str, model: str) -> str:
        async with httpx.AsyncClient(timeout=10) as client:
            if conversation_id:
                response = await client.get(f"{self.base_url}/rest/v1/conversations", headers={**self.headers, "Accept": "application/json"}, params={"id": f"eq.{conversation_id}", "workspace_id": f"eq.{workspace_id}", "owner_id": f"eq.{user_id}", "archived_at": "is.null", "select": "id", "limit": "1"})
                response.raise_for_status()
                rows = response.json()
                if not rows:
                    raise LookupError("conversation_not_found")
                return rows[0]["id"]
            response = await client.post(f"{self.base_url}/rest/v1/conversations", headers={**self.headers, "Prefer": "return=representation"}, json={"workspace_id": workspace_id, "owner_id": user_id, "title": title[:120], "model_preference": model})
        response.raise_for_status()
        return response.json()[0]["id"]

    async def history(self, conversation_id: str, limit: int = 16) -> list[StoredMessage]:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.base_url}/rest/v1/messages", headers={**self.headers, "Accept": "application/json"}, params={"conversation_id": f"eq.{conversation_id}", "select": "role,content", "order": "sequence_number.desc", "limit": str(limit)})
        response.raise_for_status()
        messages: list[StoredMessage] = []
        for row in reversed(response.json()):
            content = row.get("content") or {}
            text = content.get("text", "") if isinstance(content, dict) else str(content)
            if text and row.get("role") in {"user", "assistant"}:
                messages.append(StoredMessage(role=row["role"], content=text))
        return messages

    async def active_memories(self, workspace_id: str, user_id: str, limit: int) -> list[str]:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(f"{self.base_url}/rest/v1/memory_records", headers={**self.headers, "Accept": "application/json"}, params={"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}", "status": "eq.active", "select": "content,importance", "order": "importance.desc,updated_at.desc", "limit": str(limit)})
        response.raise_for_status()
        return [row["content"] for row in response.json() if isinstance(row.get("content"), str)]

    async def append(self, conversation_id: str, user_id: str, role: str, content: str, model: str | None = None) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            latest = await client.get(f"{self.base_url}/rest/v1/messages", headers={**self.headers, "Accept": "application/json"}, params={"conversation_id": f"eq.{conversation_id}", "select": "sequence_number", "order": "sequence_number.desc", "limit": "1"})
            latest.raise_for_status()
            sequence = int(latest.json()[0]["sequence_number"]) + 1 if latest.json() else 1
            response = await client.post(f"{self.base_url}/rest/v1/messages", headers=self.headers, json={"conversation_id": conversation_id, "sequence_number": sequence, "role": role, "owner_id": user_id, "content": {"text": content}, "model_name": model})
            response.raise_for_status()
            await client.patch(f"{self.base_url}/rest/v1/conversations?id=eq.{conversation_id}", headers=self.headers, json={"last_message_at": datetime.now(UTC).isoformat()})
