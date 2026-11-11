from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.core.config import Settings


class DesktopActionRepository:
    def __init__(self, settings: Settings) -> None:
        self.base_url = str(settings.supabase_url).rstrip("/")
        key = settings.supabase_service_role_key.get_secret_value()
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    async def _request(self, method: str, table: str, *, params: dict[str, str] | None = None, payload: Any = None, representation: bool = False) -> list[dict[str, Any]]:
        headers = {**self.headers, **({"Prefer": "return=representation"} if representation else {})}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(method, f"{self.base_url}/rest/v1/{table}", headers=headers, params=params, json=payload)
        response.raise_for_status()
        return response.json() if response.content else []

    async def assert_member(self, workspace_id: str, user_id: str) -> None:
        rows = await self._request("GET", "workspace_members", params={"workspace_id": f"eq.{workspace_id}", "user_id": f"eq.{user_id}", "select": "workspace_id", "limit": "1"})
        if not rows:
            raise PermissionError("workspace_access_denied")

    async def register_device(self, user_id: str, device_name: str, platform: str, app_version: str | None) -> tuple[str, str]:
        token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        rows = await self._request("POST", "device_registrations", payload={"user_id": user_id, "device_name": device_name, "platform": platform, "app_version": app_version, "desktop_token_hash": token_hash}, representation=True)
        return rows[0]["id"], token

    async def get_device_for_owner(self, device_id: str, user_id: str) -> dict[str, Any]:
        rows = await self._request("GET", "device_registrations", params={"id": f"eq.{device_id}", "user_id": f"eq.{user_id}", "revoked_at": "is.null", "select": "id", "limit": "1"})
        if not rows:
            raise PermissionError("desktop_not_owned")
        return rows[0]

    async def assert_device_token(self, device_id: str, token: str) -> dict[str, Any]:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        rows = await self._request("GET", "device_registrations", params={"id": f"eq.{device_id}", "desktop_token_hash": f"eq.{token_hash}", "revoked_at": "is.null", "select": "id,user_id", "limit": "1"})
        if not rows:
            raise PermissionError("desktop_not_paired")
        return rows[0]

    async def heartbeat(self, device_id: str) -> None:
        await self._request("PATCH", "device_registrations", params={"id": f"eq.{device_id}"}, payload={"last_seen_at": datetime.now(UTC).isoformat()})

    async def create_action(self, workspace_id: str, user_id: str, device_id: str, action_type: str, payload: dict[str, Any], target_summary: str, risk_tier: int) -> dict[str, Any]:
        expiry = datetime.now(UTC) + timedelta(minutes=5)
        runs = await self._request("POST", "agent_runs", payload={"workspace_id": workspace_id, "owner_id": user_id, "status": "awaiting_approval", "prompt_version": "desktop-command-v1", "context_manifest": {"source": "desktop_api", "action_type": action_type}}, representation=True)
        actions = await self._request("POST", "agent_actions", payload={"agent_run_id": runs[0]["id"], "workspace_id": workspace_id, "owner_id": user_id, "device_id": device_id, "action_type": action_type, "risk_tier": risk_tier, "status": "awaiting_approval", "input_payload": payload, "target_summary": target_summary, "approval_expires_at": expiry.isoformat()}, representation=True)
        return actions[0]

    async def approve(self, action_id: str, user_id: str) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        rows = await self._request("PATCH", "agent_actions", params={"id": f"eq.{action_id}", "owner_id": f"eq.{user_id}", "status": "eq.awaiting_approval", "approval_expires_at": f"gt.{now}", "select": "id,agent_run_id,approval_expires_at"}, payload={"status": "approved", "approved_at": now}, representation=True)
        if not rows:
            raise LookupError("action_not_approvable")
        await self._request("PATCH", "agent_runs", params={"id": f"eq.{rows[0]['agent_run_id']}"}, payload={"status": "executing", "started_at": now})
        return rows[0]

    async def claim_next(self, device_id: str) -> dict[str, Any] | None:
        now = datetime.now(UTC).isoformat()
        rows = await self._request("GET", "agent_actions", params={"device_id": f"eq.{device_id}", "status": "eq.approved", "approval_expires_at": f"gt.{now}", "select": "id,agent_run_id,action_type,input_payload", "order": "created_at.asc", "limit": "1"})
        if not rows:
            return None
        action = rows[0]
        claimed = await self._request("PATCH", "agent_actions", params={"id": f"eq.{action['id']}", "device_id": f"eq.{device_id}", "status": "eq.approved"}, payload={"status": "executing", "executed_at": now}, representation=True)
        return claimed[0] if claimed else None

    async def complete(self, action_id: str, device_id: str, ok: bool, result: dict[str, Any]) -> None:
        now = datetime.now(UTC).isoformat()
        rows = await self._request("PATCH", "agent_actions", params={"id": f"eq.{action_id}", "device_id": f"eq.{device_id}", "status": "eq.executing", "select": "agent_run_id"}, payload={"status": "completed" if ok else "failed", "completed_at": now, "result_summary": result, "error_code": None if ok else "desktop_execution_failed"}, representation=True)
        if not rows:
            raise LookupError("action_not_executing")
        await self._request("PATCH", "agent_runs", params={"id": f"eq.{rows[0]['agent_run_id']}"}, payload={"status": "completed" if ok else "failed", "completed_at": now})
